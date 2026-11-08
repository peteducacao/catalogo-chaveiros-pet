// Testes locais da API, sem conta Cloudflare, sem GitHub e sem D1 remoto.
import assert from 'node:assert/strict';
import worker from '../cloudflare/catalog-worker.js';
const data=new Map([
 ['products',{revision:1,content:JSON.stringify([{id:'teste',nome:'Chaveiro de teste',estoque:2,disponivel:true}])}],
 ['config',{revision:1,content:JSON.stringify({redesSociais:[]})}]
]);
const sessions=new Map(),attempts=[];
const env={
 CATALOG_ADMIN_PASSWORD:'senha-de-teste-nao-real-123',
 CATALOG_GITHUB_TOKEN:'nao-utilizado-em-testes',
 ASSETS:{fetch:async()=>new Response('site estático',{status:200})},
 DB:{prepare(sql) {
   let args=[];
   return {
     bind(...values){args=values;return this;},
     async first(){
       if(sql.startsWith('SELECT COUNT(*) AS n FROM documents'))return {n:data.size};
       if(sql.includes('FROM documents WHERE'))return data.get(args[0])||null;
       if(sql.includes('FROM admin_sessions WHERE'))return sessions.get(args[0])>args[1]?{token_hash:args[0]}:null;
       if(sql.includes('FROM login_attempts WHERE'))return {n:attempts.filter(x=>x.key===args[0]&&x.created>args[1]).length};
       throw Error('Consulta não simulada: '+sql);
     },
     async run(){
       if(sql.startsWith('INSERT INTO login_attempts')){attempts.push({key:args[0],created:args[1]});return {meta:{changes:1}};}
       if(sql.startsWith('DELETE FROM login_attempts')){for(let i=attempts.length-1;i>=0;i--)if(attempts[i].key===args[0])attempts.splice(i,1);return {meta:{changes:1}};}
       if(sql.startsWith('INSERT INTO admin_sessions')){sessions.set(args[0],args[1]);return {meta:{changes:1}};}
       if(sql.startsWith('DELETE FROM admin_sessions')){sessions.delete(args[0]);return {meta:{changes:1}};}
       if(sql.startsWith('UPDATE documents')){
         const [content,,name,revision]=args,old=data.get(name);
         if(!old||old.revision!==revision)return {meta:{changes:0}};
         data.set(name,{revision:revision+1,content});return {meta:{changes:1}};
       }
       throw Error('Gravação não simulada: '+sql);
     }
   };
 }}
};
const url='https://catalogo-teste.invalid';
async function req(path,method='GET',payload,session){
 const headers={'content-type':'application/json'};
 if(session)headers.cookie=session;
 return worker.fetch(new Request(url+path,{
   method,headers,body:payload===undefined?undefined:JSON.stringify(payload)
 }),env);
}
const unauth=await req('/api/admin/doc/products');
assert.equal(unauth.status,401,'Leitura administrativa precisa de sessão');
const publicData=await req('/api/data/chaveiros.json');
assert.equal(publicData.status,200);
assert.equal((await publicData.json())[0].nome,'Chaveiro de teste');
const bad=await req('/api/login','POST',{senha:'errada'});
assert.equal(bad.status,401);
const good=await req('/api/login','POST',{senha:env.CATALOG_ADMIN_PASSWORD});
assert.equal(good.status,200);
const cookie=(good.headers.get('set-cookie')||'').split(';')[0];
assert.match(good.headers.get('set-cookie'),/HttpOnly/);
assert.match(good.headers.get('set-cookie'),/SameSite=Strict/);
assert.equal((await req('/api/admin/session','GET',undefined,cookie)).status,200);
const before=await (await req('/api/admin/doc/products','GET',undefined,cookie)).json();
assert.equal(before.sha,'v1');
const items=[{id:'teste',nome:'Chaveiro atualizado',estoque:3,disponivel:true}];
const encoded=Buffer.from(JSON.stringify(items),'utf8').toString('base64');
const saved=await req('/api/admin/doc/products','PUT',{sha:before.sha,content:encoded},cookie);
assert.equal(saved.status,200);
assert.equal((await saved.json()).commit.sha,'v2');
assert.equal((await (await req('/api/data/chaveiros.json')).json())[0].nome,'Chaveiro atualizado');
const conflict=await req('/api/admin/doc/products','PUT',{sha:'v1',content:encoded},cookie);
assert.equal(conflict.status,409,'Gravação concorrente precisa ser recusada');
assert.equal((await req('/api/admin/doc/config','PUT',{sha:'v1',content:encoded})).status,401);
const exit=await req('/api/logout','POST',{},cookie);
assert.equal(exit.status,200);
assert.equal((await req('/api/admin/session','GET',undefined,cookie)).status,401);
assert.equal((await req('/')).status,200);
console.log('OK: dados públicos, senha, sessão protegida, D1, concorrência, logout e site estático.');
