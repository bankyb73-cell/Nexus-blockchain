/**
 * Wallet module — generates secp256k1 key pairs, signs/verifies transactions.
 */

import { createHash } from "node:crypto";
import { ec as EC } from "elliptic";
import type { WalletData } from "./types.js";

const ec = new EC("secp256k1");

/**
 * Derive a wallet address from a public key.
 * Uses SHA-256 of the compressed public key, then takes first 40 hex chars.
 */
export function publicKeyToAddress(publicKey: string): string {
  return "0x" + createHash("sha256").update(publicKey).digest("hex").slice(0, 40);
}

/**
 * Generate a brand-new wallet with a random secp256k1 key pair.
 */
export function generateWallet(): WalletData {
  const keyPair = ec.genKeyPair();
  const publicKey = keyPair.getPublic("hex");
  const privateKey = keyPair.getPrivate("hex");
  const address = publicKeyToAddress(publicKey);

  return { address, publicKey, privateKey };
}

/**
 * Build the canonical signing payload for a transaction.
 * Both signer and verifier must use the same payload format.
 */
export function buildSigningPayload(params: {
  from: string;
  to: string;
  amount: number;
  fee: number;
  timestamp: number;
}): string {
  return JSON.stringify({
    from: params.from,
    to: params.to,
    amount: params.amount,
    fee: params.fee,
    timestamp: params.timestamp,
  });
}

/**
 * Sign a transaction payload with the sender's private key.
 * Returns a DER-encoded hex signature.
 */
export function signTransaction(
  privateKey: string,
  payload: string
): string {
  const keyPair = ec.keyFromPrivate(privateKey, "hex");
  const hash = createHash("sha256").update(payload).digest();
  const signature = keyPair.sign(hash);
  return signature.toDER("hex");
}

/**
 * Verify a transaction's DER signature against the sender's public key.
 */
export function verifySignature(
  publicKey: string,
  payload: string,
  signature: string
): boolean {
  try {
    const keyPair = ec.keyFromPublic(publicKey, "hex");
    const hash = createHash("sha256").update(payload).digest();
    return keyPair.verify(hash, signature);
  } catch {
    return false;
  }
}

/**
 * Given a public key, verify that an address matches it.
 */
export function verifyAddressOwnership(address: string, publicKey: string): boolean {
  return publicKeyToAddress(publicKey) === address;
}
