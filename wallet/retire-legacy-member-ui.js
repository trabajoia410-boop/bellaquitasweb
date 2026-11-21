/**
 * Bellaquitas stamp-only client views for the FUTURE production cutover.
 * Keeps the original SPA shell, events, profile form, translations and theme.
 * Changes only the 3 legacy loyalty renderers while the release gate is on.
 * Never accesses or modifies the D1 points balances or session data.
 */
const SUMMARY_VIEW="function summary(){\n const french=activeLang==='fr';\n const events=data.events.filter(e=>e.active).sort((a,b)=>(a.date_label||'9999').localeCompare(b.date_label||'9999')).slice(0,3);\n const eventRows=events.map(e=>'<div class=\"mini-item\"><div class=\"mini-left\"><span class=\"mini-glyph\">▦</span><div><strong>'+H(localizedValue(e,'name'))+'</strong><small>'+H(eventDate(e.date_label,e.start_time))+' · '+H(e.location)+'</small></div></div></div>').join('')||'<div class=\"empty\">'+(french?'Prochainement':'Próximamente')+'</div>';\n return pageHead((french?'Bonjour, ':'Hola, ')+(current.name.split(' ')[0]||'')+' ✦',\n  french?'Retrouvez votre carte à tampons et les événements Bellaquitas.':'Encuentra tu tarjeta de sellos y los eventos Bellaquitas.',\n  'BELLAQUITAS MEMBER')+\n  '<div class=\"dash-grid\"><div><div class=\"pane\"><div class=\"section-title\"><h2>'+(french?'Votre carte à tampons':'Tu tarjeta de sellos')+'</h2></div>'+\n  '<p class=\"muted small\">'+(french?'Les tampons sont votre seul programme de fidélité. Présentez le QR de la nouvelle carte au personnel.':'Los sellos son el único sistema de fidelidad. Presenta el QR de tu nueva tarjeta al personal.')+'</p>'+\n  '<a href=\"/tarjeta/bellaquitas-fest\" class=\"btn btn-primary\">'+(french?'Ouvrir ma carte numérique ↗':'Abrir mi tarjeta digital ↗')+'</a></div>'+\n  '<div class=\"pane section-gap\"><div class=\"section-title\"><h2>'+(french?'Prochains événements':'Próximas experiencias')+'</h2><a class=\"link-tiny\" href=\"#/agenda\">'+(french?'Voir tous ↗':'Ver todas ↗')+'</a></div><div class=\"mini-list\">'+eventRows+'</div></div></div>'+\n  '<div><div class=\"pane\"><h2>'+(french?'Mon compte':'Mi cuenta')+'</h2><p class=\"muted small\">'+(french?'Conservez votre profil actuel. Votre carte à tampons est distincte de vos anciennes données de fidélité.':'Conservas tu perfil actual. La tarjeta de sellos es independiente de los datos anteriores de fidelidad.')+'</p>'+\n  '<a href=\"#/perfil\" class=\"btn btn-secondary btn-mini\">'+(french?'Voir mon profil ↗':'Ver mi perfil ↗')+'</a></div></div></div>';\n}";
const CARD_VIEW="function loyaltyCardView(){\n const french=activeLang==='fr';\n return '<section class=\"loyalty-profile\" aria-label=\"'+(french?'Carte de fidélité à tampons':'Tarjeta de fidelidad con sellos')+'\">'+\n  '<div class=\"loyalty-profile-header\"><div><div class=\"eyebrow\">BELLAQUITAS FEST · MEMBER CLUB</div><h2>'+(french?'Ma carte numérique':'Mi tarjeta digital')+'</h2>'+\n  '<p>'+(french?'Votre carte à tampons avec votre QR personnel, disponible sans mot de passe.':'Tu tarjeta de sellos con QR personal, disponible sin contraseña.')+'</p></div></div>'+\n  '<div class=\"pane\"><h3>'+(french?'Fidélité par tampons':'Fidelidad por sellos')+'</h3><p class=\"muted small\">'+\n  (french?'Chaque nouveau membre commence à 0 tampon. Le personnel valide vos tampons avec le QR de votre nouvelle carte.':'Cada tarjeta nueva empieza con 0 sellos. El personal valida los sellos con el QR de tu nueva tarjeta.')+'</p>'+\n  '<a class=\"btn btn-primary\" href=\"/tarjeta/bellaquitas-fest\">'+(french?'Ouvrir ma carte à tampons ↗':'Abrir mi tarjeta de sellos ↗')+'</a></div></section>';\n}";
const REWARDS_VIEW="function rewards(){\n const french=activeLang==='fr';\n return pageHead(french?'Mes récompenses':'Mis recompensas',\n  french?'Les récompenses du nouveau programme dépendent des tampons de votre carte numérique.':'Las recompensas del nuevo programa dependen de los sellos de tu tarjeta digital.',\n  'BELLAQUITAS MEMBER')+loyaltyCardView();\n}";
const REPLACEMENTS=[
 ["function summary(){","function loyaltyCardView(){",SUMMARY_VIEW],
 ["function loyaltyCardView(){","function card(){",CARD_VIEW],
 ["function rewards(){","function agenda(){",REWARDS_VIEW]
];
export function stampsOnlyMemberUI(source){
 if(typeof source!=="string")throw Error("Invalid legacy app source");
 let updated=source;
 for(const [start,end,view] of REPLACEMENTS){
  const i=updated.indexOf(start);
  if(i<0||updated.indexOf(start,i+start.length)!==-1)throw Error('Legacy function marker missing or ambiguous: '+start);
  const j=updated.indexOf(end,i+start.length);
  if(j<0)throw Error('Legacy function end marker missing: '+end);
  updated=updated.slice(0,i)+view+'\n'+updated.slice(j);
 }
 // Public loyalty calls-to-action now open the passwordless stamp card.
 // Keep account registration and normal profile access unchanged.
 const links=[
  ["href=\"${current?'#/tarjeta':'#/registro'}\" class=\"btn btn-primary\">","href=\"/tarjeta/bellaquitas-fest\" class=\"btn btn-primary\">"],
  ["href=\"#/tarjeta\" aria-label=\"Ver tarjeta de fidelidad\"","href=\"/tarjeta/bellaquitas-fest\" aria-label=\"Ver tarjeta de fidelidad\""],
  ["href=\"#/acceso\" class=\"btn btn-primary\">${txt('cta_button')}","href=\"/tarjeta/bellaquitas-fest\" class=\"btn btn-primary\">${txt('cta_button')}"]
 ];
 for(const [before,after] of links){
  if(!updated.includes(before))throw Error("Legacy card CTA missing");
  updated=updated.replace(before,after);
 }
 return updated;
}
