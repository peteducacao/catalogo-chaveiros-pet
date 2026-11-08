// Monta uma cópia do site destinada ao Cloudflare Worker.
// Não altera os arquivos publicados pelo GitHub Pages.
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const root=process.cwd();
const out=join(root,'dist');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const name of await readdir(root)){
  if(name.endsWith('.html'))await cp(join(root,name),join(out,name));
}
await cp(join(root,'assets'),join(out,'assets'),{recursive:true});
const oldLoad = "async function loadData(file){const response=await fetch(file+'?v=31&at='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('Arquivo indisponível: '+file);return response.json();}";
const newLoad = "async function loadData(file){const url=file==='data/chaveiros.json'?'/api/data/chaveiros.json':file==='data/config.json'?'/api/data/config.json':null;if(!url)throw Error('Arquivo de dados não autorizado');const response=await fetch(url,{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw Error('Dados do catálogo indisponíveis.');return response.json();}";
for(const name of ['site-v31.js','site-v58.js','home-v53.js']){
  const path=join(out,'assets',name);
  const original=await readFile(path,'utf8');
  if(original.split(oldLoad).length!==2)throw Error('Não foi possível adaptar a consulta: '+name);
  await writeFile(path,original.replace(oldLoad,newLoad));
}
await cp(join(root,'cloudflare','admin-cloudflare.js'),join(out,'assets','admin-v58.js'));
const panelFile=join(out,'painel.html');
let panel=await readFile(panelFile,'utf8');
panel=panel.replace('>Admin</label><input type="password" id="token-input"', '>Senha administrativa</label><input type="password" id="token-input"');
panel=panel.replace('placeholder="Credencial de acesso"','placeholder="Senha do Catálogo PET"');
panel=panel.replace('connect-src \'self\' https://api.github.com','connect-src \'self\'');
await writeFile(panelFile,panel);
for(const name of ['index.html','catalogo.html','contato.html']){
  const file=join(out,name);
  const original=await readFile(file,'utf8');
  await writeFile(file,original.replace("connect-src 'self' https://api.github.com","connect-src 'self'"));
}
// Seed idempotente: nunca reescrever dados que já foram editados no novo painel.
const q=text=>"'"+String(text).replaceAll("'","''")+"'";
let seed='-- Inicialização somente quando os documentos não existem.\n';
for(const [name,path] of [['products','data/chaveiros.json'],['config','data/config.json']]){
  const data=JSON.parse(await readFile(join(root,path),'utf8'));
  const json=JSON.stringify(data);
  seed+='INSERT OR IGNORE INTO documents(name, revision, content) VALUES ('+q(name)+', 1, '+q(json)+');\n';
}
await writeFile(join(root,'cloudflare','seed.generated.sql'),seed);
console.log('Cópia Cloudflare criada; dados iniciais preservados e fotos mantidas no GitHub.');
