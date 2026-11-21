/**
 * Read Google Wallet credentials from one Worker Secret containing the original
 * service-account JSON (preferred), or from legacy split secrets.
 * Never return keys to public API responses or logs.
 */
const emailValid=value=>typeof value==="string"&&
 /^[\w.-]+@[\w.-]+\.iam\.gserviceaccount\.com$/.test(value);
const pemValid=value=>typeof value==="string"&&value.includes("-----BEGIN "+"PRIVATE KEY-----")&&
 value.includes("-----END "+"PRIVATE KEY-----");
export function googleWalletCredentials(env){
 const issuer=env?.WALLET_GOOGLE_ISSUER_ID;
 const expectedEmail=env?.WALLET_GOOGLE_CLIENT_EMAIL;
 if(typeof issuer!=="string"||!/^[0-9]{6,25}$/.test(issuer)||!emailValid(expectedEmail))return null;
 let client=expectedEmail,pem=env?.WALLET_GOOGLE_PRIVATE_KEY;
 if(env?.WALLET_GOOGLE_SERVICE_ACCOUNT_JSON!==undefined){
  const raw=env.WALLET_GOOGLE_SERVICE_ACCOUNT_JSON;
  if(typeof raw!=="string"||raw.length<100||raw.length>10000)return null;
  let account;try{account=JSON.parse(raw);}catch{return null;}
  if(!account||account.type!=="service_account"||!emailValid(account.client_email)||
     account.client_email!==expectedEmail||!pemValid(account.private_key))return null;
  client=account.client_email;pem=account.private_key;
 }
 if(!pemValid(pem))return null;
 return {issuer,client,pem};
}
