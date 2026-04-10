const axios = require('axios');
const { VerusIdInterface } = require('verusid-ts-client');
const { VerusdRpcInterface } = require('verusd-rpc-ts-client');
const { Identity } = require('verus-typescript-primitives/dist/pbaas');
const { DATA_TYPE_STRING } = require('verus-typescript-primitives/dist/vdxf/keys');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Logs the keys of the identity's contentmultimap for debugging.
 * @param {string} [identityName] - Optional identity name, defaults to VERUS_SIGNING_ID env var.
 */
async function logIdentityContentMultimapKeys(identityName) {
  try {
    const name = identityName || process.env.VERUS_SIGNING_ID;
    if (!name) {
      throw new Error('VERUS_SIGNING_ID environment variable not set');
    }
    const verusId = new VerusIdInterface(SYSTEM_ID, VERUS_RPC_NETWORK);
    // Use getIdentityContent instead of getIdentity
    const identityResp = await verusId.interface.getIdentityContent(name);
    if (!identityResp.result) {
      throw new Error(`Identity not found: ${name}`);
    }
    const identity = identityResp.result.identity;
    const contentmultimap = identity.contentmultimap || {};
    const keys = Object.keys(contentmultimap);
    console.log(`[STORAGE] contentmultimap keys for identity '${name}':`, keys);
    return keys;
  } catch (err) {
    console.error('[STORAGE] Error logging contentmultimap keys:', err.message || err);
    return [];
  }
}

async function clearRawMempool() {
  const url = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;
  try {
    const response = await axios.post(url, {
      method: 'clearrawmempool',
      params: [],
      id: 1,
      jsonrpc: '2.0'
    });
    console.log('[DIAG] clearrawmempool response:', response.data);
    return response.data;
  } catch (err) {
    console.error('Error clearing mempool:', err.response ? err.response.data : err.message);
    throw err;
  }
}


// Log all transaction attempts to a file for debugging order and issues
function logTxToFile(logObj) {
  const logPath = path.join(process.cwd(), 'app', 'tx-log.json');
  const fallbackPath = path.join(__dirname, '../tx-log.json');
  function writeToValidJson(filePath) {
    let logs = [];
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.trim()) {
          logs = JSON.parse(content);
        }
      }
    } catch (e) {
      logs = [];
    }
    logs.push(logObj);
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
  }
  try {
    writeToValidJson(logPath);
  } catch (e) {
    console.error('[BASIC] Failed to write tx log (cwd):', e);
    try {
      writeToValidJson(fallbackPath);
    } catch (e2) {
      console.error('[BASIC] Fallback log write also failed:', e2);
    }
  }
}

const SYSTEM_ID = process.env.TESTNET === 'true'
  ? 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
  : 'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV';

const VERUS_RPC_NETWORK = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;
const VerusdRpc = new VerusdRpcInterface(SYSTEM_ID, VERUS_RPC_NETWORK);

class BlockchainMoveStorageBasic {
  constructor() {
    this.verusId = new VerusIdInterface(SYSTEM_ID, VERUS_RPC_NETWORK);
    this.lastIdentityTx = null; // { txid, rawHex, blockHeight }
    this.spentUtxos = new Set();
    this.usedUtxos = new Set();
  }

  static hashMove(moveObj) {
    return crypto.createHash('sha256').update(JSON.stringify(moveObj)).digest('hex');
  }

  async getRawTransaction(identity) {
    try {
      const txResponse = await VerusdRpc.getRawTransaction(identity.txid);
      if (!txResponse.result) throw new Error('No raw transaction hex returned');
      return txResponse.result;
    } catch (error) {
      return identity.txid;
    }
  }

  async getAllUtxos(address) {
    // Fetch UTXOs and mempool for the address
    const utxoResponse = await VerusdRpc.getAddressUtxos({ addresses: [address] });
    const mempoolResponse = await VerusdRpc.getAddressMempool({ addresses: [address] });
    let allUtxos = utxoResponse.result || [];
    let mempoolSpentSet = new Set();
    // Build set of UTXOs referenced in mempool as spending
    if (Array.isArray(mempoolResponse.result)) {
      mempoolResponse.result.forEach(entry => {
        if (entry.spending && entry.txid && typeof entry.index === 'number') {
          mempoolSpentSet.add(`${entry.txid}:${entry.index}`);
        }
      });
    }
    // Filter out UTXOs already used in pending txs, referenced in mempool as spending, or already used for previous moves in this session
    const filteredUtxos = allUtxos.filter(u =>
      u.satoshis > 0 &&
      u.isspendable === 1 &&
      !this.spentUtxos.has(`${u.txid}:${u.outputIndex}`) &&
      !mempoolSpentSet.has(`${u.txid}:${u.outputIndex}`) &&
      !this.usedUtxos.has(`${u.txid}:${u.outputIndex}`)
    );
    // Log mempool and spendable UTXOs
    console.log(`[DEBUG][getAllUtxos] mempoolSpentSet:`, Array.from(mempoolSpentSet));
    console.log(`[DEBUG][getAllUtxos] spendableUtxos:`);
    filteredUtxos.forEach((u, idx) => {
      console.log(`  [${idx}] txid: ${u.txid}, outputIndex: ${u.outputIndex}, satoshis: ${u.satoshis}, isspendable: ${u.isspendable}`);
    });
    return filteredUtxos;
  }

  // Track the latest unconfirmed tx for pipelined updates
  setLastIdentityTx(txid, rawHex, blockHeight) {
    this.lastIdentityTx = { txid, rawHex, blockHeight };
  }

  /**
   * Store a single move on-chain for a given chessboard identity.
   * @param {object} moveObj
   * @param {number} maxRetries
   * @param {string} boardKey - "chessboard1" or "chessboard2"
   */
  async storeMoveOnChain(moveObj, maxRetries = 3) {
    // Helper to check if a txid is confirmed or in mempool
    async function isTxConfirmedOrInMempool(txid) {
      try {
        const rawTx = await VerusdRpc.getRawTransaction(txid, 1);
        if (rawTx && rawTx.result && rawTx.result.confirmations && rawTx.result.confirmations > 0) {
          return 'confirmed';
        }
      } catch (e) {
        // Not confirmed, check mempool
        try {
          const mempoolEntry = await VerusdRpc.instance.post('/', {
            method: 'getmempoolentry',
            params: [txid],
            id: 1,
            jsonrpc: '2.0'
          });
          if (mempoolEntry && mempoolEntry.data && mempoolEntry.data.result) {
            return 'mempool';
          }
        } catch (e2) {
          // Not in mempool
        }
      }
      return 'missing';
    }

    let keys
    keys = await logIdentityContentMultimapKeys();

    const identityName = process.env.VERUS_SIGNING_ID || process.env.VERUS_SIGNING_IDENTITY;
    const SIGNING_WIF = process.env.VERUS_SIGNING_WIF || process.env.VERUS_SIGNING_KEY;
    const verusId = this.verusId;
    if (!identityName || !SIGNING_WIF) throw new Error('Missing VERUS_SIGNING_ID or VERUS_SIGNING_WIF in environment');

    // --- DIAGNOSTICS: will check mempool/UTXOs after we fetch the identity and changeAddress ---

    // Fetch identity from chain for the first tx, or use last unconfirmed for chaining
    let identityResp, identity, changeAddress, parentRawHex, parentBlockHeight;
    // Removed duplicate vdxfKey declaration
    identityResp = await verusId.interface.getIdentity(identityName);
    if (!identityResp.result) throw new Error(`Identity not found: ${identityName}`);
    identity = identityResp.result;
    changeAddress = identity.identity.primaryaddresses[0];
    try {
      const mempoolDiag = await VerusdRpc.getAddressMempool({ addresses: [changeAddress] });
      console.log(`[DIAG] Mempool for ${changeAddress}:`, mempoolDiag.result);
    } catch (diagErr) {
      console.warn(`[DIAG] Error during mempool diagnostics for ${changeAddress}:`, diagErr);
    }
    let useChaining = false;
    if (this.lastIdentityTx) {
      const parentTxid = this.lastIdentityTx.txid;
      const parentStatus = await isTxConfirmedOrInMempool(parentTxid);
      if (parentStatus === 'confirmed' || parentStatus === 'mempool') {
        parentRawHex = this.lastIdentityTx.rawHex;
        parentBlockHeight = this.lastIdentityTx.blockHeight;
        useChaining = true;
      } else {
        parentRawHex = await this.getRawTransaction(identity);
        parentBlockHeight = identity.blockheight;
        this.setLastIdentityTx(identity.txid, parentRawHex, parentBlockHeight);
        useChaining = false;
      }
    } else {
      parentRawHex = await this.getRawTransaction(identity);
      parentBlockHeight = identity.blockheight;
      this.setLastIdentityTx(identity.txid, parentRawHex, parentBlockHeight);
    }

    let moveData = null;
    let vdxfKey = DATA_TYPE_STRING.vdxfid;
    let identityObj = null;
    let logObj = {
      move: moveObj,
      identity: identityName,
      time: new Date().toISOString()
    };
    let attempt = 0;
    let lastError = null;
    while (attempt < 2) { // try up to 2 times: initial + after mempool clear
      try {
        moveData = Buffer.from(JSON.stringify(moveObj)).toString('base64');
        const vdxfUniValue = { [DATA_TYPE_STRING.vdxfid]: moveData };
        const contentmultimap = {
          ...(identity.identity.contentmultimap),
          [vdxfKey]: [
            ...(identity.identity.contentmultimap[vdxfKey] || []),
            vdxfUniValue
          ]
        };
        const identityJson = { ...identity.identity, contentmultimap };
        console.log('[DEBUG] contentmultimap:', contentmultimap);
        console.log('[DEBUG] identityJson:', identityJson);
        identityObj = Identity.fromJson(identityJson);
        if (!identityObj) {
          console.error('[ERROR] Failed to create Identity object from JSON:', identityJson);
          throw new Error('Failed to create Identity object from JSON');
        }
        // Refresh UTXO and mempool state before attempt
        let utxos = await this.getAllUtxos(changeAddress);
        if (utxos.length === 0) throw new Error('No spendable UTXOs available for ' + changeAddress);
        // Always mark selected UTXO as used immediately after selection
        const selectedUtxo = utxos[0];
        if (selectedUtxo) {
          this.usedUtxos.add(`${selectedUtxo.txid}:${selectedUtxo.outputIndex}`);
        }

        // Use only the selected UTXO for this attempt
        const utxoForTx = [selectedUtxo];
        const updateResult = await verusId.createUpdateIdentityTransaction(
          identityObj,
          changeAddress,
          parentRawHex,
          parentBlockHeight,
          utxoForTx,
          SYSTEM_ID,
          0.00450
        );

        // Only mark UTXOs as spent after successful broadcast
        // Set vdxfKey if available
        if (updateResult && updateResult.vdxfKey) {
            vdxfKey = updateResult.vdxfKey;
        }

        const privateKeyArrays = [];
        for (let i = 0; i < updateResult.utxos.length; i++) {
          privateKeyArrays.push([SIGNING_WIF]);
        }
        const signedTx = verusId.signUpdateIdentityTransaction(
          updateResult.hex,
          updateResult.utxos,
          privateKeyArrays
        );

        let broadcastResult;
        try {
          broadcastResult = await verusId.interface.sendRawTransaction(signedTx);
        } catch (primaryError) {
          try {
            const fallbackResp = await VerusdRpc.sendRawTransaction(signedTx);
            broadcastResult = fallbackResp.data;
          } catch (fallbackError) {
            logObj.error = {
              type: 'fallback',
              message: fallbackError.message,
              stack: fallbackError.stack,
              response: fallbackError.response && fallbackError.response.data
            };
            logTxToFile(logObj);
            lastError = fallbackError;
            throw fallbackError;
          }
        }
        if (broadcastResult.result) {
          // Mark UTXOs as spent for pipelined updates
          for (const u of updateResult.utxos) {
            this.spentUtxos.add(`${u.txid}:${u.outputIndex}`);
          }
          logObj.result = broadcastResult.result;
          logObj.status = 'broadcasted';
          logTxToFile(logObj);

          // Update lastIdentityTx for next pipelined update
          this.setLastIdentityTx(broadcastResult.result, updateResult.hex, parentBlockHeight);

          return {
            success: true,
            transactionId: broadcastResult.result,
            vdxfKey,
            moveHash: BlockchainMoveStorageBasic.hashMove(moveObj),
            identityAddress: identityObj.getIdentityAddress(),
            compactSize: moveData.length
          };
        } else {
          const errorMsg = broadcastResult && broadcastResult.error && broadcastResult.error.message
            ? broadcastResult.error.message
            : 'Broadcast failed';
          logObj.status = 'broadcast_failed';
          logObj.broadcastResult = broadcastResult;
          logObj.error = errorMsg;
          logTxToFile(logObj);
          lastError = new Error(errorMsg);
          throw lastError;
        }
      } catch (err) {
        logObj.status = 'exception';
        logObj.error = err && err.message;
        logObj.stack = err && err.stack;
        logTxToFile(logObj);
        lastError = err;
        if (attempt === 0) {
          // First failure, clear mempool and retry
          await clearRawMempool();
          attempt++;
          continue;
        } else {
          // Second failure, return error
          return {
            success: false,
            error: err && err.message,
            vdxfKey,
            moveHash: BlockchainMoveStorageBasic.hashMove(moveObj),
            identityAddress: identityObj ? identityObj.getIdentityAddress() : null,
            compactSize: moveData.length
          };
        }
      }
    }
  }

  /**
   * Store a move on-chain, alternating between chessboard1 and chessboard2 identities.
   * @param {object} moveObj - The move object to store.
   * @param {number} moveIndex - The index of the move (used to alternate identities).
   * @returns {Promise<object>} Result of storing the move.
   */
  async storeMoveAlternatingIdentities(moveObj, moveIndex) {
    // Keep API compatible: previously alternated identities; now always use the single configured identity.
    return await this.storeMoveOnChain(moveObj, 3);
  }
}

async function storeMoveOnChainWithRetryBasic(moveObj, maxRetries = 3) {
  const storage = new BlockchainMoveStorageBasic();
  return storage.storeMoveOnChain(moveObj, maxRetries);
}

module.exports = {
  BlockchainMoveStorageBasic,
  storeMoveOnChainWithRetryBasic
};
