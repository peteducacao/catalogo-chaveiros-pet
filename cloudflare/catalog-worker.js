// Catálogo PET: API independente do Inventário PET. Nenhuma credencial vai para o navegador.
const repo = 'peteducacao/catalogo-chaveiros-pet';
const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};
const sessionCookie = '__Host_catalogo_pet_session';
function reply(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...extra } });
}
const fail = (message, status = 400) => reply({ message, error: message }, status);
function readCookie(request, name) {
  const found = (request.headers.get('cookie') || '').split(';')
    .map(part => part.trim()).find(part => part.startsWith(name + '='));
  return found ? found.slice(name.length + 1) : '';
}
async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}
function makeCookie(value) {
  return sessionCookie + '=' + value + '; Path=/; Secure; HttpOnly; SameSite=Strict';
}
async function authorized(request, env) {
  const token = readCookie(request, sessionCookie);
  if (!/^[a-f0-9]{64}$/i.test(token)) return false;
  const found = await env.DB.prepare(
    'SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > ?'
  ).bind(await hash(token), new Date().toISOString()).first();
  return !!found;
}
function parseJson(request, maxBytes = 1200000) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw Object.assign(new Error('Envio muito grande.'), { status: 413 });
  return request.text().then(text => {
    if (text.length > maxBytes) throw Object.assign(new Error('Envio muito grande.'), { status: 413 });
    try { return JSON.parse(text); }
    catch { throw Object.assign(new Error('Dados inválidos.'), { status: 400 }); }
  });
}
async function readDoc(db, name) {
  return db.prepare('SELECT revision, content FROM documents WHERE name=?').bind(name).first();
}
function toBase64UTF8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}
function decodeBase64UTF8(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 1200000 || !/^[A-Za-z0-9+/=\s]+$/.test(encoded)) {
    throw Object.assign(new Error('Conteúdo inválido.'), { status: 400 });
  }
  const raw = atob(encoded.replace(/\s/g, ''));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(raw, c => c.charCodeAt(0)));
}
function validateDoc(name, value) {
  if (name === 'products') {
    if (!Array.isArray(value) || value.length > 500 ||
        !value.every(x => x && typeof x === 'object' && !Array.isArray(x) &&
          typeof x.id === 'string' && x.id.length <= 120 &&
          typeof x.nome === 'string' && x.nome.length <= 180)) {
      throw Object.assign(new Error('Lista de chaveiros inválida.'), { status: 400 });
    }
  } else if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('Configuração inválida.'), { status: 400 });
  }
}
async function uploadPhoto(request, env) {
  if (!env.CATALOG_GITHUB_TOKEN) return fail('Credencial de fotografias não configurada.', 503);
  const body = await parseJson(request, 9000000);
  const path = String(body.path || '');
  if (!/^assets\/produtos\/[a-z0-9_-]+\.webp$/i.test(path) || path.length > 170) {
    return fail('Nome de fotografia inválido.');
  }
  const encoded = String(body.content || '');
  if (!/^[A-Za-z0-9+/=]+$/.test(encoded) || encoded.length > 7500000) return fail('Imagem inválida ou muito grande.', 413);
  let bytes;
  try { bytes = atob(encoded); } catch { return fail('Fotografia inválida.'); }
  if (bytes.length > 5600000 || bytes.slice(0, 4) !== 'RIFF' || bytes.slice(8, 12) !== 'WEBP') {
    return fail('O arquivo precisa ser uma fotografia WebP válida.');
  }
  const gh = await fetch('https://api.github.com/repos/' + repo + '/contents/' + path, {
    method: 'PUT',
    headers: {
      'authorization': 'Bearer ' + env.CATALOG_GITHUB_TOKEN,
      'accept': 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'catalogo-pet-worker',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ message: 'Adiciona fotografia do catálogo PET', content: encoded, branch: 'main' })
  });
  const bodyText = await gh.text();
  if (!gh.ok) {
    // Não repassar detalhes de API ou credenciais para o usuário.
    return fail(gh.status === 401 || gh.status === 403
      ? 'O GitHub não autorizou a publicação. Confira o token de fotos.'
      : 'O GitHub não conseguiu salvar esta fotografia (' + gh.status + ').', 502);
  }
  let saved;
  try { saved = JSON.parse(bodyText); } catch { return fail('Resposta inesperada do GitHub.', 502); }
  return reply({ ok: true, path, commit: saved.commit?.sha || null });
}

const analyticsOrigins = new Set([
  'https://peteducacao.github.io',
  'https://catalogo-chaveiros-pet.pet-educacao.workers.dev'
]);
function analyticsCors(origin){
  if(!analyticsOrigins.has(origin))return null;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-max-age': '600',
    'vary': 'Origin'
  };
}
function analyticsDay(time=Date.now()){
  // Dia civil da região do PET (Sergipe); não usar UTC para dividir as visitas.
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Maceio',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(time));
}
async function analyticsRecord(request,env){
  const cors=analyticsCors(request.headers.get('origin'));
  if(!cors)return fail('Origem não autorizada.',403);
  const input=await parseJson(request,1000);
  const client=String(input.visitor||'');
  const page=String(input.page||'');
  const kind=String(input.kind||'');
  const action=String(input.action||'');
  const productId=String(input.productId||'');
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[0-9a-f]{4}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(client) ||
      !['catalogo','contato'].includes(page) ||
      !['view','click'].includes(kind) ||
      (kind==='click'&&!['zoom','cor','copiar','instagram'].includes(action)) ||
      (kind==='view'&&(action||productId)) ||
      productId.length>120 || (productId&&!/^[a-zA-Z0-9_-]+$/.test(productId))) {
    return reply({ok:false,message:'Evento inválido.'},400,cors);
  }
  const day=analyticsDay();
  // A cada dia um hash diferente: sem IP armazenado, sem vincular sessões entre dias.
  const visitorHash=await hash('catalogo-pet:'+day+':'+client);
  const first=await env.DB.prepare(
    'INSERT OR IGNORE INTO analytics_visitors(day,visitor_hash,views,actions) VALUES(?,?,0,0)'
  ).bind(day,visitorHash).run();
  const cap=kind==='view'?35:150;
  const changed=await env.DB.prepare(kind==='view'
    ?'UPDATE analytics_visitors SET views=views+1 WHERE day=? AND visitor_hash=? AND views<?'
    :'UPDATE analytics_visitors SET actions=actions+1 WHERE day=? AND visitor_hash=? AND actions<?'
  ).bind(day,visitorHash,cap).run();
  if(Number(changed.meta?.changes)!==1)return reply({ok:true,limit:true},200,cors);
  if(kind==='view'){
    await env.DB.prepare(
      'INSERT INTO analytics_daily(day,views,visitors) VALUES(?,1,?) ON CONFLICT(day) DO UPDATE SET views=views+1,visitors=visitors+excluded.visitors'
    ).bind(day,Number(first.meta?.changes)===1?1:0).run();
  }else{
    await env.DB.prepare(
      'INSERT INTO analytics_actions(day,kind,product_id,total) VALUES(?,?,?,1) ON CONFLICT(day,kind,product_id) DO UPDATE SET total=total+1'
    ).bind(day,action,productId).run();
  }
  return reply({ok:true},200,cors);
}
async function analyticsReport(request,env){
  const days=Number(new URL(request.url).searchParams.get('days'))||30;
  if(![7,30,90].includes(days))return fail('Período inválido.',400);
  const start=analyticsDay(Date.now()-(days-1)*86400000);
  const [daily,actions]=await Promise.all([
    env.DB.prepare('SELECT day,views,visitors FROM analytics_daily WHERE day>=? ORDER BY day ASC').bind(start).all(),
    env.DB.prepare('SELECT kind,product_id,SUM(total) AS total FROM analytics_actions WHERE day>=? GROUP BY kind,product_id ORDER BY total DESC LIMIT 500').bind(start).all()
  ]);
  const dates=daily.results||[], clicks=actions.results||[];
  const total=dates.reduce((sum,r)=>sum+Number(r.views||0),0);
  const uniqueApprox=dates.reduce((sum,r)=>sum+Number(r.visitors||0),0);
  return reply({
    ok:true,days,start,today:analyticsDay(),views:total,
    visitorDays:uniqueApprox,
    clicks:clicks.reduce((sum,r)=>sum+Number(r.total||0),0),
    daily:dates,actions:clicks,
    note:'Visitantes por dia estimados por navegador com consentimento. O mesmo navegador em dias diferentes conta novamente.'
  });
}

async function processApi(request, env) {
  const path = new URL(request.url).pathname;
  const method = request.method.toUpperCase();
  if(path==='/api/analytics/event' && method==='OPTIONS'){
    const cors=analyticsCors(request.headers.get('origin'));
    return cors?new Response(null,{status:204,headers:cors}):fail('Origem não autorizada.',403);
  }
  if(path==='/api/analytics/event' && method==='POST')return analyticsRecord(request,env);
  if (path === '/api/health' && method === 'GET') {
    const item = await env.DB.prepare('SELECT COUNT(*) AS n FROM documents').first();
    return reply({ ok: Number(item?.n) === 2, service: 'Catálogo PET', database: 'separado', documents: item?.n || 0 });
  }
  if (path === '/api/login' && method === 'POST') {
    if (!env.CATALOG_ADMIN_PASSWORD) return fail('Senha administrativa não configurada.', 503);
    const body = await parseJson(request, 5000);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const key = await hash(env.CATALOG_ADMIN_PASSWORD + ':' + ip);
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const attempts = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM login_attempts WHERE ip_hash=? AND created_at > ?'
    ).bind(key, cutoff).first();
    if (Number(attempts?.n) >= 8) return fail('Muitas tentativas de acesso. Tente novamente mais tarde.', 429);
    const expected = await hash(env.CATALOG_ADMIN_PASSWORD);
    const got = await hash(String(body.senha || ''));
    if (expected !== got) {
      await env.DB.prepare('INSERT INTO login_attempts(ip_hash,created_at) VALUES (?,?)')
        .bind(key, new Date().toISOString()).run();
      return fail('Senha incorreta.', 401);
    }
    await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash=?').bind(key).run();
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare('INSERT INTO admin_sessions(token_hash,expires_at) VALUES (?,?)')
      .bind(await hash(token), new Date(Date.now() + 12 * 3600000).toISOString()).run();
    return reply({ ok: true, nome: 'Admin PET' }, 200, { 'set-cookie': makeCookie(token) });
  }
  if (path === '/api/logout' && method === 'POST') {
    const token = readCookie(request, sessionCookie);
    if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await hash(token)).run();
    return reply({ ok: true }, 200, { 'set-cookie': makeCookie('') + '; Max-Age=0' });
  }
  if ((path === '/api/data/chaveiros.json' || path === '/api/data/config.json') && method === 'GET') {
    const row = await readDoc(env.DB, path.endsWith('chaveiros.json') ? 'products' : 'config');
    if (!row) return fail('Catálogo ainda não inicializado.', 503);
    // Dados públicos podem ser consultados pelo catálogo original no GitHub Pages.
    // Nunca habilitar CORS nas rotas administrativas, que dependem de sessão local.
    return new Response(row.content, {
      status: 200,
      headers: {
        ...jsonHeaders,
        'access-control-allow-origin': 'https://peteducacao.github.io',
        'vary': 'Origin'
      }
    });
  }
  if (path === '/api/admin/session' && method === 'GET') {
    return await authorized(request, env) ? reply({ ok: true, nome: 'Admin PET' }) : fail('Entre novamente.', 401);
  }
  if (!path.startsWith('/api/admin/')) return fail('Endereço não encontrado.', 404);
  if (!await authorized(request, env)) return fail('Entre no painel novamente.', 401);
  if (path === '/api/admin/analytics' && method === 'GET') return analyticsReport(request,env);
  if (path === '/api/admin/image' && method === 'POST') return uploadPhoto(request, env);
  const match = /^\/api\/admin\/doc\/(products|config)$/.exec(path);
  if (!match || !['GET', 'PUT'].includes(method)) return fail('Operação desconhecida.', 404);
  const name = match[1];
  const row = await readDoc(env.DB, name);
  if (!row) return fail('Dados iniciais ainda não migrados.', 503);
  if (method === 'GET') return reply({ sha: 'v' + row.revision, content: toBase64UTF8(row.content) });
  const body = await parseJson(request);
  if (!/^v\d+$/.test(String(body.sha || ''))) return fail('Versão do registro inválida.', 400);
  if (Number(body.sha.slice(1)) !== Number(row.revision)) return fail('Conflito: os dados mudaram desde a última leitura.', 409);
  const text = decodeBase64UTF8(body.content);
  let value;
  try { value = JSON.parse(text); } catch { return fail('O arquivo contém JSON inválido.'); }
  validateDoc(name, value);
  const data = JSON.stringify(value);
  const outcome = await env.DB.prepare(
    'UPDATE documents SET content=?, revision=revision+1, updated_at=? WHERE name=? AND revision=?'
  ).bind(data, new Date().toISOString(), name, row.revision).run();
  if (outcome.meta?.changes !== 1) return fail('Conflito: outra alteração já foi salva.', 409);
  return reply({ ok: true, commit: { sha: 'v' + (Number(row.revision) + 1) } });
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await processApi(request, env);
    } catch (err) {
      // Não expor mensagens inesperadas do servidor nem detalhes do banco.
      if (err?.status) return fail(err.message, err.status);
      console.error('Catálogo PET API falhou:', err?.name || 'unknown');
      return fail('Não foi possível concluir a operação. Tente novamente.', 500);
    }
  }
};
