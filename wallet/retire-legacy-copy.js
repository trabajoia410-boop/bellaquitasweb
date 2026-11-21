/**
 * Copy-only replacement for the already-existing marketing layout.
 * Used by the future production Worker ONLY after the stamp cutover flag.
 * Never changes images, animations, QR protocols, CSS or loyalty data.
 */
export const STAMP_MARKETING_REPLACEMENTS=[
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
  ["Carte, points et avantages","Carte, tampons et avantages"],
  ["Votre carte, vos points, vos expériences.","Votre carte, vos tampons, vos expériences."],
  ["Votre code de membre, vos points et vos avantages au même endroit.","Votre carte numérique, vos tampons et vos avantages au même endroit."],
  ["Votre code de membre, vos points et vos avantages réunis au même endroit.","Votre carte numérique, vos tampons et vos avantages au même endroit."],
  ["Cumulez des points grâce aux activités validées et découvrez des récompenses pensées pour vous.","Collectionnez des tampons avec votre carte numérique et découvrez vos récompenses."],
  ["Cumulez des points et découvrez des récompenses.","Collectionnez des tampons et découvrez des récompenses."],
  ["Cumulez des points","Cumulez des tampons"],
  ["Gagnez des points grâce aux participations autorisées et aux visites enregistrées.","Obtenez des tampons lorsque le personnel autorisé scanne votre carte."],
  ["Gagnez des points lors de visites ou participations validées.","Obtenez des tampons lorsque le personnel autorisé scanne votre carte."],
  ["Comment gagner des points ?","Comment obtenir mes tampons ?"],
  ["Les points sont attribués après validation d’une visite ou d’une activité, selon les règles de la communauté.","Présentez le QR de votre carte au personnel autorisé pour recevoir des tampons."],
  ["Des points sont ajoutés après une visite ou une activité validée.","Présentez votre QR au personnel pour obtenir des tampons."],
  ["Canjea recompensas","Consigue recompensas"],
  ["Échangez vos points contre des cadeaux","Échangez vos tampons contre des récompenses"],
  ["Visita validada: +10 puntos.","Visita registrada."],
  ["Visite validée : +10 points.","Visite enregistrée."],
  ["Les points et le niveau sont gérés par les personnes autorisées.","Les tampons sont validés sur votre carte numérique par le personnel autorisé."],
  ["La categoría y el saldo no se pueden editar desde el perfil. Los gestiona el sistema autorizado.","Tus sellos se gestionan desde la tarjeta digital. El personal autorizado los valida."],
  ["Tu código de socio, tus puntos y tus ventajas reunidos en un mismo lugar.","Tu tarjeta digital, tus sellos y tus ventajas en un mismo lugar."],
  ["Sube de categoría","Completa tu tarjeta"],
  ["Passez au niveau supérieur","Complétez votre carte"],
  ["Member, Gold, VIP y Black: cada etapa reconoce tu participación.","Completa tu tarjeta de sellos y disfruta las recompensas del club."],
  ["Member, Gold, VIP et Black : progressez à votre rythme.","Complétez votre carte à tampons pour profiter des récompenses du club."],
  ["Explora el catálogo y solicita los premios disponibles.","Descubre las recompensas que consigues al completar tus sellos."],
  ["Explorez le catalogue et demandez les récompenses disponibles.","Découvrez les récompenses de votre carte à tampons."],
  ["Una tarjeta, todas tus ventajas.","Una tarjeta de sellos, todas tus ventajas."],
  ["Une carte, tous vos avantages.","Une carte à tampons, tous vos avantages."]
];
export function stampsOnlyMarketingCopy(source){
 if(typeof source!=="string")throw Error("Source must be a string");
 let result=source;
 for(const [oldText,newText] of STAMP_MARKETING_REPLACEMENTS)result=result.replaceAll(oldText,newText);
 return result;
}
