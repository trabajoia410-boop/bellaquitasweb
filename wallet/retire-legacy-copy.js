/**
 * Copy-only replacement for the already-existing marketing layout.
 * Used by the future production Worker ONLY after the stamp cutover flag.
 * Never changes images, animations, QR protocols, CSS or loyalty data.
 */
const replacements=[
  ["Tu tarjeta, tus puntos, tus experiencias.","Tu tarjeta, tus sellos, tus experiencias."],
  ["Tu código de socio, tus puntos y tus ventajas reunidos en un mismo lugar.",
   "Tu tarjeta digital, tus sellos y tus ventajas en un mismo lugar."],
  ["Puntos y ventajas","Sellos y ventajas"],
  ["Acumula puntos por actividades validadas y descubre recompensas pensadas para ti.",
   "Consigue sellos con tu tarjeta digital y descubre recompensas pensadas para ti."],
  ["Acumula puntos","Acumula sellos"],
  ["Consigue puntos por participaciones autorizadas y visitas registradas.",
   "Consigue sellos cuando el personal autorizado escanee tu tarjeta."],
  ["¿Cómo se suman los puntos?","¿Cómo consigo mis sellos?"],
  ["Se suman al validar una visita o actividad, según las reglas de la comunidad.",
   "Presenta tu QR al personal autorizado para conseguir tus sellos."],
  ["Tarjeta, puntos y beneficios","Tarjeta, sellos y beneficios"],
  ["Points et avantages","Tampons et avantages"],
  ["Carte, points et avantages","Carte, tampons et avantages"]
];
export function stampsOnlyMarketingCopy(source){
 if(typeof source!=="string")throw Error("Source must be a string");
 let result=source;
 for(const [oldText,newText] of replacements)result=result.replaceAll(oldText,newText);
 return result;
}
