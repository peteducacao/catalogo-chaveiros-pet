import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

function setup() {
  const html=readFileSync('cloudflare/painel-source.html','utf8');
  const app=readFileSync('cloudflare/dashboard-v2.js','utf8');
  const dom=new JSDOM(html,{
    url:'https://catalogo-chaveiros-pet.pet-educacao.workers.dev/painel.html',
    runScripts:'outside-only',pretendToBeVisual:true
  });
  dom.window.scrollTo=()=>{};
  const document=dom.window.document;
  // Simula os controladores existentes sem alterar o painel original.
  for(const [name,selector] of [
    ['products','#tab-products'],
    ['contacts','#tab-contacts']]){
    document.querySelector(selector).addEventListener('click',()=>{
      for(const key of ['products','contacts']) document.querySelector('#section-'+key).hidden=key!==name;
    });
  }
  dom.window.eval(app);
  return {dom,document};
}

test('Reorganiza sem perder IDs nem formulários',()=>{
  const {dom,document}=setup();
  assert.ok(document.getElementById('cg-workspace'));
  for(const id of ['admin-products','admin-search','btn-add','tab-products','tab-contacts',
    'manage-colors-open','manage-collections-open','editor-modal','editor-form',
    'product-quantity','product-price','save-product','section-contacts']){
    assert.equal(document.querySelectorAll('#'+id).length,1,'ID original não pode sumir ou duplicar: '+id);
  }
  assert.ok(document.querySelector('.cg-sidebar'));
  assert.ok(document.querySelector('.cg-overview-grid'));
  assert.equal(document.querySelectorAll('.cg-nav-button').length,5);
  assert.ok(document.getElementById('cg-overview')?.hidden===false);
  assert.equal(document.getElementById('product-description'),null,'Formulário não deve pedir descrição dos chaveiros');
  assert.equal(document.getElementById('section-products').hidden,true);
  dom.window.close();
});

test('Menu e abas do desktop e celular preservam as áreas existentes',async()=>{
  const {dom,document}=setup();
  const press=key=>document.querySelector('.cg-nav-button[data-cg-view="'+key+'"]').click();
  press('products');
  assert.equal(document.getElementById('section-products').hidden,false);
  assert.equal(document.getElementById('cg-overview').hidden,true);
  press('contacts');
  assert.equal(document.getElementById('section-contacts').hidden,false);
  press('colors');
  assert.equal(document.getElementById('cg-tools').hidden,false);
  assert.match(document.getElementById('cg-tool-title').textContent,/cores/);
  press('collections');
  assert.match(document.getElementById('cg-tool-title').textContent,/coleções/);
  press('overview');
  assert.equal(document.getElementById('cg-overview').hidden,false);
  const toggle=document.getElementById('cg-menu-toggle');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'),'true');
  document.getElementById('cg-menu-shade').click();
  assert.equal(toggle.getAttribute('aria-expanded'),'false');
  dom.window.close();
});

test('Atalhos acionam os botões originais em vez de duplicar regras',()=>{
  const {dom,document}=setup();
  let add=0,colors=0,collections=0;
  document.getElementById('btn-add').addEventListener('click',()=>add++);
  document.getElementById('manage-colors-open').addEventListener('click',()=>colors++);
  document.getElementById('manage-collections-open').addEventListener('click',()=>collections++);
  document.querySelector('[data-cg-action="new"]').click();
  assert.equal(add,1);
  document.querySelector('[data-cg-action="colors"]').click();
  assert.equal(colors,1);
  document.querySelector('[data-cg-action="collections"]').click();
  assert.equal(collections,1);
  assert.equal(document.getElementById('editor-form').getAttribute('method'),'dialog');
  dom.window.close();
});

test('Indicadores exibem os números existentes, sem histórico ou estatísticas inventadas',async()=>{
  const {dom,document}=setup();
  document.getElementById('stat-total').textContent='10';
  document.getElementById('stat-available').textContent='8';
  document.getElementById('stat-off').textContent='2';
  document.getElementById('stat-units').textContent='14 unidades em estoque';
  await new Promise(resolve=>dom.window.setTimeout(resolve,0));
  assert.equal(document.getElementById('cg-stock-total').textContent,'14');
  assert.equal(document.getElementById('cg-health-ratio').textContent,'80%');
  assert.match(document.getElementById('cg-health-note').textContent,/2 modelos sem estoque/);
  assert.ok(!document.querySelector('.cg-nav-button[data-cg-view="analytics"]'));
  assert.ok(!document.querySelector('.cg-nav-button[data-cg-view="home"]'));
  assert.equal(document.getElementById('tab-home'),null);
  assert.ok(!document.querySelector('.cg-notifications'));
  dom.window.close();
});

test('Cadastro: estoque e legenda não encolhem nem se sobrepõem no contêiner rolável',()=>{
  const {dom,document}=setup();
  const css=readFileSync('cloudflare/dashboard-v2.css','utf8');
  const marker=css.lastIndexOf('/* v7 — edição em GRID real');
  assert.ok(marker>=0,'A correção da estrutura do formulário deve existir');
  const style=document.createElement('style');
  style.textContent=css.slice(marker);
  document.head.append(style);
  const modalBody=document.querySelector('.editor-modal .modal-body');
  const stock=modalBody.querySelector(':scope > .stock-box');
  const caption=modalBody.querySelector(':scope > .illustrative-field');
  assert.ok(stock&&caption,'Estoque e legenda devem continuar com blocos próprios');
  assert.equal(stock.nextElementSibling,caption,'A legenda deve aparecer após estoque, não sobre ele');
  assert.equal(dom.window.getComputedStyle(modalBody).display,'grid','A grade empilha as seções sem encolher ou colapsar margens');
  assert.equal(dom.window.getComputedStyle(stock).display,'grid','O estoque deve usar uma grade compacta');
  assert.equal(dom.window.getComputedStyle(caption).display,'block','A legenda ocupa sua própria linha');
  for(const id of ['product-quantity','product-price','product-available','product-caption','product-collection']){
    assert.equal(document.querySelectorAll('#'+id).length,1,'Campos originais devem ser preservados: '+id);
  }
  dom.window.close();
});
