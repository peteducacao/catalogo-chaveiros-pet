/* Central de Gestão PET — reutiliza a navegação testada do Inventário PET.
   Só organiza a interface: toda a lógica de chaveiros, cores, coleções e gravações
   continua no admin-cloudflare.js, sem alterar dados ou endpoints. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dashboard = $('dashboard');
  if (!dashboard || $('cg-workspace')) return;
  const nodes = {
    feedback: $('save-feedback'),
    stats: dashboard.querySelector('.dashboard-top'),
    tabs: dashboard.querySelector('.dashboard-control-bar'),
    products: $('section-products'),
    contacts: $('section-contacts')
  };
  if (Object.values(nodes).some(n => !n)) return;

  const iconPaths = {
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    box:'<path d="m12 2 9 5-9 5-9-5zM3 7v10l9 5 9-5V7M12 12v10"/>',
    palette:'<path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.3-3.5 2 2 0 0 1 1.4-3.5H19a2 2 0 0 0 2-2A9 9 0 0 0 12 3z"/><circle cx="7.5" cy="12" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    layers:'<path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
    edit:'<path d="M12 20h9M16.5 4.5a2.1 2.1 0 0 1 3 3L9 18l-4 1 1-4z"/>',
    link:'<path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 1 0 11 21l1.7-1.7"/>',
    plus:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    alert:'<path d="m12 3 10 18H2zM12 9v5M12 18h.01"/>',
    boxes:'<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    close:'<path d="M6 6l12 12M18 6 6 18"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>'
  };
  const icon = (key, size=19) => '<svg viewBox="0 0 24 24" width="'+size+'" height="'+size+'" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[key]||iconPaths.box)+'</svg>';
  const definitions = [
    ['overview','Visão geral','home','Resumo do catálogo e ações rápidas.'],
    ['products','Chaveiros','box','Cadastre, encontre e organize seus modelos.'],
    ['colors','Cores','palette','Sua paleta de cores em um só lugar.'],
    ['collections','Coleções','layers','Organize os modelos em coleções.'],
    ['analytics','Estatísticas','boxes','Acompanhe acessos e interesse nos chaveiros.'],
    ['contacts','Contatos e links','link','Atualize as redes sociais e os contatos.']
  ];
  const root = document.createElement('div');
  root.className = 'cg-workspace';
  root.id = 'cg-workspace';
  const aside = document.createElement('aside');
  aside.className = 'cg-sidebar';
  aside.id = 'cg-sidebar';
  aside.setAttribute('aria-label','Navegação administrativa');
  const brand=document.createElement('div');
  brand.className='cg-brand';
  brand.innerHTML='<img src="assets/logo-pet.svg" alt="" width="52" height="52"><span><strong>PET Educação</strong><small>Central de Gestão</small></span>';
  const nav=document.createElement('nav');
  nav.className='cg-nav';
  nav.setAttribute('aria-label','Áreas do painel');
  nav.innerHTML=definitions.map(([id,title,glyph])=>'<button type="button" class="cg-nav-button" data-cg-view="'+id+'" aria-current="false">'+icon(glyph)+'<span>'+title+'</span></button>').join('');
  const asideFoot=document.createElement('div');
  asideFoot.className='cg-aside-foot';
  asideFoot.innerHTML='<span class="cg-aside-caption">CATÁLOGO DE CHAVEIROS</span><a href="catalogo.html" class="cg-sidebar-public">'+icon('arrow',17)+' Abrir catálogo público</a>';
  aside.append(brand,nav,asideFoot);

  const main=document.createElement('div');
  main.className='cg-main';
  const top=document.createElement('header');
  top.className='cg-main-head';
  top.innerHTML='<button type="button" id="cg-menu-toggle" class="cg-menu-toggle" aria-label="Abrir menu do painel" aria-expanded="false" aria-controls="cg-sidebar">'+icon('menu',21)+'</button>'+
    '<div class="cg-heading"><span class="cg-eyebrow">PET EDUCAÇÃO · ADMINISTRAÇÃO</span><h1 id="cg-view-title">Visão geral</h1><p id="cg-view-description">Resumo do catálogo e ações rápidas.</p></div>'+
    '<a class="cg-public-top" href="catalogo.html">'+icon('arrow',16)+' Ver catálogo</a>';
  const mobileShade=document.createElement('button');
  mobileShade.type='button';
  mobileShade.className='cg-menu-shade';
  mobileShade.id='cg-menu-shade';
  mobileShade.hidden=true;
  mobileShade.setAttribute('aria-label','Fechar menu do painel');

  const overview=document.createElement('section');
  overview.id='cg-overview';
  overview.className='cg-overview';
  overview.setAttribute('aria-label','Visão geral do catálogo');
  const statsHeader=document.createElement('div');
  statsHeader.className='cg-overview-label';
  statsHeader.innerHTML='<h2>Seu catálogo em números</h2><p>Dados atuais dos chaveiros cadastrados</p>';
  overview.append(statsHeader);
  const unitsCard=document.createElement('div');
  unitsCard.className='stat-card cg-unit-card';
  unitsCard.innerHTML='<span>Unidades em estoque</span><strong id="cg-stock-total">0</strong>';
  nodes.stats.append(unitsCard);
  const overviewGrid=document.createElement('div');
  overviewGrid.className='cg-overview-grid';
  const quick=document.createElement('section');
  quick.className='cg-panel cg-quick';
  quick.innerHTML='<div class="cg-panel-heading"><span class="cg-panel-icon">'+icon('plus',20)+'</span><h2>Acesso rápido</h2></div>'+
    '<div class="cg-quick-grid">'+
    '<button type="button" data-cg-action="new">'+icon('plus')+' Novo chaveiro</button>'+
    '<button type="button" data-cg-action="products">'+icon('box')+' Ver chaveiros</button>'+
    '<button type="button" data-cg-action="colors">'+icon('palette')+' Gerenciar cores</button>'+
    '<button type="button" data-cg-action="collections">'+icon('layers')+' Gerenciar coleções</button>'+
    '</div>';
  const status=document.createElement('section');
  status.className='cg-panel cg-health';
  status.innerHTML='<div class="cg-panel-heading"><span class="cg-panel-icon">'+icon('check',20)+'</span><h2>Situação do catálogo</h2></div>'+
    '<div class="cg-health-values"><strong id="cg-health-label">—</strong><span id="cg-health-ratio">—</span></div>'+
    '<div class="cg-health-track" aria-hidden="true"><span id="cg-health-progress"></span></div>'+
    '<p id="cg-health-note" class="cg-health-note">Disponibilidade calculada a partir dos modelos cadastrados.</p>'+
    '<button type="button" class="cg-inline-action" data-cg-action="products">Gerenciar chaveiros '+icon('arrow',16)+'</button>';
  overviewGrid.append(quick,status);
  overview.append(nodes.stats,overviewGrid);

  // Relatórios reais do D1. Não armazenam IP ou nome de visitante.
  const analytics=document.createElement('section');
  analytics.id='cg-analytics';
  analytics.className='cg-analytics';
  analytics.hidden=true;
  analytics.innerHTML=
    '<div class="cg-analytics-controls"><div><h2>Visitas e interesse</h2><p>Contagem anônima com autorização dos visitantes.</p></div>'+
    '<div class="cg-analytics-filter"><label for="cg-analytics-days">Período</label><select id="cg-analytics-days"><option value="7">7 dias</option><option value="30" selected>30 dias</option><option value="90">90 dias</option></select>'+
    '<button type="button" id="cg-analytics-reload" aria-label="Atualizar estatísticas">↻ Atualizar</button></div></div>'+
    '<p id="cg-analytics-message" class="cg-analytics-message" role="status" aria-live="polite"></p>'+
    '<div class="cg-analytics-summary">'+
    '<div class="cg-analytic-card"><span>Acessos no período</span><strong id="cg-analytics-views">—</strong></div>'+
    '<div class="cg-analytic-card"><span>Visitantes por dia*</span><strong id="cg-analytics-visitors">—</strong></div>'+
    '<div class="cg-analytic-card"><span>Cliques registrados</span><strong id="cg-analytics-clicks">—</strong></div>'+
    '<div class="cg-analytic-card"><span>Acessos hoje</span><strong id="cg-analytics-today">—</strong></div></div>'+
    '<div class="cg-analytics-grid"><section class="cg-panel"><h3>Acessos por dia</h3><div id="cg-analytics-chart" class="cg-analytics-chart"></div></section>'+
    '<section class="cg-panel"><h3>Chaveiros mais explorados</h3><ol id="cg-analytics-ranking" class="cg-analytics-ranking"></ol></section></div>'+
    '<section class="cg-panel cg-analytics-actions"><h3>O que foi clicado</h3><div id="cg-analytics-actions"></div></section>'+
    '<p class="cg-analytics-disclaimer">*Visitantes estimados por navegador que permitiu estatísticas; o mesmo navegador em dois dias conta duas vezes. Não armazenamos IPs. Visitas anteriores à ativação não são recuperadas.</p>';
  let analyticsRequest=0;
  const formatNumber=value=>new Intl.NumberFormat('pt-BR').format(Number(value)||0);
  function showAnalyticsData(data,products){
    const dayRows=Array.isArray(data.daily)?data.daily:[];
    const actions=Array.isArray(data.actions)?data.actions:[];
    const today=dayRows.find(item=>item.day===data.today);
    $('cg-analytics-views').textContent=formatNumber(data.views);
    $('cg-analytics-visitors').textContent=formatNumber(data.visitorDays);
    $('cg-analytics-clicks').textContent=formatNumber(data.clicks);
    $('cg-analytics-today').textContent=formatNumber(today?.views||0);
    const chart=$('cg-analytics-chart');
    chart.replaceChildren();
    const displayed=dayRows.slice(-14);
    const maximum=Math.max(1,...displayed.map(item=>Number(item.views)||0));
    if(!displayed.length){
      const empty=document.createElement('p');empty.className='cg-analytics-empty';
      empty.textContent='Nenhum acesso registrado neste período.';
      chart.append(empty);
    }else{
      for(const row of displayed){
        const item=document.createElement('div');
        item.className='cg-analytics-bar-row';
        const day=document.createElement('span');day.textContent=String(row.day||'').slice(5).split('-').reverse().join('/');
        const bar=document.createElement('div');bar.className='cg-analytics-bar-bg';
        const filled=document.createElement('span');filled.style.width=Math.max(2,100*(Number(row.views)||0)/maximum)+'%';bar.append(filled);
        const count=document.createElement('strong');count.textContent=formatNumber(row.views);
        item.append(day,bar,count);chart.append(item);
      }
    }
    const productNames=new Map((Array.isArray(products)?products:[]).map(item=>[String(item.id||''),String(item.nome||'Chaveiro')]));
    const ranks=new Map();
    const totals=new Map();
    for(const row of actions){
      const kind=String(row.kind||''),amount=Number(row.total)||0,productId=String(row.product_id||'');
      totals.set(kind,(totals.get(kind)||0)+amount);
      if(productId)ranks.set(productId,(ranks.get(productId)||0)+amount);
    }
    const list=$('cg-analytics-ranking');list.replaceChildren();
    const top=[...ranks].sort((a,b)=>b[1]-a[1]).slice(0,7);
    if(!top.length){
      const item=document.createElement('li');item.textContent='Ainda não há cliques em chaveiros.';item.className='cg-analytics-empty';list.append(item);
    }else{
      for(const [id,amount] of top){
        const item=document.createElement('li');
        const name=document.createElement('span');name.textContent=productNames.get(id)||id;
        const count=document.createElement('strong');count.textContent=formatNumber(amount);
        item.append(name,count);list.append(item);
      }
    }
    const actionsTarget=$('cg-analytics-actions');actionsTarget.replaceChildren();
    for(const [kind,label] of [['zoom','Fotos ampliadas'],['cor','Cores escolhidas'],['copiar','Detalhes copiados'],['instagram','Acessos ao Instagram']]){
      const item=document.createElement('div');item.className='cg-analytics-action-row';
      const text=document.createElement('span');text.textContent=label;
      const count=document.createElement('strong');count.textContent=formatNumber(totals.get(kind)||0);
      item.append(text,count);actionsTarget.append(item);
    }
    $('cg-analytics-message').textContent='Atualizado com dados do Catálogo PET. Os números dependem do consentimento dos visitantes.';
  }
  async function loadAnalytics(){
    const requestId=++analyticsRequest;
    const days=$('cg-analytics-days').value;
    $('cg-analytics-message').textContent='Consultando estatísticas...';
    try{
      const response=await fetch('/api/admin/analytics?days='+encodeURIComponent(days),{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw Error(response.status===401?'Sessão expirada. Entre novamente.':'Não foi possível consultar o banco.');
      const data=await response.json();
      const productsResponse=await fetch('/api/data/chaveiros.json',{cache:'no-store'});
      const products=productsResponse.ok?await productsResponse.json():[];
      if(requestId!==analyticsRequest)return;
      showAnalyticsData(data,products);
    }catch(error){
      if(requestId!==analyticsRequest)return;
      $('cg-analytics-message').textContent=error.message||'Não foi possível carregar as estatísticas.';
    }
  }
  $('cg-analytics-days').addEventListener('change',loadAnalytics);
  $('cg-analytics-reload').addEventListener('click',loadAnalytics);

  const tools=document.createElement('section');
  tools.id='cg-tools';
  tools.className='cg-tools';
  tools.hidden=true;
  tools.innerHTML='<div class="cg-panel cg-tool-card"><span class="cg-tool-symbol" id="cg-tool-icon"></span><h2 id="cg-tool-title">Organização</h2><p id="cg-tool-description"></p><button type="button" id="cg-tool-open" class="btn btn-primary"></button></div>';

  // Preserve each original ID and event handler. Only move these existing elements.
  main.append(top,nodes.feedback,overview,tools,analytics,nodes.tabs,nodes.products,nodes.contacts);
  root.append(aside,main);
  dashboard.append(root);
  document.body.append(mobileShade);
  document.body.classList.add('cg-dashboard-ready');

  const menuButton=$('cg-menu-toggle');
  const sidebar=$('cg-sidebar');
  function closeMenu(){
    sidebar.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded','false');
    menuButton.setAttribute('aria-label','Abrir menu do painel');
    mobileShade.hidden=true;
    document.body.classList.remove('cg-menu-open');
  }
  function openMenu(){
    sidebar.classList.add('is-open');
    menuButton.setAttribute('aria-expanded','true');
    menuButton.setAttribute('aria-label','Fechar menu do painel');
    mobileShade.hidden=false;
    document.body.classList.add('cg-menu-open');
  }
  menuButton.addEventListener('click',()=>sidebar.classList.contains('is-open')?closeMenu():openMenu());
  mobileShade.addEventListener('click',closeMenu);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  let activeView='overview';
  function show(view,{scroll=false}={}){
    const selected=definitions.find(entry=>entry[0]===view);
    if(!selected)return;
    activeView=view;
    // Existing controller remains responsible for legacy tabs and their save logic.
    if(view==='contacts')$('tab-contacts')?.click();
    else $('tab-products')?.click();
    overview.hidden=view!=='overview';
    tools.hidden=view!=='colors'&&view!=='collections';
    nodes.products.hidden=view!=='products';
    analytics.hidden=view!=='analytics';
    if(view==='analytics')loadAnalytics();
    nodes.contacts.hidden=view!=='contacts';
    $('cg-view-title').textContent=selected[1];
    $('cg-view-description').textContent=selected[3];
    for(const button of nav.querySelectorAll('[data-cg-view]')){
      const active=button.dataset.cgView===view;
      button.classList.toggle('active',active);
      button.setAttribute('aria-current',active?'page':'false');
    }
    if(!tools.hidden){
      const isColor=view==='colors';
      $('cg-tool-icon').innerHTML=icon(isColor?'palette':'layers',34);
      $('cg-tool-title').textContent=isColor?'Gerenciar cores':'Gerenciar coleções';
      $('cg-tool-description').textContent=isColor
        ?'Cadastre, ajuste ou exclua cores da paleta usada nas variações dos chaveiros.'
        :'Crie, renomeie e organize as coleções que aparecem no catálogo público.';
      $('cg-tool-open').textContent=isColor?'Abrir gerenciador de cores':'Abrir gerenciador de coleções';
      $('cg-tool-open').dataset.target=isColor?'manage-colors-open':'manage-collections-open';
    }
    closeMenu();
    if(scroll)window.scrollTo({top:0,behavior:'auto'});
  }
  nav.addEventListener('click',event=>{
    const button=event.target.closest('button[data-cg-view]');
    if(button)show(button.dataset.cgView,{scroll:true});
  });
  $('cg-tool-open').addEventListener('click',()=>$( $('cg-tool-open').dataset.target)?.click());
  overview.addEventListener('click',event=>{
    const button=event.target.closest('[data-cg-action]');
    if(!button)return;
    const action=button.dataset.cgAction;
    if(action==='new'){
      show('products');
      $('btn-add')?.click();
    }else if(action==='products')show('products',{scroll:true});
    else if(action==='colors'||action==='collections'){
      show(action);
      $(action==='colors'?'manage-colors-open':'manage-collections-open')?.click();
    }
  });
  const counters=['stat-total','stat-available','stat-off','stat-units'].map($);
  function syncStats(){
    const total=Number($('stat-total').textContent)||0;
    const available=Number($('stat-available').textContent)||0;
    const unavailable=Number($('stat-off').textContent)||0;
    const unitText=$('stat-units')?.textContent||'';
    const units=Number((unitText.match(/\d+/)||[])[0])||0;
    $('cg-stock-total').textContent=String(units);
    $('cg-health-label').textContent=total?available+' de '+total+' modelos disponíveis':'Nenhum modelo cadastrado';
    $('cg-health-ratio').textContent=total?Math.round(100*available/total)+'%':'0%';
    $('cg-health-progress').style.width=(total?100*available/total:0)+'%';
    $('cg-health-note').textContent=unavailable
      ?unavailable+(unavailable===1?' modelo sem estoque.':' modelos sem estoque.')+' Confira a disponibilidade em Chaveiros.'
      :total?'Todos os modelos cadastrados estão disponíveis.':'Cadastre seu primeiro chaveiro para começar.';
  }
  const observer=new MutationObserver(syncStats);
  for(const element of counters)if(element)observer.observe(element,{childList:true,characterData:true,subtree:true});
  syncStats();
  // On authentication, restore the current navigation. On logout clear the menu.
  const authObserver=new MutationObserver(()=>{
    if(dashboard.hidden||dashboard.style.display==='none'){closeMenu();return;}
    show(activeView);
  });
  authObserver.observe(dashboard,{attributes:true,attributeFilter:['hidden','style']});
  show('overview');
})();
