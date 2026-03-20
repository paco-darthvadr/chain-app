import axios from 'axios';

const VERUS_RPC_URL = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;

/**
 * Make a JSON-RPC call to the Verus daemon.
 */
export async function rpcCall(method: string, params: any[] = []): Promise<any> {
  const response = await axios.post(VERUS_RPC_URL, {
    method,
    params,
    id: 1,
    jsonrpc: '2.0',
  });
  if (response.data.error) {
    throw new Error(`RPC ${method} error: ${JSON.stringify(response.data.error)}`);
  }
  return response.data.result;
}

/**
 * Wait for a transaction to get at least one confirmation.
 * Polls getrawtransaction every 10s, up to maxWait ms.
 */
export async function waitForConfirmation(
  txid: string,
  maxWait: number = 300000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const tx = await rpcCall('getrawtransaction', [txid, 1]);
      if (tx && tx.confirmations && tx.confirmations > 0) {
        return true;
      }
    } catch {
      // TX not found yet — keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  return false;
}

/**
 * Build the full SubID name from a short name like "game0017".
 * Returns e.g. "game0017.ChessGame@"
 */
export function buildSubIdFullName(subIdName: string): string {
  const parentName = process.env.CHESSGAME_IDENTITY_NAME || 'ChessGame@';
  return `${subIdName}.${parentName.replace('@', '')}@`;
}

/**
 * Resolve a player object to a display name (e.g. "zenny@").
 */
export function getPlayerName(user: { displayName?: string | null; verusId: string }): string {
  return user.displayName ? `${user.displayName}@` : user.verusId;
}
