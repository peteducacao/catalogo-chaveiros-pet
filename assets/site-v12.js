'use strict';
const PET_REPOSITORY='peteducacao/catalogo-chaveiros-pet';
const PET_BRANCH='main';
const PET_INSTAGRAM='https://www.instagram.com/pet.educacao/';
const PET_DEFAULT_DESCRIPTION='Conheça nosso catálogo! Para mais informações, acompanhe o Instagram do PET Educação.';

function node(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=String(text);return e;}
function safeImageUrl(url){const raw=String(url||'').trim();if(/^https:\/\/[^\s"'<>]+$/i.test(raw))return raw;if(/^assets\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp|svg)$/i.test(raw)&&!raw.includes('..'))return raw;return 'assets/mock-pet.svg';}
function safeHex(hex){return /^#[0-9a-f]{6}$/i.test(String(hex||''))?String(hex):'#ffffff';}
function productAvailable(p){return Boolean(p.disponivel)&&Number(p.estoque)>0;}
async function loadData(file){const response=await fetch(file+'?v=12',{cache:'no-store'});if(!response.ok)throw Error('Arquivo indisponível: '+file);return response.json();}
function makeColor(c){const item=node('span','color-option');const dot=node('span','dot');dot.style.backgroundColor=safeHex(c.hex);item.append(dot,document.createTextNode(c.nome||'Cor'));return item;}

function makeProductCard(product){
  const available=productAvailable(product);
  const card=node('article','product-card'+(available?'':' sold-out'));
  const visual=node('div','product-image'),image=node('img');
  image.src=safeImageUrl(product.imagem);
  image.alt='Imagem do '+(product.nome||'chaveiro');
  image.loading='lazy';
  const zoom=Number(product.zoomImagem)||1;
  if(zoom>1&&zoom<=2.2)image.style.transform='scale('+zoom+')';
  visual.append(image);
  if(product.imagemIlustrativa){
    const label=node('span','image-label',product.legendaImagem||'Imagem ilustrativa');
    visual.append(label);
  }
  const content=node('div','product-info');
  content.append(node('h2','',product.nome||'Chaveiro'));
  if(product.descricao)content.append(node('p','',product.descricao));
  if(product.cores?.length){
    content.append(node('span','colors-label','Cores disponíveis'));
    const list=node('div','color-list');
    product.cores.forEach(c=>list.append(makeColor(c)));
    content.append(list);
  }
  const stockRow=node('div','stock-row');
  const badge=node('span','stock-badge '+(available?'available':'unavailable'),available?'● Disponível':'● Sem estoque');
  stockRow.append(badge);
  // Quantidades são exibidas ao público somente quando o item está efetivamente disponível.
  // O painel conserva a quantidade física registrada para administração.
  if(available){
    const quantity=Math.max(0,Number(product.estoque)||0);
    stockRow.append(node('span','stock-quantity',quantity===1?'1 unidade disponível':quantity+' unidades disponíveis'));
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
  card.append(visual,content);
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
async function initCatalog(){
  const grid=document.getElementById('catalog-grid');
  if(!grid)return;
  const [products,config]=await Promise.all([loadData('data/chaveiros.json'),loadData('data/config.json').catch(()=>({}))]);
  if(!Array.isArray(products))throw Error('Dados do catálogo inválidos');
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
initMenu();
initHomeText();
initCatalog().catch(err=>{
  const grid=document.getElementById('catalog-grid');
  if(grid)grid.replaceChildren(node('p','empty','Não foi possível carregar os chaveiros. Atualize a página para tentar novamente.'));
  console.error('Catálogo:',err);
});