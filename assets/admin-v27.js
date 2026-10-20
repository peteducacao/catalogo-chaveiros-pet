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
  const paletteColors=[['Azul PET','#0FABE2'],['Azul-marinho','#173D72'],['Branco','#FFFFFF'],['Preto','#161B22'],['Rosa','#E8AAC6'],['Lilás','#A38AE0'],['Verde','#1DA88B'],['Amarelo','#F4C248'],['Vermelho','#D65353'],['Laranja','#ED9553']];
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
  function saveFeedback(kind,message,sha=null){
    const area=byId('save-feedback');
    const label=byId('save-message');
    const link=byId('save-commit');
    if(!area||!label)return;
    area.hidden=false;
    area.dataset.kind=kind;
    label.textContent=message;
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
  async function choosePhoto(file){
    if(!file){
      pendingFile=null;pendingImageData=null;
      byId('image-fit-reopen').hidden=true;
      const previous=products.find(p=>p.id===editingId);
      setImagePreview(previous?.imagem||'assets/sem-foto.svg');
      return;
    }
    if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Escolha uma imagem PNG, JPEG ou WebP.');
    if(file.size>15*1024*1024)throw Error('A foto deve ter menos de 15 MB.');
    const bitmap=await createImageBitmap(file);
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
    if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Use uma imagem PNG, JPEG ou WebP.');
    if(file.size>15*1024*1024)throw Error('Escolha uma imagem menor que 15 MB.');
    let encoded=preparedImage;
    if(!encoded){
      const bitmap=await createImageBitmap(file);
      try{
        if(bitmap.width*bitmap.height>60_000_000)throw Error('Imagem muito grande. Use até 60 megapixels.');
        encoded=squareImage(bitmap,{zoom:1,dx:0,dy:0},960).toDataURL('image/webp',0.86);
      }finally{bitmap.close?.();}
    }
    if(!encoded.startsWith('data:image/webp;base64,'))throw Error('A fotografia não pôde ser convertida. Tente novamente.');
    const name=(file.name.replace(/\.[^.]+$/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').slice(0,32)||'chaveiro')+'-'+Date.now()+'.webp';
    const path='assets/produtos/'+name;
    await github(API+'/contents/'+path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Publica foto enquadrada do chaveiro '+name,content:encoded.split(',')[1],branch:PET_BRANCH})});
    return path;
  }
  function showDashboard(logged){
    loginScreen.hidden=logged;
    dashboard.hidden=!logged;
    sessionInfo.hidden=!logged;
    // Garante que as seções se excluam mesmo se houver CSS antigo em cache.
    loginScreen.style.display=logged?'none':'';
    dashboard.style.display=logged?'':'none';
    sessionInfo.style.display=logged?'':'none';
    byId('github-user').textContent=logged?'@'+(currentUser||'GitHub'):'';
  }
  function logout(){
    try{sessionStorage.removeItem(ACTIVE_TAB);}catch(e){}
    token=null;currentUser=null;byId('token-input').value='';showDashboard(false);closeEditor();
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
        saveFeedback('pending','Login realizado: catálogo carregado. A capacidade de salvar será confirmada pelo GitHub quando você fizer uma alteração.');
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
    function switchTab(tab){
    if(!['products','texts','socials','website'].includes(tab))return;
    document.querySelectorAll('.dash-tab').forEach(button=>{
      const active=button.dataset.tab===tab;
      button.classList.toggle('active',active);
      button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
    });
    byId('section-products').hidden=tab!=='products';
    byId('section-texts').hidden=tab!=='texts';
    byId('section-socials').hidden=tab!=='socials';
    byId('section-website').hidden=tab!=='website';
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

  function render(){byId('stat-total').textContent=products.length;byId('stat-available').textContent=products.filter(productAvailable).length;byId('stat-off').textContent=products.filter(p=>!productAvailable(p)).length;const units=byId('stat-units');if(units)units.textContent=products.filter(productAvailable).reduce((sum,p)=>sum+(Number(p.estoque)||0),0)+' unidades em estoque';byId('config-home-description').value=typeof config.homeDescription==='string'?config.homeDescription:'Conheça nosso catálogo! Para mais informações, acompanhe o Instagram do PET Educação.';byId('config-catalog-description').value=typeof config.catalogDescription==='string'?config.catalogDescription:'Conheça nosso catálogo! Para mais informações, acompanhe o Instagram do PET Educação.';renderProducts();renderSocialList();renderInstitutionalWebsite();}
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
  const palette=byId('palette');function colorKey(c){return String(c.hex).toUpperCase()+'|'+String(c.nome).toLowerCase();}
  function paintPalette(){palette.replaceChildren();for(const [name,hex] of paletteColors){const picked=selectedColors.some(c=>c.nome===name&&c.hex.toUpperCase()===hex.toUpperCase());const b=node('button','palette-button'+(picked?' selected':''),name);b.type='button';b.setAttribute('aria-pressed',String(picked));const dot=node('span','dot');dot.style.backgroundColor=hex;b.prepend(dot);b.addEventListener('click',()=>{if(picked)selectedColors=selectedColors.filter(c=>!(c.nome===name&&c.hex.toUpperCase()===hex.toUpperCase()));else selectedColors.push({nome:name,hex});paintPalette();});palette.append(b);}const selected=byId('selected-colors');selected.replaceChildren();for(const c of selectedColors){const chip=node('span','selected-color');const dot=node('span','dot');dot.style.backgroundColor=safeHex(c.hex);const remove=node('button','','×');remove.type='button';remove.title='Remover '+c.nome;remove.addEventListener('click',()=>{selectedColors=selectedColors.filter(x=>colorKey(x)!==colorKey(c));paintPalette();});chip.append(dot,document.createTextNode(c.nome),remove);selected.append(chip);}}
  byId('add-color').addEventListener('click',()=>{const hex=byId('custom-color').value,name=byId('custom-color-name').value.trim()||'Personalizada';if(selectedColors.some(c=>colorKey(c)===colorKey({nome:name,hex}))){toast('Essa cor já foi selecionada.',true);return;}selectedColors.push({nome:name,hex});byId('custom-color-name').value='';paintPalette();});
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
  byId('product-url').addEventListener('input',event=>{const u=event.target.value;if(/^https:\/\//i.test(u))setImagePreview(u);});
  function updateCaptionVisibility(){byId('caption-field').hidden=!byId('product-illustrative').checked;}
  function updateColorDisplay(){byId('color-palette-controls').hidden=!byId('product-show-colors').checked;}
  byId('product-show-colors').addEventListener('change',updateColorDisplay);
  byId('product-illustrative').addEventListener('change',updateCaptionVisibility);
  function openEditor(product){editingId=product?.id||null;pendingFile=null;pendingImageData=null;if(fitBitmap){fitBitmap.close?.();fitBitmap=null;}byId('image-fit-reopen').hidden=true;if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}form.reset();byId('product-file').value='';byId('product-name').value=product?.nome||'';byId('product-description').value=product?.descricao||'';byId('product-quantity').value=Number(product?.estoque)||0;const existingPrice=product?priceOf(product):null;byId('product-price').value=existingPrice===null?'':existingPrice.toFixed(2).replace('.',',');byId('product-show-colors').checked=product?product.mostrarCores!==false:true;updateColorDisplay();byId('product-available').checked=product?Boolean(product.disponivel):true;byId('product-illustrative').checked=product?Boolean(product.imagemIlustrativa):false;byId('product-caption').value=product?.legendaImagem||'Imagem ilustrativa';byId('product-url').value=(product&&/^https:\/\//.test(product.imagem))?product.imagem:'';selectedColors=(product?.cores||[]).map(c=>({...c}));const isUrl=/^https:\/\//.test(product?.imagem||'');form.querySelector(`input[name=image-source][value=${isUrl?'url':'file'}]`).checked=true;updateImageMode();updateCaptionVisibility();paintPalette();setImagePreview(product?.imagem||'assets/sem-foto.svg');byId('editor-error').hidden=true;clearEditorFeedback();byId('editor-title').textContent=product?'Editar chaveiro':'Novo chaveiro';modal.showModal();}
  function closeEditor(){if(fitDialog.open)fitDialog.close();if(modal.open)modal.close();if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}if(fitBitmap){fitBitmap.close?.();fitBitmap=null;}pendingFile=null;pendingImageData=null;byId('image-fit-reopen').hidden=true;}
  byId('btn-add').addEventListener('click',()=>openEditor(null));byId('close-modal').addEventListener('click',closeEditor);byId('cancel-modal').addEventListener('click',closeEditor);modal.addEventListener('click',e=>{if(e.target===modal)closeEditor();});
  form.addEventListener('submit',async e=>{e.preventDefault();if(byId('save-product').disabled)return;const name=byId('product-name').value.trim(),description=byId('product-description').value.trim(),quantity=Number(byId('product-quantity').value);const err=byId('editor-error'),save=byId('save-product');err.hidden=true;clearEditorFeedback();if(!name||!description){err.textContent='Preencha o nome e a descrição.';err.hidden=false;editorFeedback('error',err.textContent);return;}if(!Number.isInteger(quantity)||quantity<0){err.textContent='Informe uma quantidade válida (zero ou mais).';err.hidden=false;editorFeedback('error',err.textContent);return;}let newPrice;try{newPrice=parsePrice(byId('product-price').value);}catch(error){err.textContent=error.message;err.hidden=false;editorFeedback('error',err.textContent);return;}let image=products.find(p=>p.id===editingId)?.imagem||'assets/sem-foto.svg';if(mode()==='url'){const u=byId('product-url').value.trim();if(u&&!/^https:\/\//i.test(u)){err.textContent='Informe um link HTTPS direto para a imagem.';err.hidden=false;editorFeedback('error',err.textContent);return;}if(u&&/^https:\/\/(www\.)?imgur\.com\//i.test(u)&&!/^https:\/\/i\.imgur\.com\/[^?#]+\.(png|jpe?g|webp)([?#].*)?$/i.test(u)){err.textContent='No Imgur use o link direto da foto (i.imgur.com/arquivo.jpg), não o link do álbum.';err.hidden=false;editorFeedback('error',err.textContent);return;}if(u)image=u;}save.disabled=true;save.textContent='Salvando...';editorFeedback('pending','Salvando no GitHub. Aguarde a confirmação...');try{if(mode()==='file'&&pendingFile){editorFeedback('pending','Enviando fotografia ao GitHub...');image=await uploadImage(pendingFile,pendingImageData);editorFeedback('pending','Imagem enviada. Salvando cadastro...');}const existing=products.find(p=>p.id===editingId);const product={...existing,id:existing?.id||'chaveiro-'+Date.now(),ordem:existing?.ordem??0,nome:name,descricao:description,imagem:image,cores:selectedColors.map(c=>({nome:c.nome,hex:safeHex(c.hex)})),mostrarCores:byId('product-show-colors').checked,estoque:quantity,preco:newPrice,disponivel:byId('product-available').checked,imagemIlustrativa:byId('product-illustrative').checked,legendaImagem:byId('product-caption').value.trim()||'Imagem ilustrativa'};try{await saveProducts(existing?'Edita chaveiro '+name:'Cadastra chaveiro '+name,latest=>{if(existing){const idx=latest.findIndex(p=>p.id===existing.id);if(idx<0)throw Error('O modelo foi removido do GitHub. Atualize o painel.');latest[idx]={...latest[idx],...product};return latest;}if(latest.some(p=>p.id===product.id))throw Error('Este identificador já existe. Tente novamente.');return [product,...latest];});closeEditor();}catch(e){throw e;}}catch(e){err.textContent='Não foi salvo: '+e.message;err.hidden=false;editorFeedback('error',err.textContent);saveFeedback('error',err.textContent);toast(err.textContent,true);}finally{save.disabled=false;save.textContent='Salvar chaveiro';}});

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
  function clearSocialForm(){
    byId('social-form').reset();
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

  byId('save-global').addEventListener('click',async()=>{
    const home=byId('config-home-description').value.trim();
    const catalog=byId('config-catalog-description').value.trim();
    const button=byId('save-global');
    button.disabled=true;
    byId('global-feedback').textContent='Salvando no GitHub...';
    try{
      saveFeedback('pending','Salvando os textos no GitHub...');
      const sha=await updateConfigGitHub('Atualiza mensagens do catálogo PET',current=>{
        current.homeDescription=home;
        current.catalogDescription=catalog;
        return current;
      });
      byId('global-feedback').textContent=sha?'Textos salvos no GitHub!':'Textos já estão atualizados.';
      if(sha)saveFeedback('success','Textos salvos no GitHub!',sha);
      toast(sha?'Textos publicados com sucesso!':'Nenhuma mudança nos textos.');
    }catch(error){
      byId('global-feedback').textContent='NÃO SALVO: '+error.message;
      saveFeedback('error','NÃO SALVO: '+error.message);
      toast('Erro ao salvar textos: '+error.message,true);
    }finally{button.disabled=false;}
  });
  showDashboard(false);
  // Restabelece a sessão desta ABA após recarregar, mas só libera após nova validação do GitHub.
  try{
    const saved=sessionStorage.getItem(ACTIVE_TAB);
    if(saved){restoringSession=true;byId('token-input').value=saved;loginForm.requestSubmit();}
  }catch(e){}
})();
