import {googleWalletCredentials} from "./google-credentials.js";
/**
 * Native Wallet issuer readiness. All checks are explicit, fail closed and
 * disclose only yes/no capabilities (never service-account keys or certificates).
 *
 * The web QR card remains usable without Apple/Google. Issuer publishing
 * approval is separate from the global deployment switch.
 */
export function walletIssuerReadiness(env){
 const live=env?.SITE_MODE==="production"&&env?.PUBLISH_APPROVED==="yes"&&
  env?.WALLET_ENABLED==="yes"&&env?.WALLET_MODE==="real"&&
  env?.WALLET_REAL_APPROVED==="yes";
 const google=live&&env?.WALLET_GOOGLE_ISSUER_APPROVED==="yes"&&
  !!googleWalletCredentials(env);
 const apple=live&&env?.WALLET_APPLE_ISSUER_APPROVED==="yes"&&
  typeof env.APPLE_PASS_TYPE_ID==="string"&&
  /^pass\.[\w.-]+$/.test(env.APPLE_PASS_TYPE_ID)&&
  typeof env.APPLE_PASS_SIGNER?.fetch==="function"&&
  typeof env.APPLE_PUSH_BRIDGE?.fetch==="function"&&
  typeof env.WALLET_HMAC_KEY==="string"&&env.WALLET_HMAC_KEY.length>=32;
 return {google:!!google,apple:!!apple};
}
