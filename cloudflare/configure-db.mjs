// Descobre/cria apenas o D1 do catálogo. Nunca toca no D1 inventario-pet.
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const databaseName='catalogo-chaveiros-pet';
function wrangler(args) {
  return execFileSync('./node_modules/.bin/wrangler',args,{encoding:'utf8',env:process.env,maxBuffer:3_000_000});
}
function list(){
  const value=JSON.parse(wrangler(['d1','list','--json']));
  return Array.isArray(value)?value:Array.isArray(value.result)?value.result:Array.isArray(value.databases)?value.databases:[];
}
let db=list().find(item=>item.name===databaseName);
if(!db) {
  console.log('Criando banco separado: '+databaseName);
  wrangler(['d1','create',databaseName]);
  db=list().find(item=>item.name===databaseName);
}
const id=String(db?.uuid||db?.id||db?.database_id||'');
if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))throw Error('Não foi possível validar o UUID do banco independente.');
const config={
  name:'catalogo-chaveiros-pet',
  main:'cloudflare/catalog-worker.js',
  compatibility_date:'2026-11-07',
  assets:{directory:'./dist',binding:'ASSETS',run_worker_first:['/api/*']},
  d1_databases:[{binding:'DB',database_name:databaseName,database_id:id}]
};
await writeFile('wrangler.catalogo.jsonc',JSON.stringify(config,null,2)+'\n');
console.log('Banco do catálogo identificado e configuração preparada. Não tocou no Inventário PET.');
