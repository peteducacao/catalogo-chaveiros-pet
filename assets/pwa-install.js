/* Menu de instalação do Catálogo PET — compatível com Chrome e fallback manual. */
(()=>{
  'use strict';
  let deferredPrompt=null;
  let installed=false;
  const menuButton=document.getElementById('pwa-install-menu');
  const dialog=document.getElementById('pwa-install-dialog');
  const installButton=document.getElementById('pwa-install-action');
  const guidance=document.getElementById('pwa-install-guidance');
  const closeButton=document.getElementById('pwa-install-close');
  if(!menuButton||!dialog||!installButton||!guidance)return;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches||window.navigator.standalone===true;
  const isInstalled=()=>installed||standalone();
  const chromeAndroid=()=>/Android/i.test(navigator.userAgent)&&/Chrome\//i.test(navigator.userAgent);
  function closeDialog(){
    if(dialog.open)dialog.close();
  }
  function closeMenu(){
    const menu=document.getElementById('main-nav');
    const toggle=document.getElementById('menu-toggle');
    if(menu)menu.classList.remove('open');
    if(toggle){
      toggle.setAttribute('aria-expanded','false');
      toggle.setAttribute('aria-label','Abrir menu');
    }
  }
  function setGuidance(message){
    guidance.textContent=message||'';
    guidance.hidden=!message;
  }
  function refresh(){
    if(isInstalled()){
      menuButton.hidden=true;
      closeDialog();
    }
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
  });
  window.addEventListener('appinstalled',()=>{
    installed=true;deferredPrompt=null;refresh();
  });
  menuButton.addEventListener('click',()=>{
    closeMenu();
    if(isInstalled()){refresh();return;}
    installButton.disabled=false;
    installButton.textContent='Instalar aplicativo';
    setGuidance('');
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
  });
  closeButton?.addEventListener('click',closeDialog);
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)closeDialog();
  });
  installButton.addEventListener('click',async()=>{
    if(isInstalled()){refresh();return;}
    if(deferredPrompt){
      const promptEvent=deferredPrompt;
      deferredPrompt=null;
      try{
        // O prompt nativo precisa ser acionado diretamente pelo clique.
        await promptEvent.prompt();
        const choice=await promptEvent.userChoice;
        if(choice?.outcome==='accepted'){
          setGuidance('Conclua a instalação na confirmação do navegador.');
          window.setTimeout(closeDialog,1200);
        }else{
          setGuidance('Instalação cancelada. Você pode tentar pelo menu do navegador.');
        }
      }catch{
        setGuidance('Não foi possível abrir a instalação automática. Use o menu do navegador para adicionar à tela inicial.');
      }
      return;
    }
    if(chromeAndroid()){
      setGuidance('No Chrome, toque nos três pontos (⋮) e escolha “Adicionar à tela inicial” ou “Instalar aplicativo”. Depois, confirme.');
    }else if(/iPad|iPhone|iPod/i.test(navigator.userAgent)){
      setGuidance('No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.');
    }else{
      setGuidance('Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.');
    }
  });
  if('serviceWorker'in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(error=>{
        console.warn('Não foi possível registrar o PWA:',error);
      });
    });
  }
  refresh();
})();
