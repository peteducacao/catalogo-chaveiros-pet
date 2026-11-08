/* Estatísticas anônimas do Catálogo PET: coleta somente com consentimento.
   Sem IP, GPS, nome, fingerprint ou bibliotecas externas. */
(() => {
  'use strict';
  const page=document.body?.dataset.page;
  if(!['catalogo','contato'].includes(page))return;
  const choiceKey='pet_catalog_analytics_consent_v1';
  const visitorKey='pet_catalog_analytics_device_v1';
  const apiHost='https://catalogo-chaveiros-pet.pet-educacao.workers.dev';
  const endpoint=location.hostname==='peteducacao.github.io'?apiHost+'/api/analytics/event':'/api/analytics/event';
  let enabled=false,identifier='',firstRequest=Promise.resolve(),notice=null;
  const get=key=>{try{return localStorage.getItem(key);}catch{return null}};
  const set=(key,value)=>{try{localStorage.setItem(key,value);return true;}catch{return false}};
  const remove=key=>{try{localStorage.removeItem(key);}catch{}};
  function randomId(){
    if(typeof crypto?.randomUUID==='function')return crypto.randomUUID();
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
    return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  }
  function post(kind,action='',productId=''){
    if(!enabled||!identifier)return Promise.resolve();
    return fetch(endpoint,{
      method:'POST',mode:'cors',credentials:'omit',cache:'no-store',keepalive:true,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({kind,action,productId,visitor:identifier,page})
    }).then(()=>{}).catch(()=>{});
  }
  function start(){
    if(enabled)return;
    identifier=get(visitorKey)||randomId();
    if(!set(visitorKey,identifier))return;
    enabled=true;
    firstRequest=post('view');
  }
  function stop(){
    enabled=false;identifier='';remove(visitorKey);
  }
  function dismiss(){notice?.remove();notice=null;}
  function decide(value){
    if(value==='allow'){
      if(set(choiceKey,'allow'))start();
    }else{set(choiceKey,'deny');stop();}
    dismiss();
  }
  function showConsent(){
    if(notice){notice.querySelector('.pet-analytics-allow')?.focus();return;}
    notice=document.createElement('aside');
    notice.className='pet-analytics-consent';
    notice.setAttribute('aria-label','Preferências de privacidade do catálogo');
    notice.innerHTML=
      '<div class="pet-analytics-copy"><strong>Estatísticas do catálogo</strong>'+
      '<p>Podemos contar visitas e cliques para melhorar nossos chaveiros? Usamos um identificador aleatório neste navegador, sem guardar IP ou dados pessoais nos relatórios. Você pode mudar sua escolha no rodapé.</p></div>'+
      '<div class="pet-analytics-buttons"><button class="pet-analytics-deny" type="button">Não permitir</button>'+
      '<button class="pet-analytics-allow" type="button">Permitir estatísticas</button></div>';
    notice.querySelector('.pet-analytics-allow').addEventListener('click',()=>decide('allow'));
    notice.querySelector('.pet-analytics-deny').addEventListener('click',()=>decide('deny'));
    document.body.append(notice);
  }
  function setupPrivacyAccess(){
    const footer=document.querySelector('footer.site-footer')||document.querySelector('footer');
    if(!footer)return;
    const button=document.createElement('button');
    button.type='button';button.className='pet-analytics-preferences';
    button.textContent='Preferências de privacidade';
    button.addEventListener('click',showConsent);
    footer.append(button);
  }
  function trackClick(event){
    if(!enabled)return;
    const target=event.target instanceof Element?event.target:null;
    if(!target)return;
    const card=target.closest('.product-card');
    const productId=card?.dataset.productId||'';
    let action='';
    if(card){
      if(target.closest('.product-image-viewer'))action='zoom';
      else if(target.closest('.product-variation-option'))action='cor';
      else if(target.closest('.product-copy-button'))action='copiar';
    }
    const link=target.closest('a[href]');
    if(!action&&link){
      try{if(new URL(link.href,location.href).hostname.toLowerCase()==='www.instagram.com')action='instagram';}
      catch{}
    }
    if(action)firstRequest.then(()=>post('click',action,productId));
  }
  function init(){
    setupPrivacyAccess();
    document.addEventListener('click',trackClick,true);
    if(get(choiceKey)==='allow')start();
    else if(get(choiceKey)!=='deny')showConsent();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();