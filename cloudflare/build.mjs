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
// A página antiga redireciona para o novo painel; a cópia completa mora aqui.
await cp(join(root,'cloudflare','painel-source.html'),join(out,'painel.html'));
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
// Manual do Worker: login por senha, gravação instantânea no D1, fotos no GitHub.
panel=panel.replace(
  'Os dados são armazenados no GitHub e aparecem no site após a publicação do GitHub Pages.',
  'Os chaveiros, valores, estoques e textos são salvos no banco exclusivo do Catálogo PET. Apenas as fotografias ficam armazenadas no GitHub.'
);
const firstGuide=/\<details open\>\<summary\>1\. Primeiros passos: acesso, senha e segurança\<\/summary\>[\s\S]*?\<\/details\>/;
if(!firstGuide.test(panel))throw Error('Primeira seção do manual não encontrada.');
panel=panel.replace(firstGuide,
  '<details open><summary>1. Primeiros passos: acesso, senha e segurança</summary><div class="guide-text">'+
  '<ol><li>Entre no painel com a <strong>senha administrativa exclusiva do catálogo</strong>. Não é necessário gerar ou informar token do GitHub.</li>'+
  '<li>O servidor Cloudflare verifica a senha, e a sessão é protegida por um cookie seguro. A senha não é salva no navegador.</li>'+
  '<li>O indicador <strong>Conectado</strong> aparece após o acesso. Clique em <strong>Sair</strong> quando terminar.</li>'+
  '<li>Não compartilhe sua senha. Para alterar a senha do painel, atualize o segredo <code>CATALOG_ADMIN_PASSWORD</code> no GitHub Actions do repositório do catálogo e faça uma nova implantação.</li>'+
  '<li>Os dados são gravados em um banco D1 <strong>independente do Inventário PET</strong>. As fotografias são enviadas pelo servidor ao repositório do catálogo.</li></ol>'+
  '<p class="guide-warning"><strong>Importante:</strong> os tokens do GitHub e da Cloudflare ficam protegidos no servidor/implantação. Não os copie para este painel.</p></div></details>'
);
panel=panel.replaceAll('aguarde a confirmação do GitHub','aguarde a confirmação do catálogo')
  .replaceAll('Aguarde o salvamento no GitHub','Aguarde o salvamento no catálogo')
  .replaceAll('gravações do repositório','gravações do banco')
  .replaceAll('mudanças são gravadas automaticamente no GitHub','mudanças são gravadas automaticamente no catálogo')
  .replaceAll('aguarde a mensagem de confirmação do GitHub','aguarde a mensagem de confirmação do catálogo')
  .replaceAll('A página pública pode levar alguns minutos para refletir a mudança pelo GitHub Pages','As mudanças ficam disponíveis no catálogo ao recarregar a página')
  .replaceAll('as alterações são publicadas no GitHub','as alterações são salvas no catálogo')
  .replaceAll('As alterações são publicadas no GitHub','As alterações são salvas no catálogo')
  .replaceAll('histórico do GitHub poderá','catálogo poderá')
  .replaceAll('>Ver confirmação no GitHub ↗','>Ver confirmação de gravação');
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
