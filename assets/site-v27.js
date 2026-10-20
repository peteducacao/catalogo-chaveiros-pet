'use strict';
const PET_REPOSITORY='peteducacao/catalogo-chaveiros-pet';
const PET_BRANCH='main';
const PET_INSTAGRAM='https://www.instagram.com/pet.educacao/';
const PET_DEFAULT_DESCRIPTION='Conheça nosso catálogo! Para mais informações, acompanhe o Instagram do PET Educação.';

function node(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=String(text);return e;}
function safeImageUrl(url){const raw=String(url||'').trim();if(/^https:\/\/[^\s"'<>]+$/i.test(raw))return raw;if(/^assets\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp|svg)$/i.test(raw)&&!raw.includes('..'))return raw;return 'assets/mock-pet.svg';}
function safeHex(hex){return /^#[0-9a-f]{6}$/i.test(String(hex||''))?String(hex):'#ffffff';}
function productAvailable(p){return Boolean(p.disponivel)&&Number(p.estoque)>0;}
async function loadData(file){const response=await fetch(file+'?v=27&at='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('Arquivo indisponível: '+file);return response.json();}
function makeColor(c){const item=node('span','color-option');const dot=node('span','dot');dot.style.backgroundColor=safeHex(c.hex);item.append(dot,document.createTextNode(c.nome||'Cor'));return item;}


// A legenda abaixo da foto acompanha a cor real do fundo de cada imagem.
// A amostragem usa pequenos pontos nas bordas inferiores, longe do chaveiro.
// Imagens externas sem CORS continuam visíveis, com um fundo neutro de reserva.
function harmonizeImageCaption(image,card){
  if(!image.naturalWidth||!image.naturalHeight||!card?.style)return;
  try{
    const canvas=document.createElement('canvas');
    const size=32;
    canvas.width=size;canvas.height=size;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)return;
    context.drawImage(image,0,0,size,size);
    const pixels=context.getImageData(0,0,size,size).data;
    const points=[
      [1,26],[2,29],[3,31],[5,30],
      [26,30],[28,31],[29,29],[30,26],
      [1,19],[30,19]
    ];
    const samples=points.map(([x,y])=>{
      const at=4*(y*size+x);
      const alpha=pixels[at+3]/255;
      // Combina transparência com o fundo base usado no cartão.
      return [0,1,2].map((channel)=>
        Math.round(pixels[at+channel]*alpha+[244,248,246][channel]*(1-alpha))
      );
    });
    const median=channel=>{
      const values=samples.map(p=>p[channel]).sort((a,b)=>a-b);
      return Math.round((values[4]+values[5])/2);
    };
    const color=[median(0),median(1),median(2)];
    // Não escurece, clareia, edita ou altera a fotografia.
    card.style.setProperty('--product-image-background','rgb('+color.join(',')+')');
    const luminosity=color.reduce((sum,v,i)=>sum+(v/255)*[.2126,.7152,.0722][i],0);
    card.style.setProperty('--product-caption-ink',luminosity>.58?'#536a76':'#fff');
  }catch(error){
    // Canvas pode estar protegido por CORS quando a foto vem de um site externo.
    // Nesse caso mantemos o fundo neutro; o carregamento da foto não é afetado.
  }
}

function makeProductCard(product){
  const available=productAvailable(product);
  const card=node('article','product-card'+(available?'':' sold-out'));
  const visual=node('div','product-image'),image=node('img');
  image.alt='Imagem do '+(product.nome||'chaveiro');
  // Fundo uniforme no cartão: imagens brancas se fundem à mesma cor,
  // sem canvas/CORS e sem editar fotografias originais.
  image.src=safeImageUrl(product.imagem);
  image.loading='lazy';
  // Mostra o produto inteiro, ignorando ampliações legadas que cortavam letras.
  visual.append(image);
  // A indicação fica abaixo da fotografia para não cobrir nenhum detalhe do chaveiro.
  const illustrativeCaption=product.imagemIlustrativa
    ?node('div','product-image-caption')
    :null;
  if(illustrativeCaption){
    illustrativeCaption.append(node('span','image-label',product.legendaImagem||'Imagem ilustrativa'));
  }
  const content=node('div','product-info');
  content.append(node('h2','',product.nome||'Chaveiro'));
  if(product.descricao)content.append(node('p','product-description',product.descricao));
  if(available && product.mostrarCores!==false && product.cores?.length){
    content.append(node('span','colors-label','Cores disponíveis'));
    const list=node('div','color-list');
    product.cores.forEach(c=>list.append(makeColor(c)));
    content.append(list);
  }
  const priceValue=product.preco===null||product.preco===undefined||product.preco===''?null:Number(product.preco);
  if(priceValue!==null&&Number.isFinite(priceValue)&&priceValue>0){
    const formattedPrice=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(priceValue);
    content.append(node('p','product-price',formattedPrice));
  }
  const stockRow=node('div','stock-row');
  const badge=node('span','stock-badge '+(available?'available':'unavailable'),available?'● Disponível':'● Sem estoque');
  stockRow.append(badge);
  // Quantidades são exibidas ao público somente quando o item está efetivamente disponível.
  // O painel conserva a quantidade física registrada para administração.
  if(available){
    const quantity=Math.max(0,Number(product.estoque)||0);
    stockRow.append(node('span','stock-quantity stock-quantity-pill',quantity===1?'1 unidade disponível':quantity+' unidades disponíveis'));
  }
  content.append(stockRow);
  if(available){
    const social=node('a','product-link');
    social.href=PET_INSTAGRAM;social.target='_blank';social.rel='noopener noreferrer';
    social.append(document.createTextNode('Saiba mais no Instagram'),node('span','','↗'));
    content.append(social);
  }else{
    const disabled=node('span','product-link is-disabled','Indisponível no momento');
    disabled.setAttribute('aria-disabled','true');
    content.append(disabled);
  }
  card.append(visual);
  if(illustrativeCaption)card.append(illustrativeCaption);
  card.append(content);
  return card;
}
async function initHomeText(){
  const el=document.getElementById('home-description');
  if(!el)return;
  try{
    const config=await loadData('data/config.json');
    if(typeof config.homeDescription==='string')el.textContent=config.homeDescription;
  }catch(error){console.error('Texto da capa:',error);}
}
function orderCatalogProducts(list){
  // A ordem explícita é a referência principal do catálogo, inclusive após
  // gravações do painel e atualizações em cache do GitHub Pages.
  return list.map((p,i)=>{
    const position=Number(p?.ordem);
    return {p,i,position:Number.isFinite(position)&&position>=1?position:i+1};
  }).sort((a,b)=>a.position-b.position||a.i-b.i).map(item=>item.p);
}
async function initCatalog(){
  const grid=document.getElementById('catalog-grid');
  if(!grid)return;
  const [originalProducts,config]=await Promise.all([loadData('data/chaveiros.json'),loadData('data/config.json').catch(()=>({}))]);
  if(!Array.isArray(originalProducts))throw Error('Dados do catálogo inválidos');
  const products=orderCatalogProducts(originalProducts);
  const subtitle=document.getElementById('catalog-description');
  if(subtitle)subtitle.textContent=typeof config.catalogDescription==='string'?config.catalogDescription:PET_DEFAULT_DESCRIPTION;
  const available=products.filter(productAvailable).length;
  const unavailable=products.length-available;
  const countAvailable=document.getElementById('count-available');
  const countUnavailable=document.getElementById('count-unavailable');
  if(countAvailable)countAvailable.textContent='('+available+')';
  if(countUnavailable)countUnavailable.textContent='('+unavailable+')';
  const search=document.getElementById('buscar');
  const empty=document.getElementById('catalog-empty');
  let filter='disponivel';
  function render(){
    const query=(search?.value||'').trim().toLocaleLowerCase('pt-BR');
    const filtered=products.filter(p=>(filter==='disponivel'?productAvailable(p):!productAvailable(p))&&String(p.nome||'').toLocaleLowerCase('pt-BR').includes(query));
    grid.replaceChildren(...filtered.map(makeProductCard));
    if(empty)empty.hidden=filtered.length!==0;
  }
  document.querySelectorAll('[data-filter]').forEach(button=>{
    button.addEventListener('click',()=>{
      filter=button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
      render();
    });
  });
  search?.addEventListener('input',render);
  render();
  const target=document.getElementById('disponiveis');
  function goToAvailable(){
    filter='disponivel';
    document.querySelectorAll('[data-filter]').forEach(button=>{
      const active=button.dataset.filter==='disponivel';
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    render();
    if(target){
      const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      target.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
    }
  }
  // Ao chegar de "Ver chaveiros"/menu, primeiro mostramos o topo; então deslizamos
  // até as opções disponíveis quando os dados já foram carregados.
  if(new URLSearchParams(window.location.search).get('ir')==='disponiveis'){
    window.requestAnimationFrame(()=>window.setTimeout(goToAvailable,120));
  }
  // Se já estivermos no catálogo, o menu não precisa recarregar a página.
  document.querySelectorAll('.main-nav a[data-page="catalogo"]').forEach(link=>{
    link.addEventListener('click',event=>{
      if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      goToAvailable();
      const menu=document.getElementById('main-nav');
      menu?.classList.remove('open');
      document.getElementById('menu-toggle')?.setAttribute('aria-expanded','false');
    });
  });
}

function safeSocialUrl(raw){
  try{
    const value=new URL(String(raw||'').trim());
    if(value.protocol!=='https:'||value.username||value.password||!value.hostname.includes('.'))return null;
    return value.href;
  }catch{return null;}
}
function contactCard(item){
  const url=safeSocialUrl(item.url);
  if(!url)return null;
  const instagram=(new URL(url).hostname.toLowerCase().endsWith('instagram.com'));
  const card=node('a','instagram-card'+(instagram?' social-instagram':''));
  card.href=url;card.target='_blank';card.rel='noopener noreferrer';
  const icon=node('div','instagram-icon');
  const symbol=node('span','social-symbol',instagram?'◎':String(item.nome||'•').charAt(0).toLocaleUpperCase('pt-BR'));
  icon.append(symbol);
  const details=node('div');
  const kicker=node('span','overline',String(item.nome||'REDE SOCIAL').toLocaleUpperCase('pt-BR'));
  const heading=node('h2','',item.perfil||item.nome||'Perfil do PET');
  const description=node('p','',item.descricao||'Acompanhe o PET Educação nesta rede social.');
  details.append(kicker,heading,description);
  card.append(icon,details,node('span','arrow-round','↗'));
  return card;
}

function renderInstitutionalWebsite(site){
  const card=document.getElementById('institutional-website');
  if(!card)return;
  const data=site&&typeof site==='object'?site:null;
  if(!data)return;
  const validUrl=safeSocialUrl(data.url);
  if(data.visivel===false||!validUrl){
    card.hidden=true;
    return;
  }
  card.href=validUrl;
  document.getElementById('institutional-public-title').textContent=String(data.titulo||'peteduca.com.br');
  document.getElementById('institutional-public-description').textContent=String(data.descricao||'');
  card.hidden=false;
}

async function initContactSocials(){
  const list=document.getElementById('social-links');
  if(!list)return;
  try{
    const config=await loadData('data/config.json');
    renderInstitutionalWebsite(config.siteInstitucional);
    if(!Array.isArray(config.redesSociais))return;
    const cards=config.redesSociais.map(contactCard).filter(Boolean);
    if(cards.length)list.replaceChildren(...cards);
    else list.replaceChildren(node('p','empty','Nenhuma rede social cadastrada no momento.'));
  }catch(error){
    console.error('Não foi possível atualizar a lista de redes sociais:',error);
    // Mantém o Instagram de fallback da página quando não há rede.
  }
}

function initMenu(){
  const btn=document.getElementById('menu-toggle'),nav=document.getElementById('main-nav');
  btn?.addEventListener('click',()=>{
    const open=nav.classList.toggle('open');
    btn.setAttribute('aria-expanded',String(open));
    btn.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
  });
  document.querySelectorAll('.main-nav a').forEach(a=>{if(a.dataset.page===document.body.dataset.page)a.setAttribute('aria-current','page');});
}

function initInstagramRedirect(){
  let active=false;
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target?.closest?.('a[href]');
    if(!link)return;
    let target;
    try{target=new URL(link.href,window.location.href);}catch{return;}
    // Somente o Instagram oficial do PET Educação; os demais links seguem normais.
    if(target.origin!=='https://www.instagram.com'||!/^\/pet\.educacao\/?$/.test(target.pathname))return;
    if(active){event.preventDefault();return;}
    event.preventDefault();
    active=true;
    const overlay=node('div','instagram-redirect-overlay');
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    overlay.setAttribute('aria-label','Redirecionando para o Instagram do PET Educação');
    const card=node('div','instagram-redirect-card');
    const loader=node('span','instagram-redirect-spinner');
    loader.setAttribute('aria-hidden','true');
    const title=node('strong','instagram-redirect-heading','Redirecionando para o Instagram');
    const description=node('p','instagram-redirect-description','Você será direcionado ao Instagram do PET Educação.');
    card.append(loader,title,description);
    overlay.append(card);
    document.body.append(overlay);
    document.body.classList.add('instagram-redirect-active');
    window.setTimeout(()=>{window.location.assign(target.href);},1300);
    // Se o navegador cancelar a navegação externa, não deixar o overlay preso.
    window.setTimeout(()=>{
      if(document.visibilityState==='visible'){
        overlay.remove();
        document.body.classList.remove('instagram-redirect-active');
        active=false;
      }
    },9500);
  });
}

initMenu();
initInstagramRedirect();
initHomeText();
initContactSocials();
initCatalog().catch(err=>{
  const grid=document.getElementById('catalog-grid');
  if(grid)grid.replaceChildren(node('p','empty','Não foi possível carregar os chaveiros. Atualize a página para tentar novamente.'));
  console.error('Catálogo:',err);
});