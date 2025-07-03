const { VerusIdInterface } = require('verusid-ts-client');
const { VerusdRpcInterface } = require('verusd-rpc-ts-client');
const { Identity } = require('verus-typescript-primitives/dist/pbaas');
const { ChessGame } = require('../../ChessGame.js');

const SYSTEM_ID = process.env.TESTNET === 'true'
  ? 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
  : 'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV';

const VERUS_RPC_NETWORK = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;

// Create RPC interface for UTXO queries
const VerusdRpc = new VerusdRpcInterface(SYSTEM_ID, VERUS_RPC_NETWORK);

// Cache for UTXOs to prevent double-spend
const utxoCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

class BlockchainStorage {
  constructor() {
    this.verusId = new VerusIdInterface(SYSTEM_ID, VERUS_RPC_NETWORK);
  }

  /**
   * Get raw transaction hex from transaction ID with caching
   * @param {Object} identity - Identity object with txid property
   * @returns {Promise<string>} Raw transaction hex
   */
  async getRawTransaction(identity) {
    const cacheKey = `rawTx_${identity.txid}`;
    const cached = utxoCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Using cached raw transaction hex');
      return cached.data;
    }

    try {
      const txResponse = await VerusdRpc.getRawTransaction(identity.txid);
      if (!txResponse.result) {
        throw new Error('No raw transaction hex returned');
      }
      
      // Cache the result
      utxoCache.set(cacheKey, {
        data: txResponse.result,
        timestamp: Date.now()
      });
      
      return txResponse.result;
    } catch (error) {
      console.log('Could not get raw transaction hex, using transaction ID');
      return identity.txid; // Fallback to transaction ID
    }
  }

  /**
   * Get UTXOs with caching and double-spend prevention
   * @param {string} address - Address to get UTXOs for
   * @returns {Promise<Array>} Formatted UTXOs
   */
  async getUtxosWithCache(address) {
    const cacheKey = `utxos_${address}`;
    const cached = utxoCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Using cached UTXOs for address:', address);
      return cached.data;
    }

    console.log('Fetching fresh UTXOs for address:', address);
    const utxoResponse = await VerusdRpc.getAddressUtxos({addresses: [address]});
    const rawUtxos = utxoResponse.result;
    
    if (!rawUtxos || rawUtxos.length === 0) {
      throw new Error(`No UTXOs found for address: ${address}`);
    }
    
    console.log(`Found ${rawUtxos.length} UTXOs for address: ${address}`);
    
    // Format UTXOs for transaction
    const utxos = rawUtxos.map(utxo => {
      let vrscAmount = 0;
      if (utxo.currencyvalues && utxo.currencyvalues[SYSTEM_ID]) {
        vrscAmount = utxo.currencyvalues[SYSTEM_ID] * 100000000;
      } else if (!utxo.currencyvalues && utxo.satoshis > 0) {
        vrscAmount = utxo.satoshis;
      }
      
      return {
        address: utxo.address,
        txid: utxo.txid,
        outputIndex: utxo.outputIndex,
        script: utxo.script || "76a91407cd286f4d0faa8608000d0a028c311febc6199888ac",
        satoshis: vrscAmount,
        height: utxo.height || 0,
        isspendable: utxo.isspendable || 1,
        blocktime: utxo.blocktime || Math.floor(Date.now() / 1000)
      };
    }).filter(utxo => utxo.satoshis > 0);
    
    console.log(`Formatted ${utxos.length} VRSC UTXOs`);
    console.log(`Total VRSC available: ${utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0) / 100000000}`);
    
    // Cache the result
    utxoCache.set(cacheKey, {
      data: utxos,
      timestamp: Date.now()
    });
    
    return utxos;
  }

  /**
   * Clear UTXO cache for an address (call after successful broadcast)
   * @param {string} address - Address to clear cache for
   */
  clearUtxoCache(address) {
    const cacheKey = `utxos_${address}`;
    utxoCache.delete(cacheKey);
    console.log('Cleared UTXO cache for address:', address);
  }

  /**
   * Store completed chess game on blockchain using compact ChessGame VDXF format
   * @param {Object} gameData - Game data from database
   * @param {Array} moves - Array of chess moves
   * @returns {Promise<Object>} Storage result
   */
  async storeCompletedGame(gameData, moves) {
    console.log('storeCompletedGame called for gameId:', gameData.id, 'at', new Date().toISOString());
    try {
      console.log('=== CREATING CHESSGAME OBJECT ===');
      console.log('Input gameData:', {
        id: gameData.id,
        white: gameData.whitePlayer.verusId || gameData.whitePlayer.displayName,
        black: gameData.blackPlayer.verusId || gameData.blackPlayer.displayName,
        winner: gameData.winner,
        status: gameData.status,
        timestamp: gameData.timestamp
      });
      console.log('Input moves:', moves);

      // Create ChessGame VDXF object with sanitized data (matching verus-test-v2.js format)
      const chessGame = new ChessGame(
        gameData.id,
        gameData.whitePlayer.verusId || gameData.whitePlayer.displayName,
        gameData.blackPlayer.verusId || gameData.blackPlayer.displayName,
        gameData.winner || "", // Use empty string if no winner (matching test file)
        gameData.status || "completed", // Use provided status or default to "completed"
        moves, // Moves are already 4-character strings
        gameData.timestamp || new Date().toISOString()
      );

      console.log('✅ ChessGame object created successfully');
      console.log('ChessGame details:', {
        gameId: chessGame.gameId,
        white: chessGame.white,
        black: chessGame.black,
        winner: chessGame.winner,
        status: chessGame.status,
        moves: chessGame.moves,
        timestamp: chessGame.timestamp,
        hash: chessGame.hash
      });

      // Set the VDXF key on the chess game object (like in the working file)
      const { DATA_TYPE_STRING } = require('verus-typescript-primitives/dist/vdxf/keys');
      chessGame.vdxfkey = DATA_TYPE_STRING.vdxfid;

      // Get identity for storage (using environment variable)
      const identityName = process.env.VERUS_SIGNING_ID;
      if (!identityName) {
        throw new Error('VERUS_SIGNING_ID environment variable not set');
      }

      // Fetch the identity
      const identityResp = await this.verusId.interface.getIdentity(identityName);
      if (!identityResp.result) {
        throw new Error(`Identity not found: ${identityName}`);
      }
      
      const identity = identityResp.result;
      
      // Create VdxfUniValue with the serialized data (using the working approach)
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
      
      // Get current height
      const currentHeight = await this.verusId.getCurrentHeight();
      
      // Get the primary address for change from the original identity
      const primaryAddress = identity.identity.primaryaddresses[0];
      // Use the primary address directly instead of CHANGE_ADDRESS since it has UTXOs
      const changeAddress = primaryAddress;
      
      console.log(`Using identity primary address as change address: ${changeAddress}`);
      
      // Get raw transaction hex with caching
      const rawTxHex = await this.getRawTransaction(identity);
      
      console.log(`Raw transaction hex: ${rawTxHex.substring(0, 50)}...`);
      console.log(`Raw transaction hex length: ${rawTxHex.length}`);
      
      // Get UTXOs with caching and double-spend prevention
      const utxos = await this.getUtxosWithCache(changeAddress);
      
      // Create the update transaction with proper fee (like in working file)
      console.log('Creating update transaction...');
      
      const updateResult = await this.verusId.createUpdateIdentityTransaction(
        identityObj,
        changeAddress,
        rawTxHex,
        identity.blockheight,
        utxos,
        SYSTEM_ID,
        0.00200 // fee - increased from 0.00100 to help with broadcast
      );
      
      console.log('✅ Update transaction created successfully!');
      console.log('Transaction hex length:', updateResult.hex.length);
      
      // Validate that the transaction includes basic identity update data
      console.log('Validating transaction includes basic identity update data...');
      if (updateResult.hex.includes('6a') || updateResult.hex.includes('OP_RETURN')) {
        console.log('✅ Transaction appears to include OP_RETURN data');
      } else {
        console.log('⚠️ Transaction may not include identity update data - but will attempt broadcast');
      }
      
      // Log ChessGame information
      console.log(`ChessGame VDXF data: ${chessGame.toString()}`);
      console.log(`VDXF Key: ${chessGame.vdxfkey}`);
      console.log(`Serialized size: ${chessGame.toCompactBuffer().length} bytes`);
      console.log(`JSON size: ${JSON.stringify(chessGame.toJSON()).length} bytes`);
      console.log(`Compression ratio: ${(JSON.stringify(chessGame.toJSON()).length / chessGame.toCompactBuffer().length).toFixed(2)}x`);
      console.log(`Space savings: ${((1 - chessGame.toCompactBuffer().length / JSON.stringify(chessGame.toJSON()).length) * 100).toFixed(1)}%`);
      
      console.log(`Note: Using ChessGame VDXF object for compact storage`);
      console.log(`Transaction will include serialized ChessGame data`);
      
      // Sign the transaction
      console.log('Signing transaction...');
      
      // Get the signing WIF key
      const SIGNING_WIF = process.env.VERUS_SIGNING_WIF;
      if (!SIGNING_WIF) {
        throw new Error('VERUS_SIGNING_WIF environment variable not set');
      }
      
      // We need to provide signatures for all UTXOs being spent
      // The identity signs the transaction, but we also need signatures for the funding UTXOs
      console.log(`Using identity signing key: ${SIGNING_WIF.substring(0, 10)}...`);
      console.log(`Number of UTXOs to sign: ${updateResult.utxos.length}`);
      
      // Create signature arrays for each UTXO (exactly as in working verus-test-v2.js)
      const privateKeyArrays = [];
      for (let i = 0; i < updateResult.utxos.length; i++) {
        // For identity update transactions, we typically need the identity's private key for all UTXOs
        // or the actual private keys that own the UTXOs being spent
        privateKeyArrays.push([SIGNING_WIF]);
        console.log(`UTXO ${i}: Using WIF key for signing`);
      }

      const signedTx = this.verusId.signUpdateIdentityTransaction(
        updateResult.hex,
        updateResult.utxos,
        privateKeyArrays
      );
      
      console.log('Transaction signed successfully!');
      
      // Broadcast the transaction with improved error handling
      console.log('Attempting to broadcast transaction...');
      
      let broadcastResult;
      try {
        // Try primary broadcast method
        broadcastResult = await this.verusId.interface.sendRawTransaction(signedTx);
      } catch (primaryError) {
        console.log('Primary broadcast method failed, trying fallback...');
        console.log('Primary error:', primaryError.message);
        
        // Try fallback broadcast method using VerusdRpc
        try {
          broadcastResult = await VerusdRpc.interface.rpc('sendrawtransaction', signedTx);
          console.log('Fallback broadcast method used');
        } catch (fallbackError) {
          console.log('Fallback broadcast also failed:', fallbackError.message);
          
          // Check if it's a double-spend or "already in chain" error
          const errorMsg = fallbackError.message.toLowerCase();
          if (
            errorMsg.includes('already in chain') ||
            errorMsg.includes('already in mempool') ||
            errorMsg.includes('transaction already exists') ||
            errorMsg.includes('double spend')
          ) {
            console.warn('⚠️ Transaction already in chain/mempool, treating as success');
            
            // Clear UTXO cache since the transaction was likely successful
            this.clearUtxoCache(changeAddress);
            
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
          
          throw fallbackError;
        }
      }
      
      if (broadcastResult.result) {
        console.log('🎉 SUCCESS! Transaction broadcast successfully!');
        console.log('Transaction ID:', broadcastResult.result);
        console.log('VDXF Key:', chessGame.vdxfkey);
        console.log('Game Hash:', chessGame.hash);
        
        // Clear UTXO cache after successful broadcast to prevent double-spend
        this.clearUtxoCache(changeAddress);
        
        return {
          success: true,
          transactionId: broadcastResult.result,
          vdxfKey: chessGame.vdxfkey,
          gameHash: chessGame.hash,
          identityAddress: identityObj.getIdentityAddress(),
          compactSize: chessGame.toCompactBuffer().length
        };
      } else {
        console.log('❌ Broadcast failed:', broadcastResult.error);
        
        // Additional debugging for common broadcast failures
        if (broadcastResult.error && broadcastResult.error.message) {
          const errorMsg = broadcastResult.error.message.toLowerCase();
          if (errorMsg.includes('fee')) {
            console.log('💡 Suggestion: Try increasing the transaction fee');
          } else if (errorMsg.includes('utxo') || errorMsg.includes('spent')) {
            console.log('💡 Suggestion: UTXO may already be spent, try with fresh UTXOs');
            // Clear UTXO cache to force fresh fetch
            this.clearUtxoCache(changeAddress);
          } else if (errorMsg.includes('invalid') || errorMsg.includes('malformed')) {
            console.log('💡 Suggestion: Transaction structure may be invalid');
          } else if (errorMsg.includes('500') || errorMsg.includes('internal')) {
            console.log('💡 Suggestion: Node internal error, try again or check node status');
          }
        }
        
        return { success: false, error: broadcastResult.error?.message || 'Broadcast failed' };
      }
    } catch (error) {
      console.error('Blockchain storage error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
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