/* Splash curta apenas para o PWA instalado, sem bloquear o catálogo. */
(()=>{
 'use strict';
 const standalone=window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;
 if(!standalone)return;
 const splash=document.getElementById('pet-splash');
 if(!splash)return;
 splash.classList.add('is-visible');
 let removed=false;
 function dismiss(){
  if(removed)return;
  removed=true;
  splash.classList.add('is-leaving');
  window.setTimeout(()=>splash.remove(),300);
 }
 // Tempo curto, sem aguardar chamadas externas ou dados dos produtos.
 window.setTimeout(dismiss,1450);
 window.addEventListener('pagehide',dismiss,{once:true});
})();
