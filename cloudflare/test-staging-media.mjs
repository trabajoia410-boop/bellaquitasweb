/**
 * Estado de streaming en staging después de retirar R2 el 13/11/2026.
 *
 * El Worker remoto actual NO se ha reemplazado aún. Debe fallar CERRADO
 * al pedir objetos que ya NO existen, sin servir HTML ni datos privados.
 *
 * Cuando se publique un candidato autorizado y sin R2, usar:
 * BELLAQUITAS_STAGING_MEDIA_EXPECT=redirect
 * para exigir redirección a los cinco MP4 originales de GitHub Pages.
 * Esta prueba jamás registra una visita ni modifica usuarios/puntos.
 */
import assert from "node:assert/strict";

const HOST="bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const base=new URL(process.env.BELLAQUITAS_STAGING_URL||"https://"+HOST);
assert.equal(base.hostname,HOST,"Solo staging");
const expected=process.env.BELLAQUITAS_STAGING_MEDIA_EXPECT||"r2-removed";
assert.ok(["r2-removed","redirect"].includes(expected),"Modo de prueba inválido");
const media=[
 ["Bellaquitas Fest para móvil.mp4",9072277],
 ["bellaquitas fiesta portada movil.mp4",2028873],
 ["bellaquitas fiesta portada.mp4",25437525],
 ["bellaquitas-fiesta-fondo 1.mp4",2071218],
 ["bellaquitas-fiesta-fondo.mp4",15545064]
];
for(const [name] of media){
 const path="/espejo/assets/"+encodeURIComponent(name);
 const url=new URL(path,base);
 for(const method of ["HEAD"]){
  const response=await fetch(url,{method,redirect:"manual",
   signal:AbortSignal.timeout(15000)});
  if(expected==="r2-removed"){
   assert.equal(response.status,503,name+": al eliminar R2, el Worker antiguo debe fallar cerrado");
   assert.equal(response.headers.get("location"),null,name+": no redirigir a sitios desconocidos");
  }else{
   assert.equal(response.status,307,name+": el Worker Free debe redirigir a GitHub Pages");
   assert.equal(response.headers.get("location"),
     "https://trabajoia410-boop.github.io/bellaquitasweb/assets/"+encodeURIComponent(name));
  }
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  console.log("OK "+method+" "+name+" "+response.status);
 }
}
const first=media[0][0];
const ranged=await fetch(new URL("/espejo/assets/"+encodeURIComponent(first),base),{
 method:"GET",headers:{"Range":"bytes=0-63"},redirect:"manual",
 signal:AbortSignal.timeout(15000)
});
assert.equal(ranged.status,expected==="r2-removed"?503:307);
if(expected==="redirect")
 assert.equal(ranged.headers.get("location"),
 "https://trabajoia410-boop.github.io/bellaquitasweb/assets/"+encodeURIComponent(first));
console.log("OK: sin R2, el streaming remoto antiguo falla cerrado o redirige a originales según versión");
console.log("Los vídeos originales permanecen en GitHub; comprobar 206 tras la futura publicación.");
