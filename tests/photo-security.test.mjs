import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/catalog-worker.js';

function structurallyValidWebP(){
  // Cabeçalho RIFF/WEBP coerente, com bloco VP8 de 10 bytes.
  // A imagem é fictícia, usada apenas em uma requisição simulada ao GitHub.
  const bytes=Buffer.alloc(30);
  bytes.write('RIFF',0,'ascii');
  bytes.writeUInt32LE(22,4);
  bytes.write('WEBP',8,'ascii');
  bytes.write('VP8 ',12,'ascii');
  bytes.writeUInt32LE(10,16);
  return bytes;
}
test('Fotografias: autorização, formato WebP, envio restrito ao GitHub e erros',async()=>{
  const sessions=new Map();
  const env={
    CATALOG_ADMIN_PASSWORD:'senha-ficticia-para-teste-local',
    CATALOG_GITHUB_TOKEN:'token-ficticio-que-nunca-sai-do-mock',
    ASSETS:{fetch:async()=>new Response('offline')},
    DB:{prepare(sql){
      let args=[];
      return {
        bind(...values){args=values;return this;},
        async first(){
          if(sql.includes('FROM login_attempts'))return {n:0};
          if(sql.includes('FROM admin_sessions WHERE')){
            return sessions.get(args[0])>args[1]?{token_hash:args[0]}:null;
          }
          throw Error('Leitura SQL inesperada: '+sql);
        },
        async run(){
          if(sql.startsWith('INSERT INTO admin_sessions')){
            sessions.set(args[0],args[1]);return {meta:{changes:1}};
          }
          if(sql.startsWith('DELETE FROM login_attempts'))return {meta:{changes:1}};
          if(sql.startsWith('DELETE FROM admin_sessions')){
            const done=sessions.delete(args[0]);return {meta:{changes:done?1:0}};
          }
          throw Error('Escrita SQL inesperada: '+sql);
        }
      };
    }}
  };
  const origin='https://catalogo-chaveiros-pet.pet-educacao.workers.dev';
  const call=async(path,payload,cookie)=>worker.fetch(new Request(origin+path,{
    method:'POST',
    headers:{'content-type':'application/json',...(cookie?{cookie}:{})},
    body:JSON.stringify(payload)
  }),env);
  const path='assets/produtos/auditoria-de-foto-ficticia.webp';
  const content=structurallyValidWebP().toString('base64');
  const originalFetch=globalThis.fetch;
  const intercepted=[];
  let upstreamStatus=201;
  globalThis.fetch=async (url,options)=>{
    intercepted.push({url:String(url),options});
    return new Response(JSON.stringify({commit:{sha:'hash-ficticio'}}),{
      status:upstreamStatus,
      headers:{'content-type':'application/json'}
    });
  };
  try{
    const unauthorized=await call('/api/admin/image',{path,content});
    assert.equal(unauthorized.status,401,'Não deve publicar fotos sem login');
    assert.equal(intercepted.length,0,'Requisições sem login nunca chegam ao GitHub');
    const login=await call('/api/login',{senha:env.CATALOG_ADMIN_PASSWORD});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const badPath=await call('/api/admin/image',{path:'../inventario-pet/admin.js',content},cookie);
    assert.equal(badPath.status,400,'O caminho só pode ficar dentro de assets/produtos');
    const truncated=await call('/api/admin/image',{
      path,content:Buffer.from('RIFFxxxxWEBP').toString('base64')
    },cookie);
    assert.equal(truncated.status,400,'WebP truncado deve ser recusado');
    const malformed=structurallyValidWebP();
    malformed.writeUInt32LE(4000,4);
    const corrupted=await call('/api/admin/image',{path,content:malformed.toString('base64')},cookie);
    assert.equal(corrupted.status,400,'Cabeçalho RIFF inconsistente deve ser recusado');
    assert.equal(intercepted.length,0,'Nenhum arquivo inválido pode chegar ao GitHub');
    const valid=await call('/api/admin/image',{path,content},cookie);
    assert.equal(valid.status,200);
    const result=await valid.json();
    assert.equal(result.path,path);
    assert.equal(intercepted.length,1);
    const {url,options}=intercepted[0];
    assert.equal(url,'https://api.github.com/repos/peteducacao/catalogo-chaveiros-pet/contents/'+path);
    assert.equal(options.method,'PUT');
    assert.equal(options.headers.authorization,'Bearer '+env.CATALOG_GITHUB_TOKEN);
    const upload=JSON.parse(options.body);
    assert.equal(upload.branch,'main');
    assert.equal(upload.content,content);
    assert.ok(!JSON.stringify(result).includes(env.CATALOG_GITHUB_TOKEN),'Nunca expor token na resposta');
    upstreamStatus=403;
    const denied=await call('/api/admin/image',{path,content},cookie);
    assert.equal(denied.status,502);
    const publicError=await denied.text();
    assert.ok(!publicError.includes(env.CATALOG_GITHUB_TOKEN));
    assert.ok(!publicError.includes('hash-ficticio'));
    console.log('OK: acesso restrito, WebP íntegro, escopo do repositório e erros sanitizados.');
  }finally{
    globalThis.fetch=originalFetch;
  }
});