// No altera el diseño original. Intercepta exclusivamente navegación al panel interno.
export const MIRROR_ADMIN_NEW_TAB=String.raw`(()=>{
 'use strict';
 document.addEventListener('click',function(e){
   const target=e.target instanceof Element?e.target.closest('a[href="#/panel"],a[href="#/editor"]'):null;
   if(!target)return;
   e.preventDefault();
   e.stopImmediatePropagation();
   window.open('/administracion/','_blank','noopener,noreferrer');
 },true);
})();`;
