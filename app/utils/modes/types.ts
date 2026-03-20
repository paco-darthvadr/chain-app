export interface MoveData {
  move: string;        // UCI notation: "e2e4" or "e7e8q"
  player: string;      // VerusID: "alice@"
  boardState: any;     // full board state JSON from frontend
}

export interface SignedMovePackage {
  subIdName: string;
  player: string;
  moveNum: number;
  move: string;
  prevHash: string;
  signature: string;
}

export interface GameEndResult {
  gameHash: string;
  player1FinalSig: string;   // was whiteFinalSig
  player2FinalSig: string;   // was blackFinalSig
  verified: boolean;
}

export interface StorageResult {
  success: boolean;
  transactionId?: string;
  subIdName?: string;
  subIdAddress?: string;
  error?: string;
}

export interface ModeHandler {
  onMove(game: any, moveData: MoveData): Promise<SignedMovePackage | null>;
  onGameEnd(game: any): Promise<GameEndResult | null>;
  storeOnChain(game: any): Promise<StorageResult>;
}
