/**
 * Public preview navigation guard: use one admin access button only.
 * Keep original frozen site design/markup intact except navigation.
 * All privileged authorization continues on /v1/admin/session and server.
 */
export function fixMirrorNavigation(source){
 if(typeof source!=="string")throw Error("Renderer source expected");
 let result=source;
 const line=(prefix,value)=>{
  const lines=result.split("\n");
  const matches=lines.map((x,i)=>x.startsWith(prefix)?i:-1).filter(i=>i>=0);
  if(matches.length!==1)throw Error("Navigation renderer changed: "+prefix);
  lines[matches[0]]=value;
  result=lines.join("\n");
 };
 const one=(from,to)=>{
  if(!result.includes(from)||result.split(from).length!==2)throw Error("Navigation marker changed: "+from.slice(0,100));
  result=result.replace(from,to);
 };
 // A logged-in administrator still has their normal member space, but
 // privileged tools live exclusively in a separate /administracion/ tab.
 line("function destinationForUser(){","function destinationForUser(){return current?.role==='puerta'?'/puerta':'/mi-espacio';}");
 line(" const authActions=current&&!preview?",
  " const authActions=current&&!preview?`<a href=\"#${current.role==='admin'?'/panel':'/mi-espacio'}\" class=\"btn btn-secondary btn-mini\">${current.role==='admin'?t('Administrador'):t('Mi espacio')}</a>`:`<a href=\"#/acceso\" class=\"btn btn-secondary btn-mini\">${t('Iniciar sesión')}</a><a href=\"#/registro\" class=\"btn btn-primary btn-mini\">${t('Crear cuenta')} ↗</a>`;");
 line(" const menuAccount=current&&!preview?",
  " const menuAccount=current&&!preview?`<a class=\"btn btn-secondary\" href=\"#/mi-espacio\">Mi cuenta</a>${current.role==='admin'?'<a class=\"btn btn-primary\" href=\"#/panel\">Administrador</a>':current.role==='puerta'?'<a class=\"btn btn-secondary\" href=\"#/puerta\">Control de puerta</a>':''}`:`<a class=\"btn btn-secondary\" href=\"#/acceso\">${t('Iniciar sesión')}</a><a class=\"btn btn-primary\" href=\"#/registro\">${t('Crear cuenta')}</a>`;");
 line("  const links=current.role==='admin'?",
  "  const links=current.role==='admin'?[['/panel','admin','Administrador'],['/puerta','gate','Puerta'],...memberLinks]:current.role==='puerta'?[...memberLinks,['/puerta','gate','Puerta']]:memberLinks;");
 line("  const mobileLinks=current.role==='admin'?",
  "  const mobileLinks=current.role==='admin'?[links[0],memberLinks[0],memberLinks[1],memberLinks[3],memberLinks[4]]:current.role==='puerta'?[memberLinks[0],memberLinks[1],memberLinks[2],memberLinks[3],links[5]]:memberLinks;");
 one("href=\"#${current.role==='admin'?'/panel':'/mi-espacio'}\">${headerBrand(!!editorPreviewOverride)}","href=\"#/\">${headerBrand(!!editorPreviewOverride)}");
 one("${current.role==='admin'?t('Panel administrador'):'Bellaquitas Club'}","${current.role==='admin'?t('Administrador'):'Bellaquitas Club'}");
 one("${current.role==='admin'?'<a class=\"btn btn-primary btn-mini\" href=\"#/editor\">✎ Editar web</a>':''}","");
 return result;
}
