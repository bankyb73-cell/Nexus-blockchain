/**
 * Global constants for the NEXUS blockchain / NXC cryptocurrency.
 * Change TOKEN.NAME and TOKEN.SYMBOL here to rebrand.
 */
export const TOKEN = {
  NAME: "NEXUS",
  SYMBOL: "NXC",
  TOTAL_SUPPLY: 40_000_000,

  ALLOCATIONS: {
    FOUNDER: 8_000_000,      // 20% — locked 12 months, then vests 1/24 per month
    ECOSYSTEM: 14_000_000,   // 35% — grants for developers building on-chain
    VALIDATORS: 10_000_000,  // 25% — staking rewards over 10 years
    PUBLIC_SALE: 5_000_000,  // 12.5% — public distribution
    TREASURY: 3_000_000,     // 7.5%  — protocol treasury
  },

  /** Fee collected per transaction, paid to the miner/validator */
  TRANSACTION_FEE_RATE: 0.001, // 0.1%
};

export const MINING = {
  INITIAL_DIFFICULTY: 3,
};

export const VESTING = {
  /** Founder tokens are locked for 12 months from genesis */
  LOCK_PERIOD_MS: 365 * 24 * 60 * 60 * 1000,
  /** After lock period, release 1/24 per month */
  VESTING_MONTHS: 24,
  MONTH_MS: 30 * 24 * 60 * 60 * 1000,
};
