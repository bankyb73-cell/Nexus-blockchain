/**
 * Vesting contract (in code, not Solidity).
 *
 * Founder tokens are:
 *   - Locked for 12 months from genesis timestamp
 *   - Then vest 1/24th per month over 24 months
 *
 * Vesting state is persisted to founderVesting.json.
 */

import { VESTING, TOKEN } from "./constants.js";
import type { VestingState } from "./types.js";

/**
 * Create the initial vesting state at genesis.
 */
export function createVestingState(founderAddress: string, genesisTimestamp: number): VestingState {
  return {
    genesisTimestamp,
    founderAddress,
    totalAllocation: TOKEN.ALLOCATIONS.FOUNDER,
    totalVested: 0,
    totalClaimed: 0,
    monthsVested: 0,
    lastChecked: genesisTimestamp,
  };
}

/**
 * Advance the vesting state to the current moment.
 * Calling this does NOT transfer tokens — it only updates accounting state.
 * Returns the updated state and the new amount available to claim.
 */
export function advanceVesting(state: VestingState, now: number): {
  updated: VestingState;
  newlyVested: number;
} {
  const lockEnd = state.genesisTimestamp + VESTING.LOCK_PERIOD_MS;

  // Still in lock period — nothing vests
  if (now < lockEnd) {
    return { updated: { ...state, lastChecked: now }, newlyVested: 0 };
  }

  // How many months have elapsed since the lock period ended?
  const msAfterLock = now - lockEnd;
  const monthsAfterLock = Math.floor(msAfterLock / VESTING.MONTH_MS);
  const vestedMonths = Math.min(monthsAfterLock, VESTING.VESTING_MONTHS);

  const vestedNow = Math.min(
    vestedMonths * (TOKEN.ALLOCATIONS.FOUNDER / VESTING.VESTING_MONTHS),
    TOKEN.ALLOCATIONS.FOUNDER
  );

  const newlyVested = Math.max(0, vestedNow - state.totalVested);

  const updated: VestingState = {
    ...state,
    totalVested: vestedNow,
    monthsVested: vestedMonths,
    lastChecked: now,
  };

  return { updated, newlyVested };
}

/**
 * Record that the founder has claimed a vested amount.
 */
export function recordClaim(state: VestingState, amount: number): VestingState {
  const available = state.totalVested - state.totalClaimed;
  if (amount > available) {
    throw new Error(
      `Cannot claim ${amount}: only ${available} NXC is available (${state.totalVested} vested, ${state.totalClaimed} claimed)`
    );
  }
  return { ...state, totalClaimed: state.totalClaimed + amount };
}

/**
 * Get a human-readable vesting summary.
 */
export function vestingSummary(state: VestingState, now: number): {
  locked: boolean;
  lockUnlockDate: string;
  monthsVested: number;
  totalVested: number;
  totalClaimed: number;
  availableToClaim: number;
  remainingLocked: number;
  vestingComplete: boolean;
} {
  const lockEnd = state.genesisTimestamp + VESTING.LOCK_PERIOD_MS;
  const locked = now < lockEnd;
  const { updated } = advanceVesting(state, now);

  return {
    locked,
    lockUnlockDate: new Date(lockEnd).toISOString(),
    monthsVested: updated.monthsVested,
    totalVested: updated.totalVested,
    totalClaimed: updated.totalClaimed,
    availableToClaim: updated.totalVested - updated.totalClaimed,
    remainingLocked: state.totalAllocation - updated.totalVested,
    vestingComplete: updated.monthsVested >= VESTING.VESTING_MONTHS,
  };
}
