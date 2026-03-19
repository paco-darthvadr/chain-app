import axios from 'axios';

const VERUS_RPC_URL = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;

async function rpcCall(method: string, params: any[] = []): Promise<any> {
  const response = await axios.post(VERUS_RPC_URL, {
    method, params, id: 1, jsonrpc: '2.0',
  });
  if (response.data.error) {
    throw new Error(`RPC ${method} error: ${JSON.stringify(response.data.error)}`);
  }
  return response.data.result;
}

export interface OpeningCommitment {
  white: string;
  black: string;
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
