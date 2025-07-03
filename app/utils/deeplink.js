import { VerusIdInterface, primitives } from 'verusid-ts-client';
import { randomBytes } from 'crypto';
import { I_ADDR_VERSION } from 'verus-typescript-primitives/dist/constants/vdxf.js';
import 'dotenv/config';


function generateChallengeID(len = 20) {
  const buf = randomBytes(len)
  const password = Buffer.from(buf)
  const iaddress = primitives.toBase58Check(password, I_ADDR_VERSION)
  return iaddress
}

const VERUS_RPC_NETWORK = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;
const VERUS_RPC_SYSTEM = process.env.VERUS_RPC_SYSTEM;
const VerusId = new VerusIdInterface(VERUS_RPC_SYSTEM, VERUS_RPC_NETWORK);

const VERUS_LOGIN_IADDRESS = process.env.TESTNET == 'true'
  ? process.env.VERUS_LOGIN_IADDRESS
  : process.env.MAINNET_VERUS_LOGIN_IADDRESS;

const LOGIN_URL = process.env.TESTNET == 'true'
  ? process.env.TESTNET_LOGIN_URL
  : process.env.MAINNET_LOGIN_URL;

if (!LOGIN_URL) {
  console.log(`LOGIN_URL: ${LOGIN_URL}`);
  throw new Error('LOGIN_URL is not set in the environment variables!');
}

const VERUS_SIGNING_WIF = process.env.TESTNET == 'true'
  ? process.env.VERUS_SIGNING_WIF
  : process.env.MAINNET_VERUS_LOGIN_WIF;

if (!VERUS_SIGNING_WIF) {
  console.log(`VERUS_SIGNING_WIF: ${VERUS_SIGNING_WIF}`);
  throw new Error('VERUS_SIGNING_WIF is not set in the environment variables!');
}

if (!VERUS_LOGIN_IADDRESS) {
  console.log(`VERUS_LOGIN_IADDRESS: ${VERUS_LOGIN_IADDRESS}`);
  throw new Error('VERUS_LOGIN_IADDRESS is not set in the environment variables!');
}

// Validate I-address format
if (!VERUS_LOGIN_IADDRESS.startsWith('i')) {
  throw new Error('VERUS_LOGIN_IADDRESS must be a valid I-address starting with "i"');
}

console.log('Environment Configuration:');
console.log('  TESTNET:', process.env.TESTNET);
console.log('  VERUS_LOGIN_IADDRESS:', VERUS_LOGIN_IADDRESS);
console.log('  VERUS_SIGNING_WIF format:', VERUS_SIGNING_WIF.substring(0, 10) + '...');
console.log('  LOGIN_URL:', LOGIN_URL);
console.log('  VERUS_RPC_SYSTEM:', VERUS_RPC_SYSTEM);

// Prisma-based shortener
const shortenUrl = async (longUrl) => {
  return await createShortUrl(longUrl);
};

// Login DEEPLINK
const getverified = async () => {
  try {
    const challenge_id = generateChallengeID();
    const response = await VerusId.createLoginConsentRequest(
      VERUS_LOGIN_IADDRESS,
      new primitives.LoginConsentChallenge({
        challenge_id: challenge_id,
        requested_access: [
          new primitives.RequestedPermission(primitives.IDENTITY_VIEW.vdxfid),
        ],
        redirect_uris: [ new primitives.RedirectUri(
          `${LOGIN_URL}/api/login/verify?id=${challenge_id}`,
          primitives.LOGIN_CONSENT_WEBHOOK_VDXF_KEY.vdxfid
        )],
        created_at: Number((Date.now() / 1000).toFixed(0)),
      }),
      VERUS_SIGNING_WIF
    );
    if (!response || typeof response.toWalletDeeplinkUri !== 'function') {
      throw new Error('Invalid response from createLoginConsentRequest');
    }
    const deeplink = response.toWalletDeeplinkUri();

    return { deeplink, challenge_id };
  } catch (e) {
    console.log('Error in getverified:', e);
    throw e;
  }
};

const _getverified = getverified;
export { _getverified as getverified, shortenUrl };