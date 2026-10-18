'use strict';
// Nenhuma senha, token ou chave de administrador está incluída neste arquivo.
// O acesso de escrita depende exclusivamente de autorização validada pelo GitHub.
(()=>{
  const API='https://api.github.com/repos/'+PET_REPOSITORY;
  const ROOT='https://api.github.com';
  let token=null, currentUser=null, products=[],config={},pendingFile=null,previewURL=null,selectedColors=[],editingId=null,busy=false;
  const byId=id=>document.getElementById(id);
  const loginForm=byId('login-form'),loginScreen=byId('login-screen'),dashboard=byId('dashboard'),sessionInfo=byId('session-info'),modal=byId('editor-modal'),form=byId('editor-form');
  const paletteColors=[['Azul PET','#0FABE2'],['Azul-marinho','#173D72'],['Branco','#FFFFFF'],['Preto','#161B22'],['Rosa','#E8AAC6'],['Lilás','#A38AE0'],['Verde','#1DA88B'],['Amarelo','#F4C248'],['Vermelho','#D65353'],['Laranja','#ED9553']];
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  const toBase64=text=>{const bytes=encoder.encode(text);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);};
  const fromBase64=base64=>{const chars=atob(base64.replace(/\s/g,''));const bytes=Uint8Array.from(chars,c=>c.charCodeAt(0));return decoder.decode(bytes);};
  function toast(message,error=false){
    const e=byId('toast');
    e.textContent=message;
    e.hidden=false;
    e.style.background=error?'#a83440':'#173d72';
    window.clearTimeout(toast.timer);
    toast.timer=window.setTimeout(()=>{e.hidden=true;},7500);
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
      notice.innerHTML='<strong>Rascunho local: ainda não publicado</strong><p>O GitHub recusou salvar as mudanças. Guardei os chaveiros neste navegador. Para publicar, copie os dados e faça commit pelo editor do GitHub.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-primary" id="draft-copy">Copiar dados</button><a class="btn btn-outline" target="_blank" rel="noopener noreferrer" href="https://github.com/peteducacao/catalogo-chaveiros-pet/edit/main/data/chaveiros.json">Abrir editor do GitHub ↗</a><button type="button" class="btn btn-outline" id="draft-download">Baixar JSON</button></div><p id="draft-copy-status" role="status" aria-live="polite"></p>';
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
  async function uploadImage(file){
    if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Use uma imagem PNG, JPEG ou WebP.');
    if(file.size>15*1024*1024)throw Error('Escolha uma imagem menor que 15 MB.');
    const bitmap=await createImageBitmap(file);
    try{
      if(bitmap.width*bitmap.height>60_000_000)throw Error('Imagem muito grande. Selecione uma imagem de até 60 megapixels.');
      // Caixa quadrada de 960 pixels. Enquadra e preserva toda a imagem, sem corte ou esticamento.
      const FRAME=960,PAD=42;
      const scale=Math.min((FRAME-2*PAD)/bitmap.width,(FRAME-2*PAD)/bitmap.height);
      const width=Math.max(1,Math.round(bitmap.width*scale));
      const height=Math.max(1,Math.round(bitmap.height*scale));
      const x=Math.round((FRAME-width)/2);
      const y=Math.round((FRAME-height)/2);
      const canvas=document.createElement('canvas');
      canvas.width=FRAME;
      canvas.height=FRAME;
      const context=canvas.getContext('2d');
      if(!context)throw Error('Seu navegador não conseguiu preparar a imagem.');
      context.fillStyle='#f7faf8';
      context.fillRect(0,0,FRAME,FRAME);
      context.imageSmoothingEnabled=true;
      context.imageSmoothingQuality='high';
      context.drawImage(bitmap,x,y,width,height);
      const encoded=canvas.toDataURL('image/webp',0.86);
      if(!encoded.startsWith('data:image/webp;base64,'))throw Error('O navegador não conseguiu converter a foto. Tente uma imagem menor.');
      const b64=encoded.split(',')[1];
      const name=(file.name.replace(/\.[^.]+$/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').slice(0,32)||'chaveiro')+'-'+Date.now()+'.webp';
      const path='assets/produtos/'+name;
      await github(API+'/contents/'+path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Adiciona foto padronizada do chaveiro '+name,content:b64,branch:PET_BRANCH})});
      return path;
    }finally{bitmap.close?.();}
  }
  function showDashboard(logged){loginScreen.hidden=logged;dashboard.hidden=!logged;sessionInfo.hidden=!logged;byId('github-user').textContent=logged?'@'+(currentUser||'GitHub'):'';}
  function logout(){token=null;currentUser=null;byId('token-input').value='';showDashboard(false);closeEditor();}
  loginForm.addEventListener('submit',async event=>{
    event.preventDefault();
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
      products=loaded;
      config=configuration;
      currentUser=user.login||'GitHub';
      input.value='';
      showDashboard(true);
      render();
      const draft=loadDraft();
      if(Array.isArray(draft)&&JSON.stringify(draft)!==JSON.stringify(products)){
        products=draft;render();showDraftWarning();
      }else if(draft){try{localStorage.removeItem(DRAFT_PRODUCTS);}catch{}}
      if(repo.permissions?.push===false){
        saveFeedback('error','Login realizado: leitura autorizada, mas o GitHub não informou permissão de gravação para este token. Você pode ver os modelos. Para salvar, confira Contents: Read and write nas configurações do token.');
      }else{
        saveFeedback('pending','Login realizado: catálogo carregado. A capacidade de salvar será confirmada pelo GitHub quando você fizer uma alteração.');
      }
    }catch(e){
      token=null;
      feedback.textContent=e.message||'Não foi possível autenticar.';
      feedback.hidden=false;
    }finally{
      submit.disabled=false;
      submit.textContent='Acessar painel →';
    }
  });
  byId('logout').addEventListener('click',logout);
  document.querySelectorAll('.dash-tab').forEach(button=>button.addEventListener('click',()=>{const tab=button.dataset.tab;document.querySelectorAll('.dash-tab').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});byId('section-products').hidden=tab!=='products';byId('section-texts').hidden=tab!=='texts';}));
  function render(){byId('stat-total').textContent=products.length;byId('stat-available').textContent=products.filter(productAvailable).length;byId('stat-off').textContent=products.filter(p=>!productAvailable(p)).length;byId('global-notice').value=config.avisoImagens||'';renderProducts();}
  function renderProducts(){const wrap=byId('admin-products');const query=byId('admin-search').value.toLocaleLowerCase('pt-BR');const view=products.filter(p=>p.nome.toLocaleLowerCase('pt-BR').includes(query));wrap.replaceChildren();if(!view.length){wrap.append(node('p','empty','Nenhum modelo encontrado.'));return;}for(const p of view){const card=node('article','manage-card'),photo=node('img','manage-photo');photo.src=safeImageUrl(p.imagem);photo.alt='Imagem de '+p.nome;const body=node('div','manage-body');body.append(node('h3','',p.nome));body.append(node('p','manage-color',(p.cores||[]).map(c=>c.nome).join(' • ')||'Sem cores cadastradas'));const bottom=node('div','manage-bottom');const toggle=node('button','availability-toggle '+(productAvailable(p)?'':'off'),productAvailable(p)?'● Disponível':'● Sem estoque');toggle.type='button';toggle.title='Alternar disponibilidade deste chaveiro';toggle.addEventListener('click',()=>toggleStock(p,toggle));const actions=node('div','manage-actions');const edit=node('button','','Editar'),remove=node('button','delete','Excluir');edit.type='button';remove.type='button';edit.addEventListener('click',()=>openEditor(p));remove.addEventListener('click',()=>deleteProduct(p));actions.append(edit,remove);bottom.append(toggle,actions);body.append(bottom);card.append(photo,body);wrap.append(card);}}
  byId('admin-search').addEventListener('input',renderProducts);
  async function saveProducts(message){
    if(busy)throw Error('Aguarde o salvamento anterior.');
    busy=true;
    saveFeedback('pending','Salvando alteração no GitHub...');
    try{
      const result=await repoWrite('data/chaveiros.json',JSON.stringify(products,null,2)+'\n',message);
      const sha=result?.commit?.sha;
      if(!/^[a-f0-9]{40}$/i.test(sha||''))throw Error('O GitHub não devolveu confirmação do commit. Verifique o arquivo no repositório antes de repetir.');
      try{localStorage.removeItem(DRAFT_PRODUCTS);}catch{}
      showDraftWarning();
      render();
      saveFeedback('success','Salvo no GitHub! A publicação do catálogo pode levar alguns minutos.',sha);
      toast('Alteração salva no GitHub. O catálogo atualizará após a publicação.');
      return sha;
    }catch(e){
      const stored=keepDraft(e);
      saveFeedback('error','NÃO PUBLICADO. '+e.message+(stored?' Alterações preservadas como rascunho neste navegador.':' Não foi possível salvar um rascunho local.'));
      toast('GitHub recusou salvar. '+(stored?'Rascunho preservado neste navegador.':'Não houve gravação.'),true);
      throw e;
    }finally{
      busy=false;
    }
  }
  async function toggleStock(p,button){if(busy)return;const old={estoque:p.estoque,disponivel:p.disponivel};const wasAvailable=productAvailable(p);p.disponivel=!wasAvailable;if(p.disponivel&&Number(p.estoque)<=0)p.estoque=1;button.disabled=true;try{await saveProducts('Atualiza disponibilidade: '+p.nome);}catch(e){if(!e.savedAsDraft){p.estoque=old.estoque;p.disponivel=old.disponivel;render();}}finally{button.disabled=false;}}
  async function deleteProduct(p){if(busy)return;if(!window.confirm('Excluir o chaveiro "'+p.nome+'" do catálogo?'))return;const old=products;products=products.filter(x=>x.id!==p.id);try{await saveProducts('Remove chaveiro '+p.nome);}catch(e){if(!e.savedAsDraft){products=old;render();}}}
  const palette=byId('palette');function colorKey(c){return String(c.hex).toUpperCase()+'|'+String(c.nome).toLowerCase();}
  function paintPalette(){palette.replaceChildren();for(const [name,hex] of paletteColors){const picked=selectedColors.some(c=>c.nome===name&&c.hex.toUpperCase()===hex.toUpperCase());const b=node('button','palette-button'+(picked?' selected':''),name);b.type='button';b.setAttribute('aria-pressed',String(picked));const dot=node('span','dot');dot.style.backgroundColor=hex;b.prepend(dot);b.addEventListener('click',()=>{if(picked)selectedColors=selectedColors.filter(c=>!(c.nome===name&&c.hex.toUpperCase()===hex.toUpperCase()));else selectedColors.push({nome:name,hex});paintPalette();});palette.append(b);}const selected=byId('selected-colors');selected.replaceChildren();for(const c of selectedColors){const chip=node('span','selected-color');const dot=node('span','dot');dot.style.backgroundColor=safeHex(c.hex);const remove=node('button','','×');remove.type='button';remove.title='Remover '+c.nome;remove.addEventListener('click',()=>{selectedColors=selectedColors.filter(x=>colorKey(x)!==colorKey(c));paintPalette();});chip.append(dot,document.createTextNode(c.nome),remove);selected.append(chip);}}
  byId('add-color').addEventListener('click',()=>{const hex=byId('custom-color').value,name=byId('custom-color-name').value.trim()||'Personalizada';if(selectedColors.some(c=>colorKey(c)===colorKey({nome:name,hex}))){toast('Essa cor já foi selecionada.',true);return;}selectedColors.push({nome:name,hex});byId('custom-color-name').value='';paintPalette();});
  function setImagePreview(src){byId('product-preview').src=safeImageUrl(src);}
  function mode(){return form.querySelector('input[name=image-source]:checked').value;}
  function updateImageMode(){const file=mode()==='file';byId('image-file-wrap').hidden=!file;byId('image-url-wrap').hidden=file;}
  form.querySelectorAll('input[name=image-source]').forEach(r=>r.addEventListener('change',updateImageMode));
  byId('product-file').addEventListener('change',event=>{pendingFile=event.target.files?.[0]||null;if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}if(pendingFile){previewURL=URL.createObjectURL(pendingFile);byId('product-preview').src=previewURL;}else if(editingId){setImagePreview(products.find(p=>p.id===editingId)?.imagem);}else setImagePreview('assets/mock-pet.svg');});
  byId('product-url').addEventListener('input',event=>{const u=event.target.value;if(/^https:\/\//i.test(u))setImagePreview(u);});
  function updateCaptionVisibility(){byId('caption-field').hidden=!byId('product-illustrative').checked;}
  byId('product-illustrative').addEventListener('change',updateCaptionVisibility);
  function openEditor(product){editingId=product?.id||null;pendingFile=null;if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}form.reset();byId('product-file').value='';byId('product-name').value=product?.nome||'';byId('product-description').value=product?.descricao||'';byId('product-quantity').value=Number(product?.estoque)||0;byId('product-available').checked=product?Boolean(product.disponivel):true;byId('product-illustrative').checked=product?Boolean(product.imagemIlustrativa):false;byId('product-caption').value=product?.legendaImagem||'Imagem ilustrativa';byId('product-url').value=(product&&/^https:\/\//.test(product.imagem))?product.imagem:'';selectedColors=(product?.cores||[]).map(c=>({...c}));const isUrl=/^https:\/\//.test(product?.imagem||'');form.querySelector(`input[name=image-source][value=${isUrl?'url':'file'}]`).checked=true;updateImageMode();updateCaptionVisibility();paintPalette();setImagePreview(product?.imagem||'assets/mock-pet.svg');byId('editor-error').hidden=true;clearEditorFeedback();byId('editor-title').textContent=product?'Editar chaveiro':'Novo chaveiro';modal.showModal();}
  function closeEditor(){if(modal.open)modal.close();if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}pendingFile=null;}
  byId('btn-add').addEventListener('click',()=>openEditor(null));byId('close-modal').addEventListener('click',closeEditor);byId('cancel-modal').addEventListener('click',closeEditor);modal.addEventListener('click',e=>{if(e.target===modal)closeEditor();});
  form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const name=byId('product-name').value.trim(),description=byId('product-description').value.trim(),quantity=Number(byId('product-quantity').value);const err=byId('editor-error'),save=byId('save-product');err.hidden=true;clearEditorFeedback();if(!name||!description){err.textContent='Preencha o nome e a descrição.';err.hidden=false;editorFeedback('error',err.textContent);return;}if(!Number.isInteger(quantity)||quantity<0){err.textContent='Informe uma quantidade válida (zero ou mais).';err.hidden=false;editorFeedback('error',err.textContent);return;}let image=products.find(p=>p.id===editingId)?.imagem||'assets/mock-pet.svg';if(mode()==='url'){const u=byId('product-url').value.trim();if(!/^https:\/\//i.test(u)){err.textContent='Informe um link HTTPS direto para a imagem.';err.hidden=false;editorFeedback('error',err.textContent);return;}if(/^https:\/\/(www\.)?imgur\.com\//i.test(u)&&!/^https:\/\/i\.imgur\.com\/[^?#]+\.(png|jpe?g|webp)([?#].*)?$/i.test(u)){err.textContent='No Imgur use o link direto da foto (i.imgur.com/arquivo.jpg), não o link do álbum.';err.hidden=false;editorFeedback('error',err.textContent);return;}image=u;}else if(!editingId&&!pendingFile){err.textContent='Envie uma imagem do computador ou selecione a opção de link HTTPS.';err.hidden=false;editorFeedback('error',err.textContent);return;}save.disabled=true;save.textContent='Salvando...';editorFeedback('pending','Salvando no GitHub. Aguarde a confirmação...');try{if(mode()==='file'&&pendingFile){editorFeedback('pending','Enviando fotografia ao GitHub...');image=await uploadImage(pendingFile);editorFeedback('pending','Imagem enviada. Salvando cadastro...');}const existing=products.find(p=>p.id===editingId);const product={id:existing?.id||'chaveiro-'+Date.now(),nome:name,descricao:description,imagem:image,cores:selectedColors.map(c=>({nome:c.nome,hex:safeHex(c.hex)})),estoque:quantity,disponivel:byId('product-available').checked,imagemIlustrativa:byId('product-illustrative').checked,legendaImagem:byId('product-caption').value.trim()||'Imagem ilustrativa'};const previous=products;products=existing?products.map(p=>p.id===existing.id?product:p):[product,...products];try{await saveProducts(existing?'Edita chaveiro '+name:'Cadastra chaveiro '+name);closeEditor();}catch(e){if(!e.savedAsDraft)products=previous;throw e;}}catch(e){err.textContent='Não foi salvo: '+e.message;err.hidden=false;editorFeedback('error',err.textContent);saveFeedback('error',err.textContent);toast(err.textContent,true);}finally{save.disabled=false;save.textContent='Salvar chaveiro';}});
  byId('save-global').addEventListener('click',async()=>{if(busy)return;const value=byId('global-notice').value.trim();const old={...config};config.avisoImagens=value;const button=byId('save-global');button.disabled=true;byId('global-feedback').textContent='Salvando...';try{saveFeedback('pending','Salvando texto no GitHub...');const saved=await repoWrite('data/config.json',JSON.stringify(config,null,2)+'\n','Atualiza texto informativo do catálogo');const sha=saved?.commit?.sha;if(!/^[a-f0-9]{40}$/i.test(sha||''))throw Error('O GitHub não confirmou o commit do texto.');byId('global-feedback').textContent='Texto salvo no GitHub.';saveFeedback('success','Texto do catálogo salvo no GitHub.',sha);toast('Texto do catálogo salvo.');}catch(e){config=old;byId('global-feedback').textContent='NÃO SALVO: '+e.message;saveFeedback('error','NÃO SALVO: '+e.message);toast('Não foi possível salvar o texto. '+e.message,true);}finally{button.disabled=false;}});
  showDashboard(false);
})();
