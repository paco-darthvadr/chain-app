import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Pluggable move signer interface.
 * Phase 1: Server signs on behalf of authenticated players.
 * Phase 2+: Client signs via browser extension or mobile wallet.
 */
export interface MoveSigner {
  sign(message: string): string;
  verify(message: string, signature: string): boolean;
  getPublicKey(): string;
}

/**
 * Server-side signer using HMAC-SHA256 with the CHESSGAME_SIGNING_WIF.
 * For Phase 1, this signs on behalf of both players as a server attestation.
 * Both whiteSig and blackSig come from the same key — they attest the server
 * verified the authenticated player made the move, not that distinct players signed.
 *
 * When client-side signing arrives (Phase 2+), this class gets swapped out
 * for one that delegates to the browser extension or wallet using ECDSA/secp256k1.
 */
export class ServerMoveSigner implements MoveSigner {
  private secret: string;
  private publicKey: string;

  constructor() {
    this.secret = process.env.CHESSGAME_SIGNING_WIF || process.env.VERUS_SIGNING_WIF || 'dev-signing-key';
    this.publicKey = createHash('sha256').update(this.secret + ':public').digest('hex');
  }

  sign(message: string): string {
    return createHmac('sha256', this.secret).update(message).digest('hex');
  }

  verify(message: string, signature: string): boolean {
    const expected = this.sign(message);
    if (signature.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  getPublicKey(): string {
    return this.publicKey;
  }
}

// Singleton instance for the current signing phase
let signerInstance: MoveSigner | null = null;

export function getMoveSigner(): MoveSigner {
  if (!signerInstance) {
    signerInstance = new ServerMoveSigner();
  }
  return signerInstance;
}
