import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/catalog-worker.js';

test('Estatísticas: acesso por dia, navegador único e cliques com consentimento',async()=>{
  const days=new Map(),visitors=new Map(),actions=new Map(),sessions=new Map(),budgets=new Map();
  const key=(day,hash)=>day+'|'+hash;
  const env={
    CATALOG_ADMIN_PASSWORD:'senha-local-ficticia-para-teste',
    ASSETS:{fetch:async()=>new Response('HTML estático')},
    DB:{prepare(sql){
      let args=[];
      return {
        bind(...values){args=values;return this;},
        async first(){
          if(sql.includes('FROM login_attempts'))return {n:0};
          if(sql.includes('FROM admin_sessions WHERE')){
            const expiration=sessions.get(args[0]);
            return expiration && expiration>args[1]?{token_hash:args[0]}:null;
          }
          if(sql.startsWith('SELECT COUNT(*) AS n FROM documents'))return {n:2};
          throw Error('SQL first inesperado: '+sql);
        },
        async run(){
          let changed=0;
          if(sql.startsWith('INSERT INTO admin_sessions')){sessions.set(args[0],args[1]);changed=1;}
          else if(sql.startsWith('DELETE FROM login_attempts'))changed=1;
          else if(sql.startsWith('INSERT OR IGNORE INTO analytics_budget')){
            if(!budgets.has(args[0])){budgets.set(args[0],0);changed=1;}
          }else if(sql.startsWith('UPDATE analytics_budget')){
            const used=budgets.get(args[0]);
            if(Number.isInteger(used)&&used<6000){budgets.set(args[0],used+1);changed=1;}
          }else if(sql.startsWith('INSERT OR IGNORE INTO analytics_visitors')){
            const k=key(args[0],args[1]);
            if(!visitors.has(k)){visitors.set(k,{day:args[0],visitor_hash:args[1],views:0,actions:0});changed=1;}
          }else if(sql.startsWith('UPDATE analytics_visitors')){
            const item=visitors.get(key(args[0],args[1]));
            const prop=sql.includes('SET views=')?'views':'actions';
            if(item && item[prop]<args[2]){item[prop]++;changed=1;}
          }else if(sql.startsWith('INSERT INTO analytics_daily')){
            const [day,increment]=args;
            const item=days.get(day)||{day,views:0,visitors:0};
            item.views+=1;item.visitors+=increment;days.set(day,item);changed=1;
          }else if(sql.startsWith('INSERT INTO analytics_actions')){
            const [day,kind,id]=args;const k=[day,kind,id].join('|');
            const item=actions.get(k)||{day,kind,product_id:id,total:0};
            item.total++;actions.set(k,item);changed=1;
          }else if(sql.startsWith('DELETE FROM admin_sessions')){
            changed=sessions.delete(args[0])?1:0;
          }else throw Error('SQL run inesperado: '+sql);
          return {meta:{changes:changed}};
        },
        async all(){
          if(sql.includes('FROM analytics_daily'))return {results:[...days.values()].filter(x=>x.day>=args[0])};
          if(sql.includes('FROM analytics_actions')){
            const result=new Map();
            for(const x of actions.values()){
              if(x.day<args[0])continue;
              const k=x.kind+'|'+x.product_id;
              const prev=result.get(k)||{kind:x.kind,product_id:x.product_id,total:0};
              prev.total+=x.total;result.set(k,prev);
            }
            return {results:[...result.values()]};
          }
          throw Error('SQL all inesperado: '+sql);
        }
      };
    }}
  };
  const base='https://catalogo-chaveiros-pet.pet-educacao.workers.dev';
  const origin='https://peteducacao.github.io';
  const send=async(body,originHeader=origin)=>worker.fetch(new Request(base+'/api/analytics/event',{
    method:'POST',headers:{'content-type':'application/json',origin:originHeader},body:JSON.stringify(body)
  }),env);
  const id1='93b3bda3-3150-4eed-9677-f90fbed35298';
  const id2='51c9a402-2fbb-4656-8820-30932d93a3a9';
  const view=id=>({kind:'view',page:'catalogo',action:'',productId:'',visitor:id});
  const click=(id,action,productId)=>({kind:'click',page:'catalogo',action,productId,visitor:id});
  assert.equal((await send(view(id1))).status,200);
  assert.equal((await send(view(id1))).status,200);
  assert.equal((await send(view(id2))).status,200);
  assert.equal((await send(click(id1,'zoom','chaveiro-pet'))).status,200);
  assert.equal((await send(click(id1,'cor','chaveiro-pet'))).status,200);
  assert.equal((await send(click(id2,'instagram',''))).status,200);
  assert.equal((await send(click(id1,'malicioso','chaveiro-pet'))).status,400);
  assert.equal((await send(view(id1),'https://outro-site.example')).status,403);
  const preflight=await worker.fetch(new Request(base+'/api/analytics/event',{
    method:'OPTIONS',headers:{origin,'access-control-request-method':'POST'}
  }),env);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
  // Só um hash diário por navegador, mesmo que a pessoa atualize várias vezes.
  assert.equal(visitors.size,2);
  assert.ok([...visitors.values()].every(row=>/^[a-f0-9]{64}$/.test(row.visitor_hash)));
  assert.equal(JSON.stringify([...visitors.values()]).includes(id1),false);
  const noCookie=await worker.fetch(new Request(base+'/api/admin/analytics?days=7'),env);
  assert.equal(noCookie.status,401);
  const login=await worker.fetch(new Request(base+'/api/login',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({senha:env.CATALOG_ADMIN_PASSWORD})
  }),env);
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const report=await worker.fetch(new Request(base+'/api/admin/analytics?days=7',{headers:{cookie}}),env);
  assert.equal(report.status,200);
  const data=await report.json();
  assert.equal(data.views,3);
  assert.equal(data.visitorDays,2);
  assert.equal(data.clicks,3);
  assert.equal([...budgets.values()][0],6,'O teto diário deve contar somente eventos válidos');
  assert.equal(data.daily.length,1);
  const productClicks=data.actions.filter(row=>row.product_id==='chaveiro-pet').reduce((n,x)=>n+x.total,0);
  assert.equal(productClicks,2);
});