
const ADMIN_LOGIN = 'peteduca';
const ADMIN_PASSWORD_HASH = 'be9510d8389e5038a356db778a01b2afbb23168248e39eb9d660d00e5118be7e';
// Demonstração local. Hash acessível publicamente não substitui autenticação de servidor.
const ADMIN_SESSION = 'pet_admin_ok_v2';

function productsToColorString(colors=[]){
  return colors.map(c => `${c.nome}:${c.hex}`).join(', ');
}
function colorStringToProducts(str=''){
  return str.split(',').map(item => item.trim()).filter(Boolean).map(item => {
    const [nome, hex] = item.split(':');
    return { nome: (nome || '').trim(), hex: (hex || '#FFFFFF').trim() };
  });
}
function saveProducts(products){ localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); }
async function sha256(value){ const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)); return Array.from(new Uint8Array(buffer)).map(b=>b.toString(16).padStart(2,'0')).join(''); }

async function getCurrentProducts(){ return await loadProducts(); }

function setLogged(flag){
  if(flag) sessionStorage.setItem(ADMIN_SESSION, '1');
  else sessionStorage.removeItem(ADMIN_SESSION);
}
function isLogged(){ return sessionStorage.getItem(ADMIN_SESSION) === '1'; }

async function initAdmin(){
  const loginWrap = document.getElementById('login-wrap');
  const adminWrap = document.getElementById('admin-wrap');
  if(!loginWrap || !adminWrap) return;
  const loginForm = document.getElementById('login-form');
  const loginFeedback = document.getElementById('login-feedback');
  const productForm = document.getElementById('product-form');
  const productFeedback = document.getElementById('product-feedback');
  const adminList = document.getElementById('admin-list');
  const logoutBtn = document.getElementById('logout-btn');
  const resetBtn = document.getElementById('reset-btn');
  const exportBtn = document.getElementById('export-btn');
  const cancelBtn = document.getElementById('cancel-edit');
  const formTitle = document.getElementById('form-title');
  const formField = name => productForm.elements.namedItem(name);
  const statTotal = document.getElementById('stat-total');
  const statDisp = document.getElementById('stat-disponiveis');
  const statEsg = document.getElementById('stat-esgotados');
  let products = await getCurrentProducts();

  function refreshVisibility(){
    const logged = isLogged();
    loginWrap.classList.toggle('hidden', logged);
    adminWrap.classList.toggle('hidden', !logged);
    loginWrap.hidden = logged;
    adminWrap.hidden = !logged;
  }

  function resetForm(){
    productForm.reset();
    formField('id').value = '';
    formField('disponivel').checked = true;
    formField('imagemIlustrativa').checked = true;
    formTitle.textContent = 'Novo chaveiro';
    productFeedback.textContent = '';
  }

  function updateStats(){
    statTotal.textContent = products.length;
    statDisp.textContent = products.filter(p => productStatus(p) === 'disponivel').length;
    statEsg.textContent = products.filter(p => productStatus(p) === 'sem-estoque').length;
  }

  function renderAdminList(){
    updateStats();
    adminList.innerHTML = products.map(prod => `
      <article class="admin-item">
        <img src="${escapeHtml(prod.imagem)}" alt="${escapeHtml(prod.nome)}">
        <div class="admin-meta">
          <h3>${escapeHtml(prod.nome)}</h3>
          <p>${escapeHtml(prod.descricao)}</p>
          <div class="meta-small">${parseColorList(prod.cores || [])}</div>
          <p class="pill-stock"><b>${Number(prod.estoque)||0} un.</b> ${productStatus(prod) === 'disponivel' ? 'Disponível' : 'Sem estoque'}</p>
        </div>
        <div class="admin-actions">
          <button class="btn btn-outline" type="button" data-edit="${escapeHtml(prod.id)}">Editar</button>
          <button class="btn btn-outline" type="button" data-delete="${escapeHtml(prod.id)}">Excluir</button>
        </div>
      </article>`).join('');

    adminList.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.edit;
      const prod = products.find(p => p.id === id);
      if(!prod) return;
      formField('id').value = prod.id;
      formField('nome').value = prod.nome;
      formField('descricao').value = prod.descricao;
      formField('imagem').value = prod.imagem;
      formField('cores').value = productsToColorString(prod.cores || []);
      formField('estoque').value = Number(prod.estoque)||0;
      formField('disponivel').checked = !!prod.disponivel;
      formField('imagemIlustrativa').checked = !!(prod.imagemIlustrativa || prod.demonstrativo || String(prod.imagem).includes('mock-'));
      formTitle.textContent = 'Editar chaveiro';
      window.scrollTo({top: 0, behavior: 'smooth'});
    }));

    adminList.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.delete;
      const prod = products.find(p => p.id === id);
      if(!prod) return;
      if(confirm(`Excluir "${prod.nome}"?`)){
        products = products.filter(p => p.id !== id);
        saveProducts(products);
        renderAdminList();
        resetForm();
      }
    }));
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(loginForm);
    if(data.get('login') === ADMIN_LOGIN && await sha256(String(data.get('senha'))) === ADMIN_PASSWORD_HASH){
      setLogged(true);
      loginFeedback.textContent = '';
      refreshVisibility();
      renderAdminList();
    }else{
      loginFeedback.textContent = 'Login ou senha incorretos.';
    }
  });

  productForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(productForm);
    const id = (data.get('id') || '').toString().trim() || `produto-${Date.now()}`;
    const produto = {
      id,
      nome: data.get('nome').toString().trim(),
      descricao: data.get('descricao').toString().trim(),
      imagem: data.get('imagem').toString().trim() || 'assets/mock-pedagogia.svg',
      cores: colorStringToProducts(data.get('cores').toString()),
      estoque: Number(data.get('estoque')) || 0,
      disponivel: data.get('disponivel') === 'on',
      imagemIlustrativa: data.get('imagemIlustrativa') === 'on',
      demonstrativo: false
    };
    const idx = products.findIndex(p => p.id === id);
    if(idx >= 0) products[idx] = {...products[idx], ...produto};
    else products.unshift(produto);
    saveProducts(products);
    renderAdminList();
    resetForm();
    productFeedback.style.color = '#168b5e';
    productFeedback.textContent = 'Chaveiro salvo neste navegador. Exporte o JSON para atualizar o site público.';
  });

  cancelBtn.addEventListener('click', resetForm);
  logoutBtn.addEventListener('click', () => { setLogged(false); refreshVisibility(); });
  resetBtn.addEventListener('click', async () => {
    if(!confirm('Restaurar a base padrão de teste?')) return;
    localStorage.removeItem(STORAGE_KEY);
    products = await loadProducts();
    saveProducts(products);
    renderAdminList();
    resetForm();
  });
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(products, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chaveiros-pet.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  refreshVisibility();
  if(isLogged()) renderAdminList();
}

initAdmin().catch(err => { const warning = document.getElementById("login-feedback"); if(warning) warning.textContent="Não foi possível carregar o painel. Atualize a página para tentar novamente."; console.error(err); });
