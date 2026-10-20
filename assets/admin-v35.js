'use strict';
// Nenhuma senha, token ou chave de administrador está incluída neste arquivo.
// O acesso de escrita depende exclusivamente de autorização validada pelo GitHub.
(()=>{
  const API='https://api.github.com/repos/'+PET_REPOSITORY;
  const ROOT='https://api.github.com';
  let token=null, currentUser=null, products=[],config={},pendingFile=null,previewURL=null,selectedColors=[],editingId=null,busy=false,operationsInQueue=0;
  let productsQueue=Promise.resolve();
  let restoringSession=false;
  const byId=id=>document.getElementById(id);
  const loginForm=byId('login-form'),loginScreen=byId('login-screen'),dashboard=byId('dashboard'),sessionInfo=byId('session-info'),modal=byId('editor-modal'),form=byId('editor-form');
  let paletteColors=[['Azul PET','#0FABE2'],['Azul-marinho','#173D72'],['Branco','#FFFFFF'],['Preto','#161B22'],['Rosa','#E8AAC6'],['Lilás','#A38AE0'],['Verde','#1DA88B'],['Amarelo','#F4C248'],['Vermelho','#D65353'],['Laranja','#ED9553']];
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  const toBase64=text=>{const bytes=encoder.encode(text);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);};
  const fromBase64=base64=>{const chars=atob(base64.replace(/\s/g,''));const bytes=Uint8Array.from(chars,c=>c.charCodeAt(0));return decoder.decode(bytes);};
  const ACTIVE_TAB='pet_admin_auth_token_session_v11';
  let authTransitionTimer=null;
  function showAuthTransition(title,description){
    const previous=document.querySelector('.auth-transition-overlay');
    if(previous)previous.remove();
    window.clearTimeout(authTransitionTimer);
    const overlay=document.createElement('div');
    overlay.className='instagram-redirect-overlay auth-transition-overlay';
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    overlay.setAttribute('aria-label',title);
    const card=document.createElement('div');
    card.className='instagram-redirect-card auth-transition-card';
    const spinner=document.createElement('span');
    spinner.className='instagram-redirect-spinner';
    spinner.setAttribute('aria-hidden','true');
    const heading=document.createElement('strong');
    heading.className='instagram-redirect-heading';
    heading.textContent=title;
    const text=document.createElement('p');
    text.className='instagram-redirect-description';
    text.textContent=description;
    card.append(spinner,heading,text);
    overlay.append(card);
    document.body.append(overlay);
    document.body.classList.add('auth-transition-active');
    authTransitionTimer=window.setTimeout(()=>{
      overlay.classList.add('auth-transition-leaving');
      authTransitionTimer=window.setTimeout(()=>{
        overlay.remove();
        document.body.classList.remove('auth-transition-active');
        authTransitionTimer=null;
      },220);
    },1200);
  }
  function toast(message,error=false,auth=false){
    const e=byId('toast');
    e.textContent=message;
    e.hidden=false;
    e.dataset.auth=auth?'true':'false';
    e.style.background=error?'#a83440':'#173d72';
    window.clearTimeout(toast.timer);
    toast.timer=window.setTimeout(()=>{e.hidden=true;e.dataset.auth='false';},auth?(error?4200:1800):5000);
  }
  let feedbackTimer=null;
  function saveFeedback(kind,message,sha=null){
    const area=byId('save-feedback');
    const label=byId('save-message');
    const link=byId('save-commit');
    if(!area||!label)return;
    window.clearTimeout(feedbackTimer);
    area.hidden=false;
    area.dataset.kind=kind;
    label.textContent=message;
    // Erros e operações pendentes permanecem legíveis; confirmações não viram faixas permanentes.
    if(kind==='success'||kind==='info')feedbackTimer=window.setTimeout(()=>{area.hidden=true;},6500);
    if(link){
      const valid=/^[a-f0-9]{40}$/i.test(sha||'');
      link.hidden=!valid;
      if(valid)link.href='https://github.com/'+PET_REPOSITORY+'/commit/'+sha;
    }
  }

  // Preserva alterações públicas não publicadas, sem guardar nenhuma credencial.
  const DRAFT_PRODUCTS='pet_chaveiros_rascunho_v7';
  function loadDraft(){try{const value=localStorage.getItem(DRAFT_PRODUCTS);return value?JSON.parse(value):null;}catch{return null;}}
  function keepDraft(error){
    let saved=false;
    try{localStorage.setItem(DRAFT_PRODUCTS,JSON.stringify(products));saved=true;}catch{}
    if(saved){error.savedAsDraft=true;render();showDraftWarning();}
    return saved;
  }
  function showDraftWarning(){
    let notice=byId('draft-warning');
    if(!notice){
      notice=document.createElement('section');
      notice.id='draft-warning';
      notice.className='publish-info';
      notice.style.marginBottom='24px';
      notice.innerHTML='<strong>Rascunho local: ainda não publicado</strong><p>O painel exibe os chaveiros confirmados no GitHub. Este rascunho antigo foi guardado separadamente e pode conter modelos já excluídos. Confira todos os registros antes de recuperá-lo manualmente.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-primary" id="draft-copy">Copiar dados</button><a class="btn btn-outline" target="_blank" rel="noopener noreferrer" href="https://github.com/peteducacao/catalogo-chaveiros-pet/edit/main/data/chaveiros.json">Abrir editor do GitHub ↗</a><button type="button" class="btn btn-outline" id="draft-download">Baixar JSON</button></div><p id="draft-copy-status" role="status" aria-live="polite"></p>';
      byId('dashboard').insertBefore(notice,byId('dashboard').querySelector('.dashboard-top'));
      byId('draft-copy').addEventListener('click',async()=>{
        const data=loadDraft();
        try{await navigator.clipboard.writeText(JSON.stringify(data,null,2)+'\n');byId('draft-copy-status').textContent='Copiado. Agora substitua o conteúdo do arquivo no GitHub e clique em Commit changes.';}
        catch{byId('draft-copy-status').textContent='Não consegui copiar automaticamente. Use Baixar JSON.';}
      });
      byId('draft-download').addEventListener('click',()=>{
        const data=loadDraft();
        if(!data)return;
        const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download='chaveiros-pet-rascunho.json';document.body.append(a);a.click();a.remove();
        window.setTimeout(()=>URL.revokeObjectURL(url),30000);
      });
    }
    notice.hidden=!loadDraft();
  }

  function editorFeedback(kind,message){
    const area=byId('editor-save-feedback');
    if(!area)return;
    area.hidden=false;
    area.dataset.kind=kind;
    area.textContent=message;
  }
  function clearEditorFeedback(){
    const area=byId('editor-save-feedback');
    if(area){area.hidden=true;area.textContent='';}
  }
  function apiFailure(status,data,response){
    const raw=String(data?.message||'');
    const message=raw.toLowerCase();
    let helpful;
    if(status===401){
      helpful='Token inválido ou expirado. Gere um novo token no GitHub e entre novamente.';
    }else if(status===403&&(/rate limit|secondary rate|abuse detection/.test(message))){
      helpful='O GitHub limitou temporariamente as solicitações. Aguarde alguns minutos antes de tentar salvar novamente.';
    }else if(status===403){
      const accepted=response?.headers?.get('X-Accepted-GitHub-Permissions')||'';
      const rateRemain=response?.headers?.get('X-RateLimit-Remaining');
      helpful='GitHub recusou a solicitação (403). '+(
        /resource not accessible by personal access token|integration/i.test(message)
          ? 'O token não tem acesso suficiente a este recurso.'
          : 'Verifique se o token tem acesso de escrita ao repositório.'
      )+' Use um token da conta proprietária, com acesso a catalogo-chaveiros-pet e Contents: Read and write.'+
      (accepted?' Permissão exigida pelo GitHub: '+accepted+'.':'')+
      (rateRemain==='0'?' Limite de chamadas da API atingido; aguarde a renovação.':'')+
      (raw?' Detalhe do GitHub: '+raw.slice(0,170):'');
    }else if(status===404){
      helpful='Recurso não encontrado no GitHub (404). Verifique se o token tem acesso ao repositório peteducacao/catalogo-chaveiros-pet.';
    }else if(status===409||status===422){
      helpful='O arquivo foi alterado no GitHub ou a gravação entrou em conflito. Atualize o painel, confira o modelo e tente novamente.';
    }else{
      helpful='GitHub retornou erro '+status+'. '+(raw&&!/token|authorization|credential/i.test(raw)?raw:'Tente novamente em instantes.');
    }
    const err=new Error(helpful);
    err.status=status;
    err.githubMessage=raw;
    return err;
  }
  async function github(path,options={}){
    if(!token)throw Error('Entre no painel novamente.');
    let response;
    try{
      response=await fetch(path.startsWith('https://')?path:ROOT+path,{
        ...options,
        headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...options.headers}
      });
    }catch(err){throw Error('Não foi possível conectar ao GitHub. Confira a internet e tente novamente. Nenhuma alteração foi confirmada.');}
    let data=null;
    try{data=await response.json();}catch{}
    if(!response.ok)throw apiFailure(response.status,data,response);
    return data;
  }
  async function repoRead(path){const file=await github(API+'/contents/'+path+'?ref='+PET_BRANCH);return {sha:file.sha,content:fromBase64(file.content||'')};}
  async function repoWrite(path,content,message,isBase64=false){let sha;try{const previous=await repoRead(path);sha=previous.sha;}catch(e){if(e.status!==404)throw e;}
    const payload={message,content:isBase64?content:toBase64(content),branch:PET_BRANCH};if(sha)payload.sha=sha;
    return github(API+'/contents/'+path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  }
  // Uploads use an unused filename; GitHub's API rejects overwrites without SHA.

  // Todas as fotos enviadas mantêm as proporções originais. Por padrão cabem
  // inteiras no quadro; o usuário pode aproximar e arrastar na prévia.
  function squareImage(source,state,size){
    const canvas=document.createElement('canvas');
    canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('O navegador não conseguiu preparar a fotografia.');
    // Fundo neutro usado nos novos uploads; a foto original permanece intacta.
    ctx.fillStyle='#faf9f7';
    ctx.fillRect(0,0,size,size);
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    const turns=((Number(state?.rotation)||0)%4+4)%4;
    const sideways=turns%2===1;
    const rotatedWidth=sideways?source.height:source.width;
    const rotatedHeight=sideways?source.width:source.height;
    const fit=Math.min(size/rotatedWidth,size/rotatedHeight);
    const zoom=Math.max(1,Math.min(5,Number(state?.zoom)||1));
    const width=source.width*fit*zoom;
    const height=source.height*fit*zoom;
    const dx=(Number(state?.dx)||0)*size;
    const dy=(Number(state?.dy)||0)*size;
    ctx.save();
    ctx.translate(size/2+dx,size/2+dy);
    ctx.rotate(turns*Math.PI/2);
    ctx.drawImage(source,-width/2,-height/2,width,height);
    ctx.restore();
    return canvas;
  }
  let fitBitmap=null,pendingImageData=null;
  let fitState={zoom:1,dx:0,dy:0,rotation:0};
  let fitHadPrepared=false,fitDrag=null;
  const fitDialog=byId('image-fit-dialog');
  const fitCanvas=byId('image-fit-canvas');
  function fitPreview(){
    if(!fitBitmap)return;
    const canvas=squareImage(fitBitmap,fitState,420);
    const ctx=fitCanvas.getContext('2d');
    ctx.clearRect(0,0,420,420);
    ctx.drawImage(canvas,0,0);
    byId('image-fit-zoom').value=String(Math.round(fitState.zoom*100));
    byId('image-fit-zoom-value').textContent=Math.round(fitState.zoom*100)+'%';
  }
  function openFitDialog(){
    if(!fitBitmap)return;
    fitHadPrepared=!!pendingImageData;
    byId('image-fit-error').hidden=true;
    if(!fitDialog.open)fitDialog.showModal();
    fitPreview();
  }
  function cancelFitDialog(){
    if(fitDialog.open)fitDialog.close();
    fitDrag=null;
    fitCanvas.classList.remove('dragging');
    if(!fitHadPrepared){
      pendingFile=null;pendingImageData=null;
      byId('product-file').value='';
      if(fitBitmap){fitBitmap.close?.();fitBitmap=null;}
      byId('image-fit-reopen').hidden=true;
      const previous=products.find(p=>p.id===editingId);
      setImagePreview(previous?.imagem||'assets/sem-foto.svg');
    }
  }
  byId('image-fit-cancel').addEventListener('click',cancelFitDialog);
  fitDialog.addEventListener('cancel',event=>{event.preventDefault();cancelFitDialog();});
  byId('image-fit-zoom').addEventListener('input',event=>{
    fitState.zoom=Number(event.target.value)/100;
    fitPreview();
  });
  function rotatePhoto(delta){
    if(!fitBitmap)return;
    fitState={zoom:1,dx:0,dy:0,rotation:((fitState.rotation||0)+delta+4)%4};
    fitPreview();
  }
  byId('image-fit-left').addEventListener('click',()=>rotatePhoto(-1));
  byId('image-fit-right').addEventListener('click',()=>rotatePhoto(1));
  byId('image-fit-whole').addEventListener('click',()=>{
    fitState={zoom:1,dx:0,dy:0,rotation:fitState.rotation||0};
    fitPreview();
  });
  byId('image-fit-cover').addEventListener('click',()=>{
    if(!fitBitmap)return;
    const sideways=(fitState.rotation||0)%2!==0;
    const wide=sideways?fitBitmap.height:fitBitmap.width;
    const tall=sideways?fitBitmap.width:fitBitmap.height;
    const ratio=Math.max(wide,tall)/Math.min(wide,tall);
    fitState={zoom:Math.min(5,Math.max(1,ratio)),dx:0,dy:0,rotation:fitState.rotation||0};
    fitPreview();
  });
  fitCanvas.addEventListener('pointerdown',event=>{
    if(!fitBitmap)return;
    fitDrag={id:event.pointerId,x:event.clientX,y:event.clientY};
    fitCanvas.setPointerCapture?.(event.pointerId);
    fitCanvas.classList.add('dragging');
  });
  fitCanvas.addEventListener('pointermove',event=>{
    if(!fitDrag||fitDrag.id!==event.pointerId)return;
    const rect=fitCanvas.getBoundingClientRect();
    fitState.dx=Math.max(-1,Math.min(1,fitState.dx+(event.clientX-fitDrag.x)/rect.width));
    fitState.dy=Math.max(-1,Math.min(1,fitState.dy+(event.clientY-fitDrag.y)/rect.height));
    fitDrag.x=event.clientX;fitDrag.y=event.clientY;
    fitPreview();
  });
  function stopFitDrag(){fitDrag=null;fitCanvas.classList.remove('dragging');}
  fitCanvas.addEventListener('pointerup',stopFitDrag);
  fitCanvas.addEventListener('pointercancel',stopFitDrag);
  byId('image-fit-apply').addEventListener('click',()=>{
    if(!fitBitmap)return;
    try{
      const canvas=squareImage(fitBitmap,fitState,960);
      const imageData=canvas.toDataURL('image/webp',0.86);
      if(!imageData.startsWith('data:image/webp;base64,'))throw Error('Não foi possível converter a foto.');
      pendingImageData=imageData;
      byId('product-preview').src=imageData;
      byId('image-preview-label').textContent='Enquadramento escolhido';
      byId('image-fit-reopen').hidden=false;
      fitDialog.close();
    }catch(error){
      byId('image-fit-error').textContent=error.message;
      byId('image-fit-error').hidden=false;
    }
  });
  byId('image-fit-reopen').addEventListener('click',openFitDialog);
  // Verifica também a assinatura real do arquivo: tipo/nome podem ser falsificados.
  // Imagens aprovadas são decodificadas e regravadas como WebP via canvas; bytes
  // e metadados da imagem original jamais são publicados no repositório.
  async function validateRasterFile(file){
    if(!(file instanceof Blob))throw Error('Escolha um arquivo de fotografia.');
    if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Use apenas imagens PNG, JPEG ou WebP. SVG e outros formatos não são aceitos.');
    if(file.size<32||file.size>15*1024*1024)throw Error('A fotografia deve ter entre 32 bytes e 15 MB.');
    const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
    const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
    const jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    const match=(png&&file.type==='image/png')||(jpeg&&file.type==='image/jpeg')||(webp&&file.type==='image/webp');
    if(!match)throw Error('O conteúdo real da imagem não corresponde a PNG, JPEG ou WebP. Arquivo recusado por segurança.');
  }
  async function decodeSafeRaster(file){
    await validateRasterFile(file);
    let bitmap;
    try{bitmap=await createImageBitmap(file);}catch{throw Error('Imagem inválida ou danificada. Escolha outra fotografia.');}
    if(!bitmap.width||!bitmap.height||bitmap.width>12000||bitmap.height>12000||bitmap.width*bitmap.height>60_000_000){
      bitmap.close?.();
      throw Error('Imagem muito grande. Use uma fotografia de até 60 megapixels e 12.000 pixels por lado.');
    }
    return bitmap;
  }
  async function choosePhoto(file){
    if(!file){
      pendingFile=null;pendingImageData=null;
      byId('image-fit-reopen').hidden=true;
      const previous=products.find(p=>p.id===editingId);
      setImagePreview(previous?.imagem||'assets/sem-foto.svg');
      return;
    }
    const bitmap=await decodeSafeRaster(file);
    if(bitmap.width*bitmap.height>60_000_000){
      bitmap.close?.();
      throw Error('Imagem muito grande. Use uma foto de até 60 megapixels.');
    }
    if(fitBitmap)fitBitmap.close?.();
    fitBitmap=bitmap;
    pendingFile=file;
    pendingImageData=null;
    fitState={zoom:1,dx:0,dy:0,rotation:0};
    byId('image-fit-reopen').hidden=false;
    openFitDialog();
  }
  async function uploadImage(file,preparedImage){
    await validateRasterFile(file);
    let encoded=preparedImage;
    if(!encoded){
      const bitmap=await decodeSafeRaster(file);
      try{encoded=squareImage(bitmap,{zoom:1,dx:0,dy:0},960).toDataURL('image/webp',0.86);}
      finally{bitmap.close?.();}
    }
    if(typeof encoded!=='string'||!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(encoded)||encoded.length>7_000_000)
      throw Error('A fotografia processada não é WebP válido ou excede o limite permitido. Tente novamente.');
    const name=(file.name.replace(/\.[^.]+$/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').slice(0,32)||'chaveiro')+'-'+(crypto.randomUUID?.()||String(Date.now()))+'.webp';
    const path='assets/produtos/'+name;
    await github(API+'/contents/'+path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Publica foto enquadrada do chaveiro '+name,content:encoded.split(',')[1],branch:PET_BRANCH})});
    return path;
  }
  function showDashboard(logged){
    loginScreen.hidden=logged;
    dashboard.hidden=!logged;
    sessionInfo.hidden=!logged;
    // O tutorial é exclusivo do painel autenticado, nunca da tela de login.
    byId('help-open').hidden=!logged;
    // Garante que as seções se excluam mesmo se houver CSS antigo em cache.
    loginScreen.style.display=logged?'none':'';
    dashboard.style.display=logged?'':'none';
    sessionInfo.style.display=logged?'':'none';
    byId('github-user').textContent=logged?'@'+(currentUser||'GitHub'):'';
  }
  function logout(){
    try{sessionStorage.removeItem(ACTIVE_TAB);}catch(e){}
    token=null;currentUser=null;byId('token-input').value='';
    const guideDialog=byId('admin-guide-dialog');
    if(guideDialog?.open)guideDialog.close();
    showDashboard(false);closeEditor();
    showAuthTransition('Sessão encerrada','Você saiu do painel administrativo.');
  }
  loginForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const resumed=restoringSession;
    restoringSession=false;
    const input=byId('token-input'),feedback=byId('login-error'),submit=byId('login-submit');
    feedback.hidden=true;
    submit.disabled=true;
    submit.textContent='Verificando permissões...';
    token=input.value.trim();
    try{
      if(!token)throw Error('Informe seu token do GitHub.');
      const [repo,user,p,c]=await Promise.all([
        github(API),github('/user'),repoRead('data/chaveiros.json'),repoRead('data/config.json')
      ]);
      if(repo.full_name!==PET_REPOSITORY)throw Error('O token não corresponde ao repositório correto.');
      const loaded=JSON.parse(p.content),configuration=JSON.parse(c.content);
      if(!Array.isArray(loaded))throw Error('O catálogo retornou um formato inválido.');
      // Entrar exige somente autenticação e leitura. Nunca criar blobs/commits como requisito de login.
      products=orderProducts(loaded);
      config=configuration;
      currentUser=user.login||'GitHub';
      input.value='';
      try{sessionStorage.setItem(ACTIVE_TAB,token);}catch(e){}
      showDashboard(true);
      render();
      if(!resumed)showAuthTransition('Acesso autorizado!','Bem-vindo ao painel administrativo do PET Educação.');
      const draft=loadDraft();
      if(Array.isArray(draft)&&JSON.stringify(draft)!==JSON.stringify(products)){
        // Rascunhos locais podem conter produtos já excluídos no GitHub.
        // Preservamos a cópia para recuperação, mas nunca a exibimos como catálogo publicado.
        showDraftWarning();
      }else if(draft){try{localStorage.removeItem(DRAFT_PRODUCTS);}catch{}}
      if(repo.permissions?.push===false){
        saveFeedback('error','Login realizado: leitura autorizada, mas o GitHub não informou permissão de gravação para este token. Você pode ver os modelos. Para salvar, confira Contents: Read and write nas configurações do token.');
      }else{
        byId('save-feedback').hidden=true;
        toast('Acesso realizado com sucesso!');
      }
    }catch(e){
      token=null;
      try{sessionStorage.removeItem(ACTIVE_TAB);}catch(_){}
      feedback.textContent=e.message||'Não foi possível autenticar.';
      feedback.hidden=false;
      toast('Não foi possível acessar: '+feedback.textContent,true,true);
    }finally{
      submit.disabled=false;
      submit.textContent='Acessar painel →';
    }
  });
  byId('logout').addEventListener('click',logout);

  // Manual acessível antes e depois do login.
  const guide=byId('admin-guide-dialog');
  byId('help-open').addEventListener('click',()=>{
    if(guide&&!guide.open)guide.showModal();
  });
  byId('help-close').addEventListener('click',()=>{if(guide?.open)guide.close();});
  guide?.addEventListener('click',event=>{if(event.target===guide)guide.close();});

    function switchTab(tab){
    if(!['products','home','contacts'].includes(tab))return;
    document.querySelectorAll('.dash-tab').forEach(button=>{
      const active=button.dataset.tab===tab;
      button.classList.toggle('active',active);
      button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
    });
    byId('section-products').hidden=tab!=='products';
    byId('section-home').hidden=tab!=='home';
    byId('section-contacts').hidden=tab!=='contacts';
  }
  document.querySelectorAll('.dash-tab').forEach(button=>button.addEventListener('click',()=>switchTab(button.dataset.tab)));

  // A posição é registrada em cada chaveiro (ordem: 1, 2, 3 ...).
  // Na ausência de ordem em um cadastro antigo, preservamos sua posição no arquivo.
  function orderProducts(list){
    return list.map((p,i)=>({p,i,pos:Number.isInteger(p.ordem)&&p.ordem>=0?p.ordem:i+1}))
      .sort((a,b)=>a.pos-b.pos||a.i-b.i).map(({p})=>p);
  }
  function numberProducts(list){
    return list.map((p,i)=>({...p,ordem:i+1}));
  }
  function arrangeByIds(list,ids){
    const priority=new Map(ids.map((id,i)=>[id,i]));
    const source=orderProducts(list);
    return numberProducts(source.map((p,i)=>({p,i,position:priority.has(p.id)?priority.get(p.id):ids.length+i}))
      .sort((a,b)=>a.position-b.position||a.i-b.i).map(x=>x.p));
  }
  let desiredOrderIds=null;
  let orderTimer=null,orderRevision=0,orderSaving=false;
  function adoptRemoteProducts(remote){
    products=desiredOrderIds?arrangeByIds(remote,desiredOrderIds):orderProducts(remote);
  }

  function render(){byId('stat-total').textContent=products.length;byId('stat-available').textContent=products.filter(productAvailable).length;byId('stat-off').textContent=products.filter(p=>!productAvailable(p)).length;const units=byId('stat-units');if(units)units.textContent=products.filter(productAvailable).reduce((sum,p)=>sum+(Number(p.estoque)||0),0)+' unidades em estoque';byId('config-home-description').value=typeof config.homeDescription==='string'?config.homeDescription:'Conheça nosso catálogo! Para mais informações, acompanhe o Instagram do PET Educação.';renderProducts();renderHomeSettings();renderSocialList();renderInstitutionalWebsite();renderContactInformation();}

  // Destaques da capa: ordem controlada pelo painel, sem mexer no cadastro do produto.
  function homeSelectedIds(){
    return Array.from(document.querySelectorAll('.home-feature-select')).map(select=>select.value).filter(Boolean);
  }
  function renderHomeSettings(){
    const holder=byId('home-feature-controls');
    if(!holder)return;
    const ids=Array.isArray(config.homeFeaturedIds)?config.homeFeaturedIds.slice(0,3):[];
    const eligible=orderProducts(products).filter(productAvailable);
    holder.replaceChildren();
    for(let i=0;i<3;i++){
      const label=node('label','home-feature-field');
      const name=node('span','',(i+1)+'ª fotografia');
      const select=node('select','home-feature-select');
      select.id='home-feature-'+(i+1);
      const placeholder=node('option','','Não selecionar');
      placeholder.value='';
      select.append(placeholder);
      for(const p of eligible){
        const option=node('option','',p.nome);
        option.value=String(p.id);
        select.append(option);
      }
      select.value=eligible.some(p=>p.id===ids[i])?ids[i]:'';
      select.addEventListener('change',updateHomePreview);
      label.append(name,select);
      holder.append(label);
    }
    updateHomePreview();
  }
  function updateHomePreview(){
    const gallery=byId('home-feature-preview');
    const empty=byId('home-preview-empty');
    if(!gallery)return;
    const ids=homeSelectedIds();
    const unique=[...new Set(ids)];
    gallery.replaceChildren();
    const items=unique.map(id=>products.find(p=>p.id===id)).filter(p=>p&&productAvailable(p));
    for(const product of items){
      const frame=node('span','home-feature-photo');
      const image=node('img');
      image.src=safeImageUrl(product.imagem);
      image.alt='Prévia do '+product.nome;
      frame.append(image);
      gallery.append(frame);
    }
    gallery.dataset.count=String(items.length);
    gallery.hidden=items.length===0;
    if(empty)empty.hidden=items.length>0;
    const status=byId('home-feedback');
    if(status&&ids.length!==unique.length){
      status.textContent='Não repita o mesmo modelo nas posições.';
      status.dataset.kind='error';
    }else if(status&&status.dataset.kind==='error'){
      status.textContent='';
      delete status.dataset.kind;
    }
  }
  byId('save-home').addEventListener('click',async()=>{
    const button=byId('save-home');
    const feedback=byId('home-feedback');
    const ids=homeSelectedIds();
    const description=byId('config-home-description').value.trim();
    if(new Set(ids).size!==ids.length){
      feedback.textContent='Escolha modelos diferentes para cada fotografia.';
      feedback.dataset.kind='error';
      return;
    }
    const eligible=new Set(products.filter(productAvailable).map(p=>p.id));
    if(ids.some(id=>!eligible.has(id))){
      feedback.textContent='Um dos modelos não está disponível. Atualize o painel e tente novamente.';
      feedback.dataset.kind='error';
      return;
    }
    button.disabled=true;
    feedback.textContent='Salvando página inicial no GitHub...';
    feedback.dataset.kind='pending';
    try{
      const sha=await updateConfigGitHub('Atualiza destaques e apresentação da página inicial',current=>{
        current.homeDescription=description;
        current.homeFeaturedIds=ids;
        return current;
      });
      renderHomeSettings();
      feedback.dataset.kind='success';
      feedback.textContent=sha?'Página inicial publicada no GitHub!':'A página inicial já estava atualizada.';
      if(sha)saveFeedback('success','A página inicial foi salva no GitHub!',sha);
      toast(sha?'Destaques atualizados no GitHub!':'Nenhuma mudança detectada.');
    }catch(error){
      feedback.dataset.kind='error';
      feedback.textContent='Não foi possível salvar: '+error.message;
      saveFeedback('error','Não foi possível salvar a página inicial: '+error.message);
      toast('Erro ao salvar página inicial: '+error.message,true);
    }finally{button.disabled=false;}
  });

  function renderProducts(){
    const wrap=byId('admin-products'),query=byId('admin-search').value.toLocaleLowerCase('pt-BR').trim();
    const ordered=orderProducts(products);
    const view=ordered.filter(p=>p.nome.toLocaleLowerCase('pt-BR').includes(query));
    wrap.replaceChildren();
    if(!view.length){wrap.append(node('p','empty','Nenhum modelo encontrado.'));return;}
    for(const p of view){
      const index=ordered.findIndex(item=>item.id===p.id);
      const card=node('article','manage-card'),photo=node('img','manage-photo');
      photo.src=safeImageUrl(p.imagem);photo.alt='Imagem de '+p.nome;
      const body=node('div','manage-body');
      const heading=node('div','manage-title-row');
      heading.append(node('span','manage-order-number',String(index+1)+'º'),node('h3','',p.nome));
      body.append(heading);
      body.append(node('p','manage-color',(p.cores||[]).map(c=>c.nome).join(' • ')||'Sem cores cadastradas'));
      const bottom=node('div','manage-bottom');
      const toggle=node('button','availability-toggle '+(productAvailable(p)?'':'off'),productAvailable(p)?'● Disponível':'● Sem estoque');
      toggle.type='button';toggle.title='Alternar disponibilidade deste chaveiro';
      toggle.addEventListener('click',()=>toggleStock(p,toggle));
      const order=node('div','manage-reorder');
      const positionLabel=node('label','manage-position-label');
      positionLabel.append(document.createTextNode('Posição '));
      const select=node('select','manage-position-select');
      select.setAttribute('aria-label','Posição do chaveiro '+p.nome);
      ordered.forEach((_,i)=>{
        const option=node('option','',String(i+1));
        option.value=String(i+1);
        select.append(option);
      });
      select.value=String(index+1);
      select.disabled=!!query;
      select.addEventListener('change',()=>changeProductPosition(p,Number(select.value)-1));
      positionLabel.append(select);
      const up=node('button','','↑ Subir'),down=node('button','','↓ Descer');
      up.type='button';down.type='button';
      up.setAttribute('aria-label','Mover '+p.nome+' para cima');
      down.setAttribute('aria-label','Mover '+p.nome+' para baixo');
      up.disabled=index===0||!!query;
      down.disabled=index>=ordered.length-1||!!query;
      up.addEventListener('click',()=>changeProductPosition(p,index-1));
      down.addEventListener('click',()=>changeProductPosition(p,index+1));
      order.append(positionLabel,up,down);
      const actions=node('div','manage-actions');
      const edit=node('button','','Editar'),remove=node('button','delete','Excluir');
      edit.type='button';remove.type='button';
      edit.addEventListener('click',()=>openEditor(p));
      remove.addEventListener('click',()=>deleteProduct(p,remove));
      actions.append(edit,remove);
      bottom.append(toggle,node('span','manage-quantity',(Number(p.estoque)||0)+' un.'),order,actions);
      body.append(bottom);card.append(photo,body);wrap.append(card);
    }
  }

  function priceOf(product){
    if(product.preco===null||product.preco===undefined||product.preco==='')return null;
    const value=Number(product.preco);
    return Number.isFinite(value)&&value>0?value:null;
  }
  function parsePrice(input){
    const raw=String(input||'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');
    if(raw==='')return null;
    // Aceita 15,50 / 15.50 / 1.234,56.
    const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;
    if(!/^\d+(?:\.\d{1,2})?$/.test(normalized))throw Error('Informe um preço válido. Exemplo: 15,50.');
    const cents=Math.round(Number(normalized)*100);
    if(!Number.isSafeInteger(cents)||cents<1||cents>100000000)throw Error('Informe um preço maior que zero e menor que R$ 1.000.000,00.');
    return cents/100;
  }
  byId('admin-search').addEventListener('input',renderProducts);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  // Uma fila para as operações sobre o MESMO arquivo JSON. Cada alteração lê o SHA
  // atualizado antes de gravar e reexecuta o comando em caso de conflito transitório.
  function saveProducts(message,transform,{quick=false,stageFailedChanges=true}={}){
    operationsInQueue++;
    if(operationsInQueue>1)saveFeedback('pending',operationsInQueue+' alterações aguardando gravação no GitHub...');
    const work=async()=>{
      busy=true;
      saveFeedback('pending','Salvando '+message+'...');
      toast('Salvando no GitHub: '+message+'...');
      try{
        let lastError=null;
        for(let attempt=0;attempt<4;attempt++){
          const remote=await repoRead('data/chaveiros.json');
          const latest=JSON.parse(remote.content);
          if(!Array.isArray(latest))throw Error('O arquivo de chaveiros do GitHub está inválido.');
          // Snapshot independente: transformações de edição alteram o objeto recebido.
          // Comparar um array já modificado contra ele próprio gerava falso "Sem alterações pendentes".
          const before=JSON.stringify(latest);
          const transformed=transform(JSON.parse(before));
          if(!Array.isArray(transformed))throw Error('Alteração inválida, o catálogo não foi modificado.');
          const next=numberProducts(orderProducts(transformed));
          const after=JSON.stringify(next);
          const encoded=JSON.stringify(next,null,2)+'\n';
          if(before===after){
            adoptRemoteProducts(next);render();
            saveFeedback('info','Nenhuma mudança detectada em '+message+'. Nada precisou ser enviado ao GitHub.');
            toast('Nenhuma alteração detectada; os dados já estavam iguais.');
            return null;
          }
          try{
            const answer=await github(API+'/contents/data/chaveiros.json',{
              method:'PUT',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({message,content:toBase64(encoded),sha:remote.sha,branch:PET_BRANCH})
            });
            const sha=answer?.commit?.sha;
            if(!/^[a-f0-9]{40}$/i.test(sha||''))throw Error('Não houve confirmação do commit no GitHub.');
            adoptRemoteProducts(next);
            try{localStorage.removeItem(DRAFT_PRODUCTS);}catch{}
            showDraftWarning();render();
            saveFeedback('success','Salvo no GitHub! '+message+'. A página pública pode levar alguns minutos para atualizar.',sha);
            toast('Salvo no GitHub! '+message+'.');
            // Aguardar a propagação da versão antes da próxima operação na mesma pasta.
            if(!quick)await sleep(1300);
            return sha;
          }catch(error){
            lastError=error;
            const githubRateLimit=error.status===403&&/rate limit|secondary rate|abuse detection/i.test(error.githubMessage||error.message);
            const conflict=(error.status===409||error.status===422);
            if((conflict||githubRateLimit)&&attempt<3){
              saveFeedback('pending','O GitHub está sincronizando. Nova tentativa '+(attempt+2)+' de 4...');
              await sleep(githubRateLimit?4500:900*(attempt+1));
              continue;
            }
            throw error;
          }
        }
        throw lastError||Error('Não foi possível confirmar a alteração.');
      }catch(error){
        // EXCLUSÕES não podem fazer o produto desaparecer sem confirmação do GitHub.
        // Para outras operações, o rascunho ainda é preservado separadamente.
        if(stageFailedChanges){
          try{
            const fallback=transform(Array.isArray(loadDraft())?loadDraft():products.map(p=>({...p})));
            if(Array.isArray(fallback)){adoptRemoteProducts(fallback);keepDraft(error);}
          }catch(_){}
        }
        const suffix=stageFailedChanges
          ?' Se aparecer um rascunho, use Copiar dados para recuperá-lo.'
          :' O chaveiro permanece na lista; a exclusão não foi confirmada pelo GitHub.';
        saveFeedback('error','NÃO PUBLICADO. '+error.message+suffix);
        toast('ERRO: não foi possível salvar. '+error.message,true);
        throw error;
      }finally{
        busy=false;
      }
    };
    const queued=productsQueue.catch(()=>{}).then(work);
    productsQueue=queued.catch(()=>{});
    return queued.finally(()=>{
      operationsInQueue--;
      if(operationsInQueue>0)saveFeedback('pending','Ainda há '+operationsInQueue+' alteração(ões) na fila...');
    });
  }
  async function toggleStock(p,button){
    button.disabled=true;
    try{
      await saveProducts('Atualiza disponibilidade: '+p.nome,latest=>{
        const record=latest.find(item=>item.id===p.id);
        if(!record)throw Error('Este chaveiro foi removido. Atualize o painel.');
        const wasAvailable=productAvailable(record);
        record.disponivel=!wasAvailable;
        if(record.disponivel&&Number(record.estoque)<=0)record.estoque=1;
        return latest;
      });
    }catch(_){
      // A mensagem persistente explica o erro, e o rascunho local mantém a mudança.
    }finally{button.disabled=false;}
  }
  async function deleteProduct(p,button){
    if(button.disabled)return;
    if(!window.confirm('Excluir o chaveiro "'+p.nome+'" do catálogo?'))return;
    button.disabled=true;
    button.textContent='Excluindo...';
    try{
      // Mantém o cartão na tela durante a gravação. Somente um commit confirmado
      // remove o registro da lista exibida.
      await saveProducts('Remove chaveiro '+p.nome,latest=>latest.filter(item=>item.id!==p.id),{
        quick:true,
        stageFailedChanges:false
      });
    }catch(_){
      // O aviso de falha é exibido por saveProducts. Não alterar products aqui.
      // A lista permanece consistente com os últimos dados confirmados.
    }finally{
      button.disabled=false;
      button.textContent='Excluir';
    }
  }
  function changeProductPosition(product,targetIndex){
    const sorted=orderProducts(products);
    const current=sorted.findIndex(p=>p.id===product.id);
    if(current<0||!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=sorted.length||current===targetIndex)return;
    const moved=sorted.splice(current,1)[0];
    sorted.splice(targetIndex,0,moved);
    products=numberProducts(sorted);
    desiredOrderIds=products.map(p=>p.id);
    orderRevision++;
    // A posição muda imediatamente na tela. Movimentos seguidos geram um único commit.
    renderProducts();
    saveFeedback('pending','Ordem alterada. Salvando automaticamente no GitHub...');
    if(orderTimer)window.clearTimeout(orderTimer);
    orderTimer=window.setTimeout(persistOrder,1050);
  }
  async function persistOrder(){
    orderTimer=null;
    if(!desiredOrderIds||orderSaving)return;
    orderSaving=true;
    const snapshot=[...desiredOrderIds],revision=orderRevision;
    try{
      await saveProducts('Atualiza a ordem dos chaveiros',latest=>arrangeByIds(latest,snapshot),{quick:true});
      if(orderRevision===revision){
        desiredOrderIds=null;
        renderProducts();
        saveFeedback('success','Ordem salva no GitHub! O catálogo será atualizado em alguns minutos.');
      }
    }catch(error){
      // Mantém a ordem ajustada na tela e no rascunho para uma nova tentativa.
      if(orderRevision===revision){
        desiredOrderIds=[...snapshot];
        saveFeedback('error','Não foi possível salvar a ordem. Tente mover um modelo novamente. '+error.message);
      }
    }finally{
      orderSaving=false;
      if(desiredOrderIds&&orderRevision!==revision){
        adoptRemoteProducts(products);
        renderProducts();
        if(orderTimer)window.clearTimeout(orderTimer);
        orderTimer=window.setTimeout(persistOrder,550);
      }
    }
  }

  // Paleta pública de opções (configuração independente dos produtos).
  const palette=byId('palette');
  const colorDialog=byId('colors-manager-dialog');
  const colorName=byId('colors-manager-name');
  const colorHex=byId('colors-manager-hex');
  const colorFeedback=byId('colors-manager-feedback');
  let editingPaletteColor=null;
  let colorManagerBusy=false;
  const colorKey=c=>String(c.hex||'').toUpperCase()+'|'+String(c.nome||'').toLocaleLowerCase('pt-BR');
  const validPaletteEntry=item=>item&&typeof item.nome==='string'&&item.nome.trim().length>0&&item.nome.trim().length<=30&&/^#[0-9a-f]{6}$/i.test(String(item.hex||''));
  function normalizePaletteEntries(items){
    if(!Array.isArray(items))return [];
    const names=new Set();
    return items.filter(validPaletteEntry).map(item=>({nome:item.nome.trim(),hex:item.hex.toUpperCase()})).filter(item=>{
      const name=item.nome.toLocaleLowerCase('pt-BR');
      if(names.has(name))return false;
      names.add(name);
      return true;
    }).slice(0,80);
  }
  const initialPalette=normalizePaletteEntries(paletteColors.map(([nome,hex])=>({nome,hex})));
  function syncPaletteColors(){
    const entries=Array.isArray(config?.paletaCores)?normalizePaletteEntries(config.paletaCores):initialPalette;
    paletteColors=entries.map(item=>[item.nome,item.hex]);
    return entries;
  }
  function updateSelectedColorChips(){
    const selected=byId('selected-colors');
    selected.replaceChildren();
    for(const c of selectedColors){
      const chip=node('span','selected-color');
      const dot=node('span','dot');
      dot.style.backgroundColor=safeHex(c.hex);
      const remove=node('button','','×');
      remove.type='button';
      remove.title='Remover '+c.nome+' deste chaveiro';
      remove.setAttribute('aria-label','Remover '+c.nome+' deste chaveiro');
      remove.addEventListener('click',()=>{
        selectedColors=selectedColors.filter(x=>colorKey(x)!==colorKey(c));
        for(const button of palette.querySelectorAll('.palette-button')){
          if(button.dataset.colorKey===colorKey(c)){
            button.classList.remove('selected');
            button.setAttribute('aria-pressed','false');
          }
        }
        updateSelectedColorChips();
        // Evita a rolagem do navegador para um botão que acabou de ser removido.
        byId('color-picker-details').querySelector('summary')?.focus({preventScroll:true});
      });
      chip.append(dot,document.createTextNode(c.nome),remove);
      selected.append(chip);
    }
    const chosen=selectedColors.length,summary=byId('color-selection-summary');
    if(summary)summary.textContent=chosen===0?'Nenhuma cor selecionada':chosen===1?'1 cor selecionada':chosen+' cores selecionadas';
  }
  function paintPalette(){
    syncPaletteColors();
    palette.replaceChildren();
    for(const [name,hex] of paletteColors){
      const option={nome:name,hex};
      const picked=selectedColors.some(c=>colorKey(c)===colorKey(option));
      const button=node('button','palette-button'+(picked?' selected':''),name);
      button.type='button';
      button.dataset.colorKey=colorKey(option);
      button.setAttribute('aria-pressed',String(picked));
      const dot=node('span','dot');
      dot.style.backgroundColor=hex;
      button.prepend(dot);
      button.addEventListener('click',()=>{
        const wasPressed=button.getAttribute('aria-pressed')==='true';
        if(wasPressed)selectedColors=selectedColors.filter(c=>colorKey(c)!==colorKey(option));
        else selectedColors.push({...option});
        button.classList.toggle('selected',!wasPressed);
        button.setAttribute('aria-pressed',String(!wasPressed));
        // Não substitui o botão tocado: isso causava saltos de foco/rolagem no Android.
        updateSelectedColorChips();
      });
      palette.append(button);
    }
    updateSelectedColorChips();
  }
  function resetPaletteEditor(){
    editingPaletteColor=null;
    byId('colors-manager-form').reset();
    colorHex.value='#0fabe2';
    byId('colors-manager-save').textContent='Adicionar cor';
    byId('colors-manager-cancel-edit').hidden=true;
  }
  function setPaletteFeedback(kind,message){
    colorFeedback.textContent=message;
    colorFeedback.dataset.kind=kind;
  }
  function renderPaletteManager(){
    const entries=syncPaletteColors();
    const list=byId('colors-manager-list');
    const count=byId('colors-manager-count');
    list.replaceChildren();
    count.textContent=entries.length+' '+(entries.length===1?'cor cadastrada':'cores cadastradas');
    if(!entries.length)list.append(node('p','colors-manager-empty','Nenhuma cor cadastrada. Adicione a primeira acima.'));
    for(const item of entries){
      const row=node('div','colors-manager-item');
      const swatch=node('span','colors-manager-swatch');
      swatch.style.backgroundColor=item.hex;
      swatch.setAttribute('aria-hidden','true');
      const info=node('div','colors-manager-item-info');
      info.append(node('strong','',item.nome),node('small','',item.hex));
      const actions=node('div','colors-manager-item-actions');
      const edit=node('button','btn btn-outline','Editar');
      edit.type='button';
      edit.setAttribute('aria-label','Editar cor '+item.nome);
      edit.addEventListener('click',()=>{
        editingPaletteColor=colorKey(item);
        colorName.value=item.nome;
        colorHex.value=item.hex.toLowerCase();
        byId('colors-manager-save').textContent='Salvar alterações';
        byId('colors-manager-cancel-edit').hidden=false;
        setPaletteFeedback('info','Editando '+item.nome+'. Alterações na paleta não modificam chaveiros existentes.');
        colorName.focus({preventScroll:true});
        byId('colors-manager-form').scrollIntoView({block:'nearest',behavior:'auto'});
      });
      const remove=node('button','btn btn-outline colors-manager-delete','Excluir');
      remove.type='button';
      remove.setAttribute('aria-label','Excluir cor '+item.nome+' da lista de opções');
      remove.addEventListener('click',async()=>{
        if(colorManagerBusy)return;
        if(!window.confirm('Excluir "'+item.nome+'" da lista de cores? Os chaveiros existentes não serão alterados.'))return;
        colorManagerBusy=true;
        remove.disabled=true;
        setPaletteFeedback('pending','Excluindo cor no GitHub...');
        try{
          await updateConfigGitHub('Remove a cor '+item.nome+' da paleta',current=>{
            const stored=Array.isArray(current.paletaCores)?current.paletaCores:initialPalette;
            current.paletaCores=normalizePaletteEntries(stored).filter(c=>colorKey(c)!==colorKey(item));
            return current;
          });
          if(editingPaletteColor===colorKey(item))resetPaletteEditor();
          renderPaletteManager();
          paintPalette();
          setPaletteFeedback('success','Cor excluída da lista! Os chaveiros existentes foram preservados.');
          toast('Cor removida da paleta.');
        }catch(error){
          setPaletteFeedback('error','Não foi possível excluir: '+error.message);
        }finally{colorManagerBusy=false;remove.disabled=false;}
      });
      actions.append(edit,remove);
      row.append(swatch,info,actions);
      list.append(row);
    }
  }
  function openPaletteManager(){
    resetPaletteEditor();
    colorFeedback.textContent='';
    renderPaletteManager();
    if(!colorDialog.open)colorDialog.showModal();
  }
  function closePaletteManager(){
    if(colorDialog.open)colorDialog.close();
  }
  byId('manage-colors-open').addEventListener('click',openPaletteManager);
  byId('manage-colors-from-editor').addEventListener('click',openPaletteManager);
  byId('colors-manager-close').addEventListener('click',closePaletteManager);
  byId('colors-manager-cancel-edit').addEventListener('click',()=>{
    resetPaletteEditor();
    setPaletteFeedback('info','Edição cancelada.');
  });
  colorDialog.addEventListener('click',event=>{if(event.target===colorDialog)closePaletteManager();});
  byId('colors-manager-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(colorManagerBusy)return;
    const nome=colorName.value.trim(),hex=colorHex.value.toUpperCase();
    if(!validPaletteEntry({nome,hex})){
      setPaletteFeedback('error','Informe um nome de até 30 caracteres e escolha uma cor válida.');
      return;
    }
    colorManagerBusy=true;
    const save=byId('colors-manager-save');
    save.disabled=true;
    setPaletteFeedback('pending','Salvando paleta no GitHub...');
    try{
      await updateConfigGitHub(editingPaletteColor?'Edita cor da paleta: '+nome:'Cadastra cor na paleta: '+nome,current=>{
        const list=normalizePaletteEntries(Array.isArray(current.paletaCores)?current.paletaCores:initialPalette);
        const pos=editingPaletteColor?list.findIndex(item=>colorKey(item)===editingPaletteColor):-1;
        if(editingPaletteColor&&pos<0)throw Error('Cor original não encontrada. Atualize o painel e tente novamente.');
        if(list.some((item,i)=>item.nome.toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR')&&i!==pos))
          throw Error('Já existe uma cor com esse nome.');
        if(pos<0){
          if(list.length>=80)throw Error('Limite de 80 cores. Exclua uma cor da lista antes de adicionar.');
          list.push({nome,hex});
        }else list[pos]={nome,hex};
        current.paletaCores=list;
        return current;
      });
      resetPaletteEditor();
      renderPaletteManager();
      paintPalette();
      setPaletteFeedback('success','Paleta atualizada no GitHub! Os chaveiros existentes não foram modificados.');
      toast('Cores atualizadas com sucesso.');
    }catch(error){
      setPaletteFeedback('error','Não foi possível salvar: '+error.message);
    }finally{
      colorManagerBusy=false;save.disabled=false;
    }
  });
  function setImagePreview(src){byId('product-preview').src=safeImageUrl(src);}
  function mode(){return form.querySelector('input[name=image-source]:checked').value;}
  function updateImageMode(){const file=mode()==='file';byId('image-file-wrap').hidden=!file;byId('image-url-wrap').hidden=file;}
  form.querySelectorAll('input[name=image-source]').forEach(r=>r.addEventListener('change',updateImageMode));
  byId('product-file').addEventListener('change',async event=>{
    const input=event.target;
    try{
      await choosePhoto(input.files?.[0]||null);
    }catch(error){
      pendingFile=null;pendingImageData=null;
      input.value='';
      byId('image-fit-reopen').hidden=true;
      editorFeedback('error',error.message);
      toast(error.message,true);
    }
  });
  byId('product-url').addEventListener('input',event=>{const u=event.target.value.trim();if(u&&safeImageUrl(u)!=='assets/mock-pet.svg')setImagePreview(u);});
  function preserveEditorScroll(callback){
    const scroll=modal.querySelector('.modal-body');
    if(!scroll){callback();return;}
    const top=scroll.scrollTop;
    callback();
    // Mantém a posição no próprio formulário após ocultar/revelar campos.
    scroll.scrollTop=top;
  }
  function updateCaptionVisibility(){preserveEditorScroll(()=>{byId('caption-field').hidden=!byId('product-illustrative').checked;});}
  function updateColorDisplay(){preserveEditorScroll(()=>{byId('color-palette-controls').hidden=!byId('product-show-colors').checked;});}
  byId('product-show-colors').addEventListener('change',updateColorDisplay);
  byId('product-illustrative').addEventListener('change',updateCaptionVisibility);
  function openEditor(product){editingId=product?.id||null;pendingFile=null;pendingImageData=null;if(fitBitmap){fitBitmap.close?.();fitBitmap=null;}byId('image-fit-reopen').hidden=true;if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}form.reset();byId('color-picker-details').open=false;byId('product-file').value='';byId('product-name').value=product?.nome||'';byId('product-description').value=product?.descricao||'';byId('product-quantity').value=Number(product?.estoque)||0;const existingPrice=product?priceOf(product):null;byId('product-price').value=existingPrice===null?'':existingPrice.toFixed(2).replace('.',',');byId('product-show-colors').checked=product?product.mostrarCores!==false:true;updateColorDisplay();byId('product-available').checked=product?Boolean(product.disponivel):true;byId('product-illustrative').checked=product?Boolean(product.imagemIlustrativa):false;byId('product-caption').value=product?.legendaImagem||'Imagem ilustrativa';byId('product-url').value=(product&&/^https:\/\//.test(product.imagem))?product.imagem:'';selectedColors=(product?.cores||[]).map(c=>({...c}));const isUrl=/^https:\/\//.test(product?.imagem||'');form.querySelector(`input[name=image-source][value=${isUrl?'url':'file'}]`).checked=true;updateImageMode();updateCaptionVisibility();paintPalette();setImagePreview(product?.imagem||'assets/sem-foto.svg');byId('editor-error').hidden=true;clearEditorFeedback();byId('editor-title').textContent=product?'Editar chaveiro':'Novo chaveiro';modal.showModal();}
  function closeEditor(){if(colorDialog.open)colorDialog.close();if(fitDialog.open)fitDialog.close();if(modal.open)modal.close();if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}if(fitBitmap){fitBitmap.close?.();fitBitmap=null;}pendingFile=null;pendingImageData=null;byId('image-fit-reopen').hidden=true;}
  byId('btn-add').addEventListener('click',()=>openEditor(null));byId('close-modal').addEventListener('click',closeEditor);byId('cancel-modal').addEventListener('click',closeEditor);modal.addEventListener('click',e=>{if(e.target===modal)closeEditor();});
  form.addEventListener('submit',async e=>{e.preventDefault();if(byId('save-product').disabled)return;const name=byId('product-name').value.trim(),description=byId('product-description').value.trim(),quantity=Number(byId('product-quantity').value);const err=byId('editor-error'),save=byId('save-product');err.hidden=true;clearEditorFeedback();if(!name){err.textContent='Informe o nome do chaveiro.';err.hidden=false;editorFeedback('error',err.textContent);return;}if(!Number.isInteger(quantity)||quantity<0){err.textContent='Informe uma quantidade válida (zero ou mais).';err.hidden=false;editorFeedback('error',err.textContent);return;}let newPrice;try{newPrice=parsePrice(byId('product-price').value);}catch(error){err.textContent=error.message;err.hidden=false;editorFeedback('error',err.textContent);return;}let image=products.find(p=>p.id===editingId)?.imagem||'assets/sem-foto.svg';if(mode()==='url'){const u=byId('product-url').value.trim();if(u&&safeImageUrl(u)==='assets/mock-pet.svg'){err.textContent='Use somente links diretos HTTPS para imagens PNG, JPEG ou WebP. SVG, HTML e endereços desconhecidos são bloqueados.';err.hidden=false;editorFeedback('error',err.textContent);return;}if(u&&/^https:\/\/(www\.)?imgur\.com\//i.test(u)&&!/^https:\/\/i\.imgur\.com\/[^?#]+\.(png|jpe?g|webp)([?#].*)?$/i.test(u)){err.textContent='No Imgur use o link direto da foto (i.imgur.com/arquivo.jpg), não o link do álbum.';err.hidden=false;editorFeedback('error',err.textContent);return;}if(u)image=u;}save.disabled=true;save.textContent='Salvando...';editorFeedback('pending','Salvando no GitHub. Aguarde a confirmação...');try{if(mode()==='file'&&pendingFile){editorFeedback('pending','Enviando fotografia ao GitHub...');image=await uploadImage(pendingFile,pendingImageData);editorFeedback('pending','Imagem enviada. Salvando cadastro...');}const existing=products.find(p=>p.id===editingId);const product={...existing,id:existing?.id||'chaveiro-'+Date.now(),ordem:existing?.ordem??0,nome:name,descricao:description,imagem:image,cores:selectedColors.map(c=>({nome:c.nome,hex:safeHex(c.hex)})),mostrarCores:byId('product-show-colors').checked,estoque:quantity,preco:newPrice,disponivel:byId('product-available').checked,imagemIlustrativa:byId('product-illustrative').checked,legendaImagem:byId('product-caption').value.trim()||'Imagem ilustrativa'};try{await saveProducts(existing?'Edita chaveiro '+name:'Cadastra chaveiro '+name,latest=>{if(existing){const idx=latest.findIndex(p=>p.id===existing.id);if(idx<0)throw Error('O modelo foi removido do GitHub. Atualize o painel.');latest[idx]={...latest[idx],...product};return latest;}if(latest.some(p=>p.id===product.id))throw Error('Este identificador já existe. Tente novamente.');
      // Modelos novos entram sempre no final, preservando a ordem atual dos existentes.
      // Calculamos sobre a versão mais recente recebida do GitHub, evitando conflitos.
      const orderedLatest=orderProducts(latest);
      const maxOrder=orderedLatest.reduce((max,p,i)=>Math.max(max,Number.isInteger(p.ordem)&&p.ordem>=0?p.ordem:i+1),0);
      return [...orderedLatest,{...product,ordem:maxOrder+1}];});closeEditor();}catch(e){throw e;}}catch(e){err.textContent='Não foi salvo: '+e.message;err.hidden=false;editorFeedback('error',err.textContent);saveFeedback('error',err.textContent);toast(err.textContent,true);}finally{save.disabled=false;save.textContent='Salvar chaveiro';}});

  // Configurações são gravadas em uma fila separada dos chaveiros.
  // Cada operação busca o SHA atual e altera apenas os campos necessários.
  let configWriteQueue=Promise.resolve();
  function updateConfigGitHub(message,transform){
    const work=async()=>{
      let error;
      for(let attempt=0;attempt<4;attempt++){
        const file=await repoRead('data/config.json');
        const current=JSON.parse(file.content);
        if(!current||Array.isArray(current)||typeof current!=='object')throw Error('Configuração do site inválida no GitHub.');
        const before=JSON.stringify(current);
        const updated=transform(JSON.parse(before));
        if(!updated||Array.isArray(updated)||typeof updated!=='object')throw Error('A configuração não pôde ser atualizada.');
        if(before===JSON.stringify(updated)){
          config=updated;
          renderSocialList();
          return null;
        }
        try{
          const saved=await github(API+'/contents/data/config.json',{
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              message,
              content:toBase64(JSON.stringify(updated,null,2)+'\n'),
              sha:file.sha,branch:PET_BRANCH
            })
          });
          const sha=saved?.commit?.sha;
          if(!/^[a-f0-9]{40}$/i.test(sha||''))throw Error('O GitHub não confirmou a alteração das configurações.');
          config=updated;
          renderSocialList();
          await sleep(650);
          return sha;
        }catch(err){
          error=err;
          const isConflict=err.status===409||err.status===422;
          const isRateLimit=err.status===403&&/rate limit|secondary rate/i.test(err.githubMessage||err.message);
          if(attempt<3&&(isConflict||isRateLimit)){
            await sleep(isRateLimit?4000:900*(attempt+1));
            continue;
          }
          throw err;
        }
      }
      throw error||Error('Não foi possível salvar a configuração.');
    };
    const job=configWriteQueue.catch(()=>{}).then(work);
    configWriteQueue=job.catch(()=>{});
    return job;
  }

  function normalizeSocialUrl(value){
    const raw=String(value||'').trim();
    try{
      const url=new URL(raw);
      if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.'))throw Error();
      return url.href;
    }catch{
      throw Error('Informe um endereço HTTPS válido para essa rede social. Exemplo: https://www.instagram.com/perfil/');
    }
  }
  function setSocialFeedback(kind,message){
    const feedback=byId('social-feedback');
    feedback.dataset.kind=kind;
    feedback.textContent=message;
  }

  // Cores livres são limitadas a 6 dígitos hexadecimais; nunca são interpretadas como CSS arbitrário.
  function safeSocialBackground(value){
    return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value).toUpperCase():null;
  }
  function socialDefaultBackground(profile){
    return /instagram\.com/i.test(String(profile?.url||''))||/^instagram$/i.test(String(profile?.nome||''))?'#173D72':'#1B507B';
  }
  function socialBackgroundTextMode(hex){
    const factors=[.2126,.7152,.0722];
    const luminance=(color)=>[1,3,5].reduce((sum,i,k)=>{
      const value=parseInt(color.slice(i,i+2),16)/255;
      const linear=value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);
      return sum+factors[k]*linear;
    },0);
    const bg=luminance(hex),navy=luminance('#173D72');
    const contrastWhite=1.05/(bg+.05);
    const contrastNavy=(Math.max(bg,navy)+.05)/(Math.min(bg,navy)+.05);
    return contrastWhite>=contrastNavy?'#FFFFFF':'#173D72';
  }
  function updateSocialBackgroundPreview(){
    const toggle=byId('social-custom-background');
    const picker=byId('social-background-color');
    const preview=byId('social-background-preview');
    const hexLabel=byId('social-background-hex');
    const label=byId('social-preview-title');
    if(!toggle||!picker||!preview)return;
    picker.disabled=!toggle.checked;
    const initial=socialDefaultBackground({url:byId('social-url').value,nome:byId('social-name').value});
    const selected=toggle.checked?(safeSocialBackground(picker.value)||initial):initial;
    preview.style.backgroundColor=selected;
    preview.style.color=socialBackgroundTextMode(selected);
    preview.dataset.custom=toggle.checked?'true':'false';
    if(hexLabel)hexLabel.textContent=toggle.checked?selected.toUpperCase():'Padrão';
    if(label)label.textContent=byId('social-handle').value.trim()||byId('social-name').value.trim()||'Sua rede social';
  }

  function clearSocialForm(){
    byId('social-form').reset();
    byId('social-custom-background').checked=false;
    byId('social-background-color').value='#173d72';
    updateSocialBackgroundPreview();
    byId('social-edit-id').value='';
    byId('social-submit').textContent='Adicionar rede social';
    byId('social-cancel').hidden=true;
  }
  function renderSocialList(){
    const list=byId('social-admin-list');
    if(!list)return;
    list.replaceChildren();
    const socials=Array.isArray(config.redesSociais)?config.redesSociais:[];
    if(!socials.length){
      list.append(node('p','empty','Nenhuma rede social cadastrada. Use o formulário acima para adicionar.'));
      return;
    }
    for(const social of socials){
      const card=node('article','social-admin-item');
      const info=node('div','social-admin-item-info');
      info.append(node('strong','',social.nome||'Rede social'));
      if(social.perfil)info.append(node('span','',social.perfil));
      const cardColor=safeSocialBackground(social.corFundo);
      const colorRow=node('div','social-item-background');
      const swatch=node('span','social-card-swatch');
      swatch.style.backgroundColor=cardColor||socialDefaultBackground(social);
      colorRow.append(swatch,node('span','',cardColor?'Fundo personalizado: '+cardColor:'Fundo padrão'));
      info.append(colorRow);
      try{
        const link=node('a','',String(social.url||''));
        link.href=normalizeSocialUrl(social.url);
        link.target='_blank';
        link.rel='noopener noreferrer';
        info.append(link);
      }catch{}
      const actions=node('div','social-admin-item-actions');
      const edit=node('button','','Editar'),remove=node('button','delete','Excluir');
      edit.type='button';remove.type='button';
      edit.addEventListener('click',()=>{
        byId('social-edit-id').value=social.id;
        byId('social-name').value=social.nome||'';
        byId('social-handle').value=social.perfil||'';
        byId('social-url').value=social.url||'';
        byId('social-description').value=social.descricao||'';
        const customColor=safeSocialBackground(social.corFundo);
        byId('social-custom-background').checked=!!customColor;
        byId('social-background-color').value=(customColor||socialDefaultBackground(social)).toLowerCase();
        updateSocialBackgroundPreview();
        byId('social-submit').textContent='Salvar alterações';
        byId('social-cancel').hidden=false;
        setSocialFeedback('pending','Editando '+(social.nome||'rede social')+'.');
        byId('social-form').scrollIntoView({behavior:'smooth',block:'nearest'});
      });
      remove.addEventListener('click',async()=>{
        if(!window.confirm('Excluir '+(social.nome||'esta rede social')+' da página de Contato?'))return;
        remove.disabled=true;edit.disabled=true;
        setSocialFeedback('pending','Excluindo rede social no GitHub...');
        try{
          const sha=await updateConfigGitHub('Remove rede social '+social.nome,current=>{
            const items=Array.isArray(current.redesSociais)?current.redesSociais:[];
            if(!items.some(x=>x.id===social.id))throw Error('Essa rede social já foi excluída. Recarregue o painel.');
            current.redesSociais=items.filter(x=>x.id!==social.id);
            return current;
          });
          if(byId('social-edit-id').value===social.id)clearSocialForm();
          setSocialFeedback('success','Rede social excluída e salva no GitHub.');
          saveFeedback('success','Rede social removida do site.',sha);
          toast('Rede social excluída!');
        }catch(error){
          remove.disabled=false;edit.disabled=false;
          setSocialFeedback('error','NÃO SALVO: '+error.message);
          saveFeedback('error','NÃO SALVO: '+error.message);
          toast('Erro ao excluir rede social: '+error.message,true);
        }
      });
      actions.append(edit,remove);
      card.append(info,actions);
      list.append(card);
    }
  }
  byId('social-custom-background').addEventListener('change',()=>{
    const picker=byId('social-background-color');
    if(byId('social-custom-background').checked&&picker.dataset.initialized!=='true'){
      picker.value=socialDefaultBackground({nome:byId('social-name').value,url:byId('social-url').value});
    }
    picker.dataset.initialized=byId('social-custom-background').checked?'true':'false';
    updateSocialBackgroundPreview();
  });
  byId('social-background-color').addEventListener('input',updateSocialBackgroundPreview);
  for(const field of ['social-name','social-handle','social-url']){
    byId(field).addEventListener('input',updateSocialBackgroundPreview);
  }
  updateSocialBackgroundPreview();
  byId('social-cancel').addEventListener('click',()=>{
    clearSocialForm();
    setSocialFeedback('pending','Edição cancelada.');
  });
  byId('social-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const id=byId('social-edit-id').value.trim();
    const name=byId('social-name').value.trim();
    const handle=byId('social-handle').value.trim();
    const description=byId('social-description').value.trim();
    const customBg=byId('social-custom-background').checked;
    const chosenBg=customBg?safeSocialBackground(byId('social-background-color').value):null;
    if(customBg&&!chosenBg){setSocialFeedback('error','Selecione uma cor de fundo válida.');return;}
    let url;
    if(!name){setSocialFeedback('error','Informe o nome da rede social.');return;}
    try{url=normalizeSocialUrl(byId('social-url').value);}catch(error){setSocialFeedback('error',error.message);return;}
    const newId=id||('rede-'+(crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)));
    const form=byId('social-form'),submit=byId('social-submit');
    submit.disabled=true;
    setSocialFeedback('pending','Salvando rede social no GitHub...');
    try{
      const sha=await updateConfigGitHub((id?'Edita':'Adiciona')+' rede social '+name,current=>{
        const items=Array.isArray(current.redesSociais)?current.redesSociais.map(item=>({...item})):[];
        if(items.some(item=>item.url===url&&item.id!==newId))throw Error('Esse link já está cadastrado em outra rede social.');
        const updated={id:newId,nome:name,perfil:handle,url,descricao:description};
        if(customBg)updated.corFundo=chosenBg;
        if(id){
          const index=items.findIndex(item=>item.id===id);
          if(index<0)throw Error('A rede social não existe mais no GitHub. Atualize o painel.');
          items[index]=updated;
        }else{
          if(items.length>=30)throw Error('Limite de 30 redes sociais atingido.');
          items.push(updated);
        }
        current.redesSociais=items;
        return current;
      });
      clearSocialForm();
      setSocialFeedback('success',sha?'Rede social salva e publicada no GitHub!':'Nenhuma alteração pendente nessa rede social.');
      if(sha)saveFeedback('success','Rede social salva no GitHub.',sha);
      toast('Rede social cadastrada/atualizada!');
    }catch(error){
      setSocialFeedback('error','NÃO SALVO: '+error.message);
      saveFeedback('error','NÃO SALVO: '+error.message);
      toast('Erro ao salvar rede social: '+error.message,true);
    }finally{
      submit.disabled=false;
    }
  });


  const INSTITUTIONAL_FALLBACK={
    titulo:'peteduca.com.br',
    url:'https://peteduca.com.br/',
    descricao:'Conheça o site do PET Educação. Não é um canal de contato ou encomendas deste catálogo.',
    visivel:true
  };
  function renderInstitutionalWebsite(){
    const website={...INSTITUTIONAL_FALLBACK,...(config.siteInstitucional||{})};
    byId('institutional-title').value=String(website.titulo||'');
    byId('institutional-url').value=String(website.url||'');
    byId('institutional-description').value=String(website.descricao||'');
    byId('institutional-visible').checked=website.visivel!==false;
    let link;
    try{link=normalizeSocialUrl(website.url);}catch{link=null;}
    const preview=byId('institutional-preview');
    if(link){preview.href=link;preview.hidden=false;}
    else{preview.removeAttribute('href');preview.hidden=true;}
  }
  byId('institutional-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const title=byId('institutional-title').value.trim();
    const description=byId('institutional-description').value.trim();
    const visible=byId('institutional-visible').checked;
    const feedback=byId('institutional-feedback');
    const submit=byId('institutional-save');
    if(!title){feedback.textContent='Informe o nome que será exibido.';feedback.dataset.kind='error';return;}
    let url;
    try{url=normalizeSocialUrl(byId('institutional-url').value);}
    catch(error){feedback.textContent=error.message;feedback.dataset.kind='error';return;}
    submit.disabled=true;feedback.dataset.kind='pending';
    feedback.textContent='Salvando site no GitHub...';
    try{
      const sha=await updateConfigGitHub('Atualiza site institucional do PET Educação',current=>{
        current.siteInstitucional={titulo:title,url,descricao:description,visivel:visible};
        return current;
      });
      renderInstitutionalWebsite();
      feedback.dataset.kind='success';
      feedback.textContent=sha?'Site institucional atualizado no GitHub. Aguarde a publicação.':'As informações já estão atualizadas.';
      if(sha)saveFeedback('success','Informações do site institucional salvas no GitHub.',sha);
      toast(sha?'Site institucional salvo com sucesso!':'Nenhuma alteração no site.');
    }catch(error){
      feedback.dataset.kind='error';
      feedback.textContent='NÃO SALVO: '+error.message;
      saveFeedback('error',feedback.textContent);
      toast('Erro ao salvar site institucional: '+error.message,true);
    }finally{submit.disabled=false;}
  });


  const CONTACT_DEFAULTS={
    instituicao:'Universidade Federal de Sergipe — Campus Prof. Alberto Carvalho',
    endereco:'Av. Vereador Olímpio Grande, s/n',
    cidade:'Itabaiana/SE',
    cep:'49506-036',
    telefone:'(79) 3432-8217',
    email:'petedusaber@gmail.com'
  };
  function renderContactInformation(){
    const info={...CONTACT_DEFAULTS,...(config.contatoInstitucional||{})};
    for(const [key,inputId] of Object.entries({
      instituicao:'contact-admin-institution',
      endereco:'contact-admin-address',
      cidade:'contact-admin-city',
      cep:'contact-admin-cep',
      telefone:'contact-admin-phone',
      email:'contact-admin-email'
    })){
      byId(inputId).value=String(info[key]??'');
    }
  }
  byId('contact-info-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const info={
      instituicao:byId('contact-admin-institution').value.trim(),
      endereco:byId('contact-admin-address').value.trim(),
      cidade:byId('contact-admin-city').value.trim(),
      cep:byId('contact-admin-cep').value.trim(),
      telefone:byId('contact-admin-phone').value.trim(),
      email:byId('contact-admin-email').value.trim().toLowerCase()
    };
    const feedback=byId('contact-info-feedback');
    const button=byId('contact-info-save');
    const required=['instituicao','endereco','cidade','telefone','email'];
    if(required.some(k=>!info[k])){
      feedback.dataset.kind='error';
      feedback.textContent='Preencha o campus, endereço, cidade, telefone e e-mail.';
      return;
    }
    const digits=info.telefone.replace(/\D/g,'');
    if(!/^[+()\d\s.-]{8,30}$/.test(info.telefone)||digits.length<10||digits.length>13){
      feedback.dataset.kind='error';
      feedback.textContent='Informe um telefone válido com DDD.';
      return;
    }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)){
      feedback.dataset.kind='error';
      feedback.textContent='Informe um e-mail válido.';
      return;
    }
    if(info.cep&&info.cep.replace(/\D/g,'').length!==8){
      feedback.dataset.kind='error';
      feedback.textContent='Informe um CEP de 8 dígitos ou deixe o campo vazio.';
      return;
    }
    button.disabled=true;
    feedback.dataset.kind='pending';
    feedback.textContent='Salvando informações do PET no GitHub...';
    try{
      const sha=await updateConfigGitHub('Atualiza endereço e contatos institucionais do PET Educação',current=>{
        current.contatoInstitucional={...(current.contatoInstitucional||{}),...info};
        return current;
      });
      renderContactInformation();
      feedback.dataset.kind='success';
      feedback.textContent=sha?'Informações salvas no GitHub. Aguarde a publicação.':'Informações já estão atualizadas.';
      if(sha)saveFeedback('success','Contatos institucionais salvos.',sha);
      toast(sha?'Contato institucional atualizado!':'Sem alterações pendentes.');
    }catch(error){
      feedback.dataset.kind='error';
      feedback.textContent='NÃO SALVO: '+error.message;
      saveFeedback('error',feedback.textContent);
      toast('Erro ao salvar informações institucionais: '+error.message,true);
    }finally{button.disabled=false;}
  });

  showDashboard(false);
  // Restabelece a sessão desta ABA após recarregar, mas só libera após nova validação do GitHub.
  try{
    const saved=sessionStorage.getItem(ACTIVE_TAB);
    if(saved){restoringSession=true;byId('token-input').value=saved;loginForm.requestSubmit();}
  }catch(e){}
})();
