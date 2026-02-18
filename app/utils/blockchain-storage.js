const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { VerusIdInterface } = require('verusid-ts-client');
const { VerusdRpcInterface } = require('verusd-rpc-ts-client');
const { Identity } = require('verus-typescript-primitives/dist/pbaas');
const { ChessGame } = require('../../ChessGame.js');
const { DATA_TYPE_STRING } = require('verus-typescript-primitives/dist/vdxf/keys');

const SYSTEM_ID = process.env.TESTNET === 'true'
  ? 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
  : 'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV';

const VERUS_RPC_NETWORK = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;

// Create RPC interface for UTXO queries
const VerusdRpc = new VerusdRpcInterface(SYSTEM_ID, VERUS_RPC_NETWORK);

const identityName = process.env.VERUS_SIGNING_ID;

// Shared state for tracking transactions across instances
let lastIdentityTx = null; // { txid, rawHex, blockHeight }
let spentUtxos = new Set();
let usedUtxos = new Set();

async function clearRawMempool() {
  const url = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;
  try {
    const response = await axios.post(url, {
      method: 'clearrawmempool',
      params: [],
      id: 1,
      jsonrpc: '2.0'
    });
    console.log('[STORAGE] clearrawmempool response:', response.data);
    return response.data;
  } catch (err) {
    console.error('[STORAGE] Error clearing mempool:', err.response ? err.response.data : err.message);
    throw err;
  }
}

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
    console.error('[STORAGE] Failed to write tx log (cwd):', e);
    try {
      writeToValidJson(fallbackPath);
    } catch (e2) {
      console.error('[STORAGE] Fallback log write also failed:', e2);
    }
  }
}

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

class BlockchainStorage {
  constructor() {
    this.verusId = new VerusIdInterface(SYSTEM_ID, VERUS_RPC_NETWORK);
  }

  /**
   * Get raw transaction hex from transaction ID
   * @param {Object} identity - Identity object with txid property
   * @returns {Promise<string>} Raw transaction hex
   */
  async getRawTransaction(identity) {
    try {
      const txResponse = await VerusdRpc.getRawTransaction(identity.txid);
      if (!txResponse.result) throw new Error('No raw transaction hex returned');
      return txResponse.result;
    } catch (error) {
      console.log('[STORAGE] Could not get raw transaction hex, using transaction ID');
      return identity.txid; // Fallback to transaction ID
    }
  }

  /**
   * Get all UTXOs for an address, filtering out spent ones
   * @param {string} address - Address to get UTXOs for
   * @returns {Promise<Array>} Filtered UTXOs
   */
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
    
    // Filter out UTXOs already used in pending txs, referenced in mempool as spending, or already marked as used
    const filteredUtxos = allUtxos.filter(u =>
      u.satoshis > 0 &&
      u.isspendable === 1 &&
      !spentUtxos.has(`${u.txid}:${u.outputIndex}`) &&
      !mempoolSpentSet.has(`${u.txid}:${u.outputIndex}`) &&
      !usedUtxos.has(`${u.txid}:${u.outputIndex}`)
    );
    
    console.log(`[STORAGE][getAllUtxos] mempoolSpentSet:`, Array.from(mempoolSpentSet));
    console.log(`[STORAGE][getAllUtxos] spendableUtxos: ${filteredUtxos.length}`);
    filteredUtxos.forEach((u, idx) => {
      console.log(`  [${idx}] txid: ${u.txid}, outputIndex: ${u.outputIndex}, satoshis: ${u.satoshis}`);
    });
    
    return filteredUtxos;
  }

  /**
   * Check if a txid is confirmed or in mempool
   */
  async isTxConfirmedOrInMempool(txid) {
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

  /**
   * Store completed chess game on blockchain using compact ChessGame VDXF format
   * @param {Object} gameData - Game data from database
   * @param {Array} moves - Array of chess moves
   * @returns {Promise<Object>} Storage result
   */
  async storeCompletedGame(gameData, moves) {
    console.log('[STORAGE] storeCompletedGame called for gameId:', gameData.id, 'at', new Date().toISOString());
    
    const logObj = {
      gameId: gameData.id,
      time: new Date().toISOString()
    };
    
    let attempt = 0;
    let lastError = null;
    
    while (attempt < 2) { // Try up to 2 times: initial + after mempool clear
      try {
        const keys = await logIdentityContentMultimapKeys();
        console.log('[STORAGE][VDXF] Current contentmultimap keys:', keys);
        console.log('[STORAGE] === CREATING CHESSGAME OBJECT ===');
        
        // Create ChessGame VDXF object 
        const chessGame = new ChessGame(
          gameData.id,
          gameData.whitePlayer.verusId || gameData.whitePlayer.displayName,
          gameData.blackPlayer.verusId || gameData.blackPlayer.displayName,
          gameData.winner || "",
          gameData.status || "completed",
          moves, 
          gameData.timestamp || new Date().toISOString()
        );

        console.log('[STORAGE] ChessGame object created successfully');
        console.log('[STORAGE] ChessGame hash:', chessGame.hash);
 
        chessGame.vdxfkey = DATA_TYPE_STRING.vdxfid;
        
        if (!identityName) {
          throw new Error('VERUS_SIGNING_ID environment variable not set');
        }

        // Fetch identity from chain for the first tx, or use last unconfirmed for chaining
        let identityResp, identity, changeAddress, parentRawHex, parentBlockHeight;
        
        identityResp = await this.verusId.interface.getIdentity(identityName);
        if (!identityResp.result) throw new Error(`Identity not found: ${identityName}`);
        
        identity = identityResp.result;
        changeAddress = identity.identity.primaryaddresses[0];
        
        let useChaining = false;
        if (lastIdentityTx) {
          // Check parent tx status
          const parentTxid = lastIdentityTx.txid;
          const parentStatus = await this.isTxConfirmedOrInMempool(parentTxid);
          console.log(`[STORAGE] Parent tx ${parentTxid} status: ${parentStatus}`);
          
          if (parentStatus === 'confirmed' || parentStatus === 'mempool') {
            parentRawHex = lastIdentityTx.rawHex;
            parentBlockHeight = lastIdentityTx.blockHeight;
            useChaining = true;
            console.log('[STORAGE] Using transaction chaining');
          } else {
            parentRawHex = await this.getRawTransaction(identity);
            parentBlockHeight = identity.blockheight;
            lastIdentityTx = { txid: identity.txid, rawHex: parentRawHex, blockHeight: parentBlockHeight };
            useChaining = false;
            console.log('[STORAGE] Parent tx missing, resetting to confirmed identity');
          }
        } else {
          parentRawHex = await this.getRawTransaction(identity);
          parentBlockHeight = identity.blockheight;
          lastIdentityTx = { txid: identity.txid, rawHex: parentRawHex, blockHeight: parentBlockHeight };
          console.log('[STORAGE] First transaction, using confirmed identity');
        }
        
        // Create VdxfUniValue with the serialized data
        const serializedData = chessGame.toCompactBuffer();
        const base64Data = serializedData.toString('base64');
        
        const vdxfUniValue = {
          [DATA_TYPE_STRING.vdxfid]: base64Data
        };
        
        const contentmultimap = {
          [chessGame.vdxfkey]: [vdxfUniValue]
        };
        
        // Create updated identity with contentmultimap
        const identityJson = {
          ...identity.identity,
          contentmultimap: contentmultimap
        };
        
        // Create Identity object
        const identityObj = Identity.fromJson(identityJson);
        if (!identityObj) {
          console.error('[STORAGE][ERROR] Failed to create Identity object from JSON:', identityJson);
          throw new Error('Failed to create Identity object from JSON');
        }
        
        // Refresh UTXO and mempool state before attempt
        let utxos = await this.getAllUtxos(changeAddress);
        if (utxos.length === 0) throw new Error('No spendable UTXOs available');
        
        // Always mark selected UTXO as used immediately after selection
        const selectedUtxo = utxos[0];
        if (selectedUtxo) {
          usedUtxos.add(`${selectedUtxo.txid}:${selectedUtxo.outputIndex}`);
          console.log(`[STORAGE] Selected and marked UTXO: ${selectedUtxo.txid}:${selectedUtxo.outputIndex}`);
        }

        // Use only the selected UTXO for this attempt
        const utxoForTx = [selectedUtxo];
        
        console.log('[STORAGE] Creating update transaction...');
        
        const updateResult = await this.verusId.createUpdateIdentityTransaction(
          identityObj,
          changeAddress,
          parentRawHex,
          parentBlockHeight,
          utxoForTx,
          SYSTEM_ID,
          0.00450 // Higher fee to match basic.js
        );
        
        console.log('[STORAGE] Update transaction created successfully!');
        console.log('[STORAGE] Transaction hex length:', updateResult.hex.length);
        
        // Log ChessGame information
        console.log(`[STORAGE] ChessGame VDXF data: ${chessGame.toString()}`);
        console.log(`[STORAGE] VDXF Key: ${chessGame.vdxfkey}`);
        console.log(`[STORAGE] Serialized size: ${chessGame.toCompactBuffer().length} bytes`);
        console.log(`[STORAGE] JSON size: ${JSON.stringify(chessGame.toJSON()).length} bytes`);
        
        // Sign the transaction
        console.log('[STORAGE] Signing transaction...');
        
        // Get the signing WIF key
        const SIGNING_WIF = process.env.VERUS_SIGNING_WIF;
        if (!SIGNING_WIF) {
          throw new Error('VERUS_SIGNING_WIF environment variable not set');
        }
        
        // Create signature arrays for each UTXO 
        const privateKeyArrays = [];
        for (let i = 0; i < updateResult.utxos.length; i++) {
          privateKeyArrays.push([SIGNING_WIF]);
        }

        const signedTx = this.verusId.signUpdateIdentityTransaction(
          updateResult.hex,
          updateResult.utxos,
          privateKeyArrays
        );
        
        console.log('[STORAGE] Transaction signed successfully!');
        
        let broadcastResult;
        try {
          broadcastResult = await this.verusId.interface.sendRawTransaction(signedTx);
        } catch (primaryError) {
          console.log('[STORAGE] Primary broadcast error:', primaryError.message);
          
          try {
            const fallbackResp = await VerusdRpc.instance.post('/', {
              method: 'sendrawtransaction',
              params: [signedTx],
              id: 1,
              jsonrpc: '2.0'
            });
            broadcastResult = fallbackResp.data;
            console.log('[STORAGE] Fallback broadcast method used');
          } catch (fallbackError) {
            console.log('[STORAGE] Fallback broadcast also failed:', fallbackError.message);
            
            // Check if it's a double-spend or "already in chain" error
            const errorMsg = fallbackError.message.toLowerCase();
            if (
              errorMsg.includes('already in chain') ||
              errorMsg.includes('already in mempool') ||
              errorMsg.includes('transaction already exists') ||
              errorMsg.includes('double spend') ||
              errorMsg.includes('txn-mempool-conflict')
            ) {
              console.warn('[STORAGE] Transaction already in chain/mempool, treating as success');
              
              logObj.status = 'already_in_chain';
              logObj.message = 'Transaction already exists';
              logTxToFile(logObj);
              
              return {
                success: true,
                transactionId: 'ALREADY_IN_CHAIN',
                vdxfKey: chessGame.vdxfkey,
                gameHash: chessGame.hash,
                identityAddress: identityObj.getIdentityAddress(),
                compactSize: chessGame.toCompactBuffer().length,
                message: 'Transaction already in chain or mempool'
              };
            }
            
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
          console.log('[STORAGE] SUCCESS! Transaction broadcast successfully!');
          console.log('[STORAGE] Transaction ID:', broadcastResult.result);
          console.log('[STORAGE] VDXF Key:', chessGame.vdxfkey);
          console.log('[STORAGE] Game Hash:', chessGame.hash);
          
          // Mark UTXOs as spent for pipelined updates
          for (const u of updateResult.utxos) {
            spentUtxos.add(`${u.txid}:${u.outputIndex}`);
          }
          
          // Update lastIdentityTx for next pipelined update
          lastIdentityTx = { txid: broadcastResult.result, rawHex: updateResult.hex, blockHeight: parentBlockHeight };
          
          logObj.result = broadcastResult.result;
          logObj.status = 'broadcasted';
          logObj.vdxfKey = chessGame.vdxfkey;
          logTxToFile(logObj);
          
          return {
            success: true,
            transactionId: broadcastResult.result,
            vdxfKey: chessGame.vdxfkey,
            gameHash: chessGame.hash,
            identityAddress: identityObj.getIdentityAddress(),
            compactSize: chessGame.toCompactBuffer().length
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
        console.error('[STORAGE] Exception:', err.message);
        logObj.status = 'exception';
        logObj.error = err && err.message;
        logObj.stack = err && err.stack;
        logTxToFile(logObj);
        lastError = err;
        
        if (attempt === 0) {
          // First failure, clear mempool and retry
          console.log('[STORAGE] First attempt failed, clearing mempool and retrying...');
          await clearRawMempool();
          attempt++;
          continue;
        } else {
          // Second failure, return error
          console.error('[STORAGE] Second attempt failed, giving up');
          return {
            success: false,
            error: err && err.message
          };
        }
      }
    }
    
    // If we get here, all attempts failed
    return {
      success: false,
      error: lastError && lastError.message || 'All attempts failed'
    };
  }

  /**
   * Retrieve chess game from blockchain
   * @param {string} gameId - Game identifier
   * @returns {Promise<Object>} Game data
   */
  async getGameFromChain(gameId) {
    try {
      const identityName = process.env.VERUS_SIGNING_ID;
      if (!identityName) {
        throw new Error('VERUS_SIGNING_ID environment variable not set');
      }

      const identityResp = await this.verusId.interface.getIdentity(identityName);
      if (!identityResp.result) {
        throw new Error(`Identity not found: ${identityName}`);
      }
      
      const identity = identityResp.result;
      const vdxfKey = `chessgame.${gameId}`;
      
      if (!identity.identity.contentmap || !identity.identity.contentmap[vdxfKey]) {
        throw new Error(`Game not found on blockchain: ${gameId}`);
      }
      
      // Decode from base64 and deserialize
      const gameBuffer = Buffer.from(identity.identity.contentmap[vdxfKey], 'base64');
      const chessGame = ChessGame.fromCompactBuffer(gameBuffer);
      
      return {
        success: true,
        gameData: chessGame.toJSON(),
        identityAddress: identity.identity.identityaddress
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = { BlockchainStorage };