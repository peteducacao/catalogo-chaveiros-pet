
const DEFAULT_PRODUCTS_URL = 'data/chaveiros.json';
const STORAGE_KEY = 'pet_catalogo_produtos_v2';

async function loadProducts(){
  let local = null;
  try { local = localStorage.getItem(STORAGE_KEY); } catch(e) {}
  if(local){
    try { return JSON.parse(local); } catch(e){}
  }
  const res = await fetch(DEFAULT_PRODUCTS_URL);
  if(!res.ok) throw new Error("Falha ao carregar os modelos.");
  return await res.json();
}

function productStatus(prod){
  return prod.disponivel && Number(prod.estoque) > 0 ? 'disponivel' : 'sem-estoque';
}

function escapeHtml(str=''){return String(str).replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]))}

function parseColorList(colors=[]){
  return colors.map(c=>{
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#FFFFFF';
    return `<span class="color-pill"><span class="swatch" style="background:${safeColor}"></span>${escapeHtml(c.nome)}</span>`;
  }).join('');
}

function renderCard(prod){
  const status = productStatus(prod);
  const illustrative = Boolean(prod.imagemIlustrativa || prod.demonstrativo || String(prod.imagem).includes("mock-"));
  return `
  <article class="product-card" data-status="${status}" data-name="${escapeHtml(prod.nome.toLowerCase())}">
    <figure class="product-figure">
      <img src="${escapeHtml(prod.imagem)}" alt="${illustrative ? 'Imagem ilustrativa de ' : 'Foto do modelo '}${escapeHtml(prod.nome)}" loading="lazy">
      ${illustrative ? '<figcaption class="image-disclaimer">Imagem ilustrativa</figcaption>' : ''}
    </figure>
    <div class="product-body">
      <div class="product-top">
        <h2 class="product-title">${escapeHtml(prod.nome)}</h2>
        <span class="product-tag ${prod.demonstrativo ? 'tag-demo' : ''}">${prod.demonstrativo ? 'MODELO DE TESTE' : 'MODELO PET'}</span>
      </div>
      <p class="product-desc">${escapeHtml(prod.descricao)}</p>
      ${illustrative ? '<p class="illustrative-note">Representação ilustrativa; não é fotografia do produto real.</p>' : ''}
      <div class="colors">${parseColorList(prod.cores || [])}</div>
      <div class="stock-line">
        <span class="product-tag ${status==='disponivel' ? 'status-ok' : 'status-off'}">${status==='disponivel' ? 'Disponível' : 'Sem estoque'}</span>
        <span>Consulte as cores disponíveis</span>
      </div>
      <div class="card-actions">
        <a class="btn btn-primary" href="https://www.instagram.com/pet.educacao/" target="_blank" rel="noopener">Saiba mais</a>
      </div>
    </div>
  </article>`;
}

async function initCatalog(){
  const grid = document.getElementById('catalog-grid');
  if(!grid) return;
  let products;
  try { products = await loadProducts(); } catch(e) { grid.textContent = "Não foi possível carregar os modelos. Atualize a página para tentar novamente."; return; }
  const input = document.getElementById('busca');
  const chips = [...document.querySelectorAll('.chip')];
  const empty = document.getElementById('empty-state');
  let currentFilter = 'todos';

  function paint(){
    const term = (input?.value || '').toLowerCase().trim();
    const filtered = products.filter(p => {
      const matchesTerm = p.nome.toLowerCase().includes(term);
      const status = productStatus(p);
      const matchesFilter = currentFilter === 'todos' || currentFilter === status;
      return matchesTerm && matchesFilter;
    });
    grid.innerHTML = filtered.map(renderCard).join('');
    empty.classList.toggle('hidden', filtered.length !== 0);
  }

  input?.addEventListener('input', paint);
  chips.forEach(btn => btn.addEventListener('click', () => {
    chips.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    currentFilter = btn.dataset.filter;
    paint();
  }));
  paint();
}

async function initHomePreview(){
  const wrap = document.getElementById('home-preview');
  if(!wrap) return;
  const products = await loadProducts();
  wrap.innerHTML = products.slice(0,2).map(p => `
    <article class="mini-card">
      <figure class="mini-photo"><img src="${escapeHtml(p.imagem)}" alt="Imagem ilustrativa de ${escapeHtml(p.nome)}"><figcaption class="image-disclaimer">Imagem ilustrativa</figcaption></figure>
      <h3>${escapeHtml(p.nome)}</h3>
      <p>${productStatus(p)==='disponivel' ? 'Disponível' : 'Sem estoque'}</p>
    </article>`).join('');
}

function initMenu(){
  const btn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if(!btn || !nav) return;
  btn.addEventListener('click', ()=> {
    nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', nav.classList.contains('is-open'));
  });
  document.querySelectorAll('.main-nav a').forEach(a=>{
    if(a.dataset.page === document.body.dataset.page) a.setAttribute('aria-current', 'page');
  });
}

initMenu();
initCatalog();
initHomePreview();
