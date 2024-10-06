import { VerusIdInterface, primitives } from 'verusid-ts-client';


//require('dotenv').config();

const VERUS_RPC_NETWORK = process.env.TESTNET == 'true' ? process.env.TESTNET_VERUS_RPC_NETWORK : process.env.MAINNET_VERUS_RPC_NETWORK
const SYSTEM_ID = process.env.TESTNET == 'true' ? "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq" : "i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV";


const VerusId = new VerusIdInterface(SYSTEM_ID, VERUS_RPC_NETWORK);


const verusLogin = async (req,res) => {
    try {
        const data = req.body;

                // Parse the LoginConsentResponse 
                const loginConsentResponse = new primitives.LoginConsentResponse(data);
                console.log('Login Consent Response:', loginConsentResponse);

                if(loginConsentResponse.decision.request.challenge.redirect_uris[0].uri.indexOf(usersId) == -1){
                    throw new Error("Wrong userID for challenge")
                }

                const signingId = loginConsentResponse.signing_id;
                console.log('signingid', signingId);

                const success = await VerusId.verifyLoginConsentResponse(loginConsentResponse);
 
                if (!success) {
                    throw new Error("Signature does not match");
                }

                setProcessedChallenges(usersId, loginConsentResponse);
                console.log(`Saved Challenges for ${usersId}`);

                setDiscordUsers(usersDiscordId, {
                    verified: true,
                    username: member.user.username,
                    discrminator: member.user.discrminator,
                    signingid: signingId,
                    timestamp: Math.floor(Date.now() / 1000)
                });


    } catch (error) {
        console.log(error)
    }
}

const _verusLogin = verusLogin;
export { _verusLogin as verusLogin };