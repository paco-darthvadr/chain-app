import { rpcCall } from '@/app/utils/verus-rpc';

export interface OpeningCommitment {
  [key: string]: string;  // e.g. { white: "zenny@", black: "lenny@" } or { red: "zenny@", black: "lenny@" }
  gameNumber: string;
  startedAt: string;
}

/**
 * Build the canonical opening commitment message.
 * Keys are sorted for deterministic signing/verification.
 */
export function buildOpeningMessage(commitment: OpeningCommitment): string {
  return JSON.stringify(commitment, Object.keys(commitment).sort());
}

/**
 * Verify a player's signature on the opening commitment via verifymessage RPC.
 */
export async function verifyOpeningSignature(
  verusId: string,
  signature: string,
  commitment: OpeningCommitment,
): Promise<boolean> {
  const message = buildOpeningMessage(commitment);
  return rpcCall('verifymessage', [verusId, signature, message]);
}
