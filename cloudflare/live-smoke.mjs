// Verificação de ponta a ponta. Nunca escreve ou imprime a senha nos logs.
import assert from 'node:assert/strict';
const base=(process.env.CATALOG_WORKER_URL||'').replace(/\/$/,'');
const password=process.env.CATALOG_ADMIN_PASSWORD;
if(!base||!password)throw Error('Configuração do teste real incompleta.');
const health=await fetch(base+'/api/health',{cache:'no-store'});
assert.equal(health.status,200,'Worker deve estar funcionando');
const info=await health.json();
assert.equal(info.service,'Catálogo PET');
assert.equal(info.documents,2,'Dois documentos devem ter sido migrados');
const panel=await fetch(base+'/painel.html',{cache:'no-store'});
assert.equal(panel.status,200);
const panelText=await panel.text();
assert.ok(panelText.includes('>Senha administrativa</label>'),'Painel deveria pedir senha');
assert.ok(!panelText.includes('entre com um token de acesso pessoal'),'Manual não pode recomendar token');
const javascript=await fetch(base+'/assets/admin-v58.js',{cache:'no-store'});
assert.equal(javascript.status,200);
const js=await javascript.text();
assert.ok(js.includes("cloudApi('/api/login'"),'Painel deve usar API de senha');
assert.ok(!js.includes("Authorization:'Bearer '+token"),'Token não deve ser usado no navegador');
const unauth=await fetch(base+'/api/admin/doc/products');
assert.equal(unauth.status,401,'Dados privados devem exigir sessão');
const login=await fetch(base+'/api/login',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({senha:password}),cache:'no-store'
});
assert.equal(login.status,200,'A senha configurada deve permitir login');
const cookie=(login.headers.get('set-cookie')||'').split(';')[0];
assert.ok(cookie.startsWith('__Host_catalogo_pet_session='));
const options={headers:{cookie},cache:'no-store'};
const [p,c]=await Promise.all([
 fetch(base+'/api/admin/doc/products',options),
 fetch(base+'/api/admin/doc/config',options)
]);
assert.equal(p.status,200,'Produtos protegidos devem ser acessíveis');
assert.equal(c.status,200,'Configurações protegidas devem ser acessíveis');
const analytics=await fetch(base+'/api/admin/analytics?days=7',options);
assert.equal(analytics.status,200,'Estatísticas devem exigir e aceitar sessão administrativa');
const metrics=await analytics.json();
assert.ok(metrics.ok&&Array.isArray(metrics.daily)&&Array.isArray(metrics.actions));
const preflight=await fetch(base+'/api/analytics/event',{
  method:'OPTIONS',headers:{
    Origin:'https://peteducacao.github.io',
    'Access-Control-Request-Method':'POST',
    'Access-Control-Request-Headers':'Content-Type'
  }
});
assert.equal(preflight.status,204,'O catálogo do GitHub deve poder enviar cliques');
assert.equal(preflight.headers.get('access-control-allow-origin'),'https://peteducacao.github.io');
const notAuthorizedStats=await fetch(base+'/api/admin/analytics?days=7');
assert.equal(notAuthorizedStats.status,401,'Estatísticas são privadas');
const tracker=await fetch(base+'/assets/catalog-analytics.js');
assert.equal(tracker.status,200,'Coletor deve existir no site');
const chart=await fetch(base+'/assets/dashboard-v2.js');
assert.equal(chart.status,200);
assert.ok((await chart.text()).includes("id='cg-analytics'"),'Painel deve conter aba Estatísticas');

const productDoc=await p.json();
const configDoc=await c.json();
const products=JSON.parse(Buffer.from(productDoc.content,'base64').toString('utf8'));
const config=JSON.parse(Buffer.from(configDoc.content,'base64').toString('utf8'));
assert.ok(Array.isArray(products)&&products.length>=1,'Produtos devem ter sido preservados');
assert.ok(config&&typeof config==='object'&&!Array.isArray(config));
const publicData=await fetch(base+'/api/data/chaveiros.json',{
  cache:'no-store',headers:{Origin:'https://peteducacao.github.io'}
});
assert.equal(publicData.status,200);
assert.equal(publicData.headers.get('access-control-allow-origin'),'https://peteducacao.github.io',
 'O GitHub Pages deve ter permissão CORS somente para a leitura pública.');
assert.deepEqual(await publicData.json(),products,'Catálogo público e painel devem ler o mesmo banco');
const logout=await fetch(base+'/api/logout',{
 method:'POST',headers:{cookie,'content-type':'application/json'},body:'{}'
});
assert.equal(logout.status,200);
assert.equal((await fetch(base+'/api/admin/session',options)).status,401,'Logout deve invalidar sessão');
console.log('OK: site Cloudflare, senha, sessão protegida, '+products.length+' chaveiros, configurações e logout.');
