/**
 * Provisional Google Wallet LoyaltyClass. Branding is editable before launch.
 * No customers or passes are issued by constructing this object.
 * The original Bellaquitas logo is used until a final PNG is published.
 */
const FALLBACK_LOGO="https://raw.githubusercontent.com/trabajoia410-boop/bellaquitasweb/main/assets/logo-bellaquitas.webp";
const DOMAIN="https://bellaquitas.fr";
export function buildBellaquitasGoogleLoyaltyClass(issuerId,program={}){
 if(typeof issuerId!=="string"||!/^[0-9]{6,25}$/.test(issuerId))
  throw Error("Invalid Google Wallet issuer");
 const name=String(program?.name||"Bellaquitas Fest").trim().slice(0,75)||"Bellaquitas Fest";
 const logo=typeof program?.logo_url==="string"&&
  /^\/assets\/[a-zA-Z0-9/_-]+\.png$/.test(program.logo_url)?
  DOMAIN+program.logo_url:FALLBACK_LOGO;
 return {
  id:issuerId+".bellaquitas_fest",
  issuerName:"Bellaquitas Fest",
  programName:name,
  reviewStatus:"UNDER_REVIEW",
  hexBackgroundColor:"#1E1424",
  accountNameLabel:"Nombre",
  accountIdLabel:"Tarjeta",
  programLogo:{sourceUri:{uri:logo},contentDescription:{
   defaultValue:{language:"es-ES",value:"Logotipo de Bellaquitas Fest"}}},
  homepageUri:{uri:DOMAIN}
 };
}
