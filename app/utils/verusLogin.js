import { VerusIdInterface, primitives } from 'verusid-ts-client';
import { setProcessedChallenges } from '@/app/utils/database.js';
import { VerusdRpcInterface } from 'verusd-rpc-ts-client';

require('dotenv').config();

const VERUS_RPC_NETWORK = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;
const SYSTEM_ID = process.env.TESTNET == 'true' ? "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq" : "i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV";

const VerusId = new VerusIdInterface(SYSTEM_ID, VERUS_RPC_NETWORK);
const VerusdRpc = new VerusdRpcInterface(SYSTEM_ID, VERUS_RPC_NETWORK);

const verusLogin = async (data, userId) => {
    try {
        // Parse the LoginConsentResponse 
        const loginConsentResponse = new primitives.LoginConsentResponse(data);
        console.log('Login Consent Response:', loginConsentResponse);

        // Check if the redirect URI contains the correct user ID
        const redirectUri = loginConsentResponse.decision.request.challenge.redirect_uris[0].uri;
        if (redirectUri.indexOf(userId) === -1) {
            throw new Error("Wrong userID for challenge");
        }

        const signingId = loginConsentResponse.signing_id;
        console.log('signingid', signingId);

        const success = await VerusId.verifyLoginConsentResponse(loginConsentResponse);
 
        if (!success) {
            throw new Error("Signature does not match");
        }

        // Store the processed challenge
        setProcessedChallenges(userId, loginConsentResponse);
        console.log(`Saved Challenges for ${userId}`);

        // Create or update user in database
        const userData = {
            verified: true,
            signingid: signingId,
            timestamp: Math.floor(Date.now() / 1000)
        };

        // You might want to update this to use your database instead of the old file system
        // For now, we'll just return success
        console.log(`User ${userId} verified successfully`);

        return {
            success: true,
            signingId: signingId,
            userId: userId
        };

    } catch (error) {
        console.log('Verus login error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Get VerusID identity info by i-address using VerusdRpcInterface
const getIdentity = async (verusId) => {
    try {
        const identityResp = await VerusdRpc.getIdentity(verusId);
        return identityResp.result;
    } catch (error) {
        console.error('Error fetching identity:', error);
        return null;
    }
};

const _verusLogin = verusLogin;
export { _verusLogin as verusLogin, getIdentity };