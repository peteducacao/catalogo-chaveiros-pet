'use strict';
const PET_REPOSITORY='peteducacao/catalogo-chaveiros-pet';
const PET_BRANCH='main';
const PET_INSTAGRAM='https://www.instagram.com/pet.educacao/';
const PET_DEFAULT_DESCRIPTION='Conheça nosso catálogo! Para mais informações, acompanhe o Instagram do PET Educação.';

function node(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=String(text);return e;}
// Nunca carregar formatos ativos (SVG externo/HTML) enviados por links de produtos.
// Arquivos locais SVG pertencem exclusivamente aos assets estáticos do próprio site.
function safeImageUrl(url){
  const raw=String(url||'').trim();
  if(/^assets\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp|svg)$/i.test(raw)&&!raw.includes('..'))return raw;
  if(raw.length>900||/[\s\x00-\x1f"'<>\\]/.test(raw))return 'assets/mock-pet.svg';
  try{
    const parsed=new URL(raw);
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||!parsed.hostname.includes('.'))return 'assets/mock-pet.svg';
    if(!/\.(png|jpe?g|webp)$/i.test(parsed.pathname))return 'assets/mock-pet.svg';
    return parsed.href;
  }catch{return 'assets/mock-pet.svg';}
}
function safeHex(hex){return /^#[0-9a-f]{6}$/i.test(String(hex||''))?String(hex):'#ffffff';}
function productAvailable(p){return Boolean(p.disponivel)&&Number(p.estoque)>0;}
async function loadData(file){const response=await fetch(file+'?v=31&at='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('Arquivo indisponível: '+file);return response.json();}
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
  const expand=node('button','product-image-viewer');
  expand.type='button';
  expand.setAttribute('aria-label','Ampliar foto do '+(product.nome||'chaveiro'));
  expand.append(image);
  expand.addEventListener('click',()=>openProductImage(product));
  visual.append(expand);
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
// Remove apenas o fundo quase branco CONECTADO À BORDA das fotos locais de destaque.
// Mantém as fotos originais no catálogo, no painel e no repositório; o recorte é feito
// temporariamente no navegador. Se a imagem não for uma foto clara sobre fundo uniforme,
// deixa a fotografia original intacta (com atenuação suave das bordas pelo CSS).
function prepareHomeShowcasePhoto(image,source){
  if(typeof source!=='string'||!/^assets\/produtos\//.test(source))return;
  const attempt=()=>{
    if(image.dataset.homeCutoutAttempted)return;
    image.dataset.homeCutoutAttempted='true';
    try{
      const naturalW=image.naturalWidth,naturalH=image.naturalHeight;
      if(!naturalW||!naturalH)return;
      const scale=Math.min(1,640/Math.max(naturalW,naturalH));
      const w=Math.max(1,Math.round(naturalW*scale)),h=Math.max(1,Math.round(naturalH*scale));
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx)return;
      ctx.drawImage(image,0,0,w,h);
      const pixels=ctx.getImageData(0,0,w,h);
      const data=pixels.data;
      const cornerPoints=[
        [Math.floor(w*.02),Math.floor(h*.02)],
        [Math.floor(w*.98),Math.floor(h*.02)],
        [Math.floor(w*.02),Math.floor(h*.98)],
        [Math.floor(w*.98),Math.floor(h*.98)]
      ];
      const sample=cornerPoints.map(([x,y])=>{
        const i=(y*w+x)*4;
        return [data[i],data[i+1],data[i+2],data[i+3]];
      });
      // Nunca remover o fundo de fotos externas, transparentes, coloridas ou complexas.
      if(sample.some(rgb=>rgb[3]<240||Math.min(rgb[0],rgb[1],rgb[2])<216
        ||Math.max(rgb[0],rgb[1],rgb[2])-Math.min(rgb[0],rgb[1],rgb[2])>31))return;
      const background=[0,1,2].map(channel=>Math.round(
        sample.reduce((sum,rgb)=>sum+rgb[channel],0)/sample.length
      ));
      if(sample.some(rgb=>Math.max(...rgb.slice(0,3).map((c,i)=>Math.abs(c-background[i])))>28))return;
      const limit=w*h,visited=new Uint8Array(limit),queue=new Int32Array(limit);
      let front=0,back=0;
      const isBg=index=>{
        const i=index*4,r=data[i],g=data[i+1],b=data[i+2];
        return data[i+3]>=230&&Math.min(r,g,b)>215
          &&Math.max(r,g,b)-Math.min(r,g,b)<38
          &&Math.max(Math.abs(r-background[0]),Math.abs(g-background[1]),Math.abs(b-background[2]))<49;
      };
      const add=index=>{
        if(!visited[index]&&isBg(index)){
          visited[index]=1;
          queue[back++]=index;
        }
      };
      for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
      for(let y=1;y<h-1;y++){add(y*w);add(y*w+w-1);}
      while(front<back){
        const p=queue[front++],x=p%w,y=(p-x)/w;
        data[p*4+3]=0;
        if(x>0)add(p-1);
        if(x+1<w)add(p+1);
        if(y>0)add(p-w);
        if(y+1<h)add(p+w);
      }
      // Não modificar uma foto cujo fundo não seja maioritariamente uniforme.
      if(back<limit*.15)return;
      ctx.putImageData(pixels,0,0);
      // Normaliza o tamanho APARENTE da peça, não apenas o tamanho da foto.
      // O anel e os elementos coloridos também entram no contorno da peça.
      let minX=w,minY=h,maxX=-1,maxY=-1;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const pos=(y*w+x)*4;
        if(data[pos+3]<155)continue;
        if(x<minX)minX=x;
        if(y<minY)minY=y;
        if(x>maxX)maxX=x;
        if(y>maxY)maxY=y;
      }
      let output=canvas;
      if(maxX>=minX&&maxY>=minY){
        const bw=maxX-minX+1,bh=maxY-minY+1;
        if(bw>Math.max(20,w*.10)&&bh>Math.max(20,h*.10)){
          const size=640;
          const fitted=document.createElement('canvas');
          fitted.width=size;fitted.height=size;
          const fitContext=fitted.getContext('2d');
          if(fitContext){
            const factor=(size*.80)/Math.max(bw,bh);
            const dw=bw*factor,dh=bh*factor;
            fitContext.drawImage(canvas,minX,minY,bw,bh,(size-dw)/2,(size-dh)/2,dw,dh);
            output=fitted;
          }
        }
      }
      output.toBlob(blob=>{
        if(!blob||!image.isConnected)return;
        const cutout=URL.createObjectURL(blob);
        image.addEventListener('load',()=>URL.revokeObjectURL(cutout),{once:true});
        image.closest('.home-feature-photo')?.classList.add('home-photo-cutout-applied');
        image.src=cutout;
      },'image/webp',.91);
    }catch(error){
      // Falhas de canvas ou memória jamais impedem o carregamento da página inicial.
      console.debug('Prévia de fundo transparente indisponível:',error);
    }
  };
  if(image.complete&&image.naturalWidth)attempt();
  else image.addEventListener('load',attempt,{once:true});
}
// Imagens da capa são selecionadas manualmente no painel; nunca há preenchimento automático.
function renderHomeFeatured(config,products){
  const gallery=document.getElementById('home-feature-gallery');
  const hero=document.querySelector('.hero-featured');
  if(!gallery||!hero)return;
  const selected=Array.isArray(config.homeFeaturedIds)?config.homeFeaturedIds:[];
  const ids=[...new Set(selected.filter(id=>typeof id==='string'))].slice(0,3);
  const chosen=ids.map(id=>products.find(p=>p.id===id)).filter(p=>p&&productAvailable(p));
  gallery.replaceChildren();
  for(const product of chosen){
    const link=node('a','home-feature-photo');
    link.href='catalogo.html?ir=disponiveis';
    link.setAttribute('aria-label','Ver '+String(product.nome||'chaveiro')+' no catálogo');
    const image=node('img');
    image.src=safeImageUrl(product.imagem);
    image.alt='Foto do '+String(product.nome||'chaveiro');
    image.loading='lazy';
    image.decoding='async';
    prepareHomeShowcasePhoto(image,product.imagem);
    link.append(image);
    gallery.append(link);
  }
  gallery.dataset.count=String(chosen.length);
  gallery.hidden=chosen.length===0;
  hero.classList.toggle('has-featured',chosen.length>0);
  hero.classList.toggle('hero-centered',chosen.length===0);
}
async function initHomeText(){
  const el=document.getElementById('home-description');
  if(!el)return;
  try{
    const [config,products]=await Promise.all([loadData('data/config.json'),loadData('data/chaveiros.json')]);
    if(typeof config.homeDescription==='string')el.textContent=config.homeDescription;
    renderHomeFeatured(config,Array.isArray(products)?products:[]);
  }catch(error){console.error('Destaques da capa:',error);}
}
// Visualização ampliada, preservando o arquivo original e o enquadramento completo.
let photoDialog=null;
function openProductImage(product){
  if(!photoDialog){
    photoDialog=node('dialog','product-lightbox');
    const close=node('button','product-lightbox-close','Fechar ×');
    close.type='button';
    close.setAttribute('aria-label','Fechar fotografia ampliada');
    close.addEventListener('click',()=>photoDialog.close());
    const frame=node('div','product-lightbox-frame');
    const big=node('img');
    big.id='product-lightbox-image';
    frame.append(big);
    photoDialog.append(close,frame);
    photoDialog.addEventListener('click',event=>{if(event.target===photoDialog)photoDialog.close();});
    document.body.append(photoDialog);
  }
  const big=photoDialog.querySelector('img');
  big.src=safeImageUrl(product.imagem);
  big.alt='Fotografia ampliada de '+(product.nome||'chaveiro');
  if(!photoDialog.open)photoDialog.showModal();
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
  const toolbar=document.getElementById('disponiveis');
  const filterRow=toolbar?.querySelector('.filter-row');
  const searchField=toolbar?.querySelector('.search-field');
  if(searchField)searchField.hidden=products.length<7;
  if(filterRow)filterRow.hidden=available===0||unavailable===0;
  let filter=available===0?'sem-estoque':'disponivel';
  function render(){
    const query=(search?.value||'').trim().toLocaleLowerCase('pt-BR');
    const filtered=products.filter(p=>(filter==='disponivel'?productAvailable(p):!productAvailable(p))&&String(p.nome||'').toLocaleLowerCase('pt-BR').includes(query));
    grid.replaceChildren(...filtered.map(makeProductCard));
    grid.dataset.visibleCount=String(Math.min(filtered.length,3));
    if(empty){
      empty.hidden=filtered.length!==0;
      if(!filtered.length)empty.textContent=products.length===0
        ?'Novos modelos em preparação. Acompanhe as novidades pelo Instagram do PET Educação.'
        :query?'Nenhum chaveiro corresponde à sua busca.'
        :filter==='disponivel'?'Não há chaveiros disponíveis no momento. Confira a seção Sem estoque.':'Nenhum chaveiro sem estoque.';
    }
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
    filter=available===0?'sem-estoque':'disponivel';
    document.querySelectorAll('[data-filter]').forEach(button=>{
      const active=button.dataset.filter===filter;
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
// Apenas cores hexadecimais completas podem ser usadas como fundo de cartões.
function safeCardBackground(value){
  return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):null;
}
// Escolhe automaticamente texto escuro ou claro conforme o contraste WCAG do fundo.
function cardBackgroundText(hex){
  const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const luminance=channels.map(c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4))
    .reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0);
  const navyLum=[23,61,114].map(v=>v/255).map(c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4))
    .reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0);
  const whiteContrast=1.05/(luminance+0.05);
  const navyContrast=(Math.max(navyLum,luminance)+0.05)/(Math.min(navyLum,luminance)+0.05);
  return whiteContrast>=navyContrast?'light':'dark';
}
function contactCard(item){
  const url=safeSocialUrl(item.url);
  if(!url)return null;
  const instagram=(new URL(url).hostname.toLowerCase().endsWith('instagram.com'));
  const card=node('a','instagram-card'+(instagram?' social-instagram':''));
  const chosenBackground=safeCardBackground(item.corFundo);
  if(chosenBackground){
    card.classList.add('has-custom-bg');
    card.style.setProperty('--social-bg-color',chosenBackground);
    card.dataset.colorMode=cardBackgroundText(chosenBackground);
  }
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

const PET_CONTACT_DEFAULTS={
  instituicao:'Universidade Federal de Sergipe — Campus Prof. Alberto Carvalho',
  endereco:'Av. Vereador Olímpio Grande, s/n',
  cidade:'Itabaiana/SE',
  cep:'49506-036',
  telefone:'(79) 3432-8217',
  email:'petedusaber@gmail.com'
};
function institutionalContact(config){
  const raw=config?.contatoInstitucional;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {...PET_CONTACT_DEFAULTS};
  const clean={};
  for(const [key,defaultValue] of Object.entries(PET_CONTACT_DEFAULTS)){
    clean[key]=typeof raw[key]==='string'?raw[key].slice(0,250):defaultValue;
  }
  return clean;
}
function putContactText(id,value){
  const el=document.getElementById(id);
  if(el)el.textContent=value;
}
function socialFooterIcon(item){
  const symbol=node('span','footer-link-icon',/instagram/i.test(String(item.nome||''))?'◎':'↗');
  symbol.setAttribute('aria-hidden','true');
  return symbol;
}
function renderPublicFooter(config){
  const nav=document.getElementById('footer-social-links');
  if(!nav)return;
  const socials=Array.isArray(config?.redesSociais)?config.redesSociais:[];
  nav.replaceChildren();
  for(const social of socials){
    const url=safeSocialUrl(social.url);
    if(!url)continue;
    const a=node('a','footer-social-link');
    a.href=url;
    a.target='_blank';
    a.rel='noopener noreferrer';
    a.append(socialFooterIcon(social),node('span','',String(social.nome||'Rede social')));
    nav.append(a);
  }
  if(!nav.children.length)nav.append(node('span','footer-no-social','Redes sociais em atualização'));
  const institutional=document.getElementById('footer-institutional-link');
  if(institutional){
    const data=config?.siteInstitucional;
    const url=data?safeSocialUrl(data.url):null;
    institutional.hidden=data?.visivel===false||!url;
    if(url)institutional.href=url;
  }
  const info=institutionalContact(config);
  putContactText('footer-campus',info.instituicao);
  putContactText('footer-city',[info.cidade,info.cep?'CEP '+info.cep:''].filter(Boolean).join(' · '));
  putContactText('footer-year',String(new Date().getFullYear()));
}
function setupInstitutionalContact(config){
  const root=document.getElementById('contact-institutional-info');
  if(!root)return;
  const info=institutionalContact(config);
  putContactText('contact-info-campus',info.instituicao);
  putContactText('contact-info-address',[info.endereco,info.cidade,info.cep?'CEP '+info.cep:''].filter(Boolean).join(' · '));
  const phone=document.getElementById('contact-info-phone');
  if(phone){
    phone.textContent=info.telefone||'Não informado';
    const digits=String(info.telefone||'').replace(/\D/g,'');
    if(digits.length>=10&&digits.length<=13)phone.href='tel:+'+(digits.startsWith('55')?digits:'55'+digits);
    else phone.removeAttribute('href');
  }
  const email=document.getElementById('contact-info-email');
  if(email){
    email.textContent=info.email||'Não informado';
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email))email.href='mailto:'+info.email;
    else email.removeAttribute('href');
  }
  const address=[info.instituicao,info.endereco,info.cidade,info.cep].filter(Boolean).join(', ');
  const query=encodeURIComponent(address);
  const mapLink=document.getElementById('contact-map-open');
  if(mapLink)mapLink.href='https://www.google.com/maps/search/?api=1&query='+query;
  const button=document.getElementById('contact-map-load');
  const iframe=document.getElementById('contact-map-frame');
  button?.addEventListener('click',()=>{
    if(!iframe)return;
    iframe.src='https://www.google.com/maps?q='+query+'&output=embed';
    iframe.hidden=false;
    button.hidden=true;
    const intro=document.getElementById('contact-map-intro');
    if(intro)intro.hidden=true;
  },{once:true});
}
async function initPublicDetails(){
  if(!document.getElementById('footer-social-links')&&!document.getElementById('contact-institutional-info'))return;
  try{
    const config=await loadData('data/config.json');
    renderPublicFooter(config);
    setupInstitutionalContact(config);
    const list=document.getElementById('social-links');
    if(list){
      renderInstitutionalWebsite(config.siteInstitucional);
      const socials=Array.isArray(config.redesSociais)?config.redesSociais:[];
      const cards=socials.map(contactCard).filter(Boolean);
      if(cards.length)list.replaceChildren(...cards);
      else list.replaceChildren(node('p','empty','Nenhuma rede social cadastrada no momento.'));
    }
  }catch(error){
    console.error('Informações institucionais:',error);
    const fallback={
      contatoInstitucional:PET_CONTACT_DEFAULTS,
      siteInstitucional:{url:'https://peteduca.com.br/',visivel:true},
      redesSociais:[{nome:'Instagram',url:PET_INSTAGRAM}]
    };
    renderPublicFooter(fallback);
    setupInstitutionalContact(fallback);
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
initPublicDetails();
initCatalog().catch(err=>{
  const grid=document.getElementById('catalog-grid');
  if(grid)grid.replaceChildren(node('p','empty','Não foi possível carregar os chaveiros. Atualize a página para tentar novamente.'));
  console.error('Catálogo:',err);
});