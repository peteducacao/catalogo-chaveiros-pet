// Auditoria end-to-end real com Chrome instalado no runner do GitHub.
// Somente LEITURA: abre formulários e visualiza dados sem salvar, apagar ou criar produtos.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const publicBase = 'https://peteducacao.github.io/catalogo-chaveiros-pet/';
const privateBase = (process.env.CATALOG_WORKER_URL || 'https://catalogo-chaveiros-pet.pet-educacao.workers.dev').replace(/\/$/, '') + '/';
const password = process.env.CATALOG_ADMIN_PASSWORD;
if (!password) throw new Error('Senha de auditoria não configurada. Nenhuma senha será registrada em log.');
const bin = execFileSync('sh',['-c','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let errors=0,checks=0;
const check=(condition,message)=>{checks++;assert.ok(condition,message)};
const bound=(r)=>({top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width});
async function geometry(page){
  return page.evaluate(()=>{
    const ids=['stock','priceField','quantityField','available','caption','captionLabel','captionInput','collection','modalBody'];
    const sel={
      stock:'.editor-modal .modal-body > .stock-box',
      priceField:'.editor-modal .stock-box .field:has(#product-price)',
      quantityField:'.editor-modal .stock-box .field:has(#product-quantity)',
      available:'.editor-modal .stock-box .toggle-field:has(#product-available)',
      caption:'.editor-modal .modal-body > .illustrative-field',
      captionLabel:'.editor-modal #caption-field > label',
      captionInput:'#product-caption',
      collection:'#product-collection',
      modalBody:'.editor-modal .modal-body'
    };
    const out={};
    for(const id of ids){
      const el=document.querySelector(sel[id]);
      if(!el)throw Error('Campo do editor ausente: '+id);
      const r=el.getBoundingClientRect();
      out[id]={top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
    }
    out.viewport=window.innerWidth;
    out.bodyWidth=document.documentElement.scrollWidth;
    out.stockStyle=getComputedStyle(document.querySelector(sel.stock)).display;
    out.bodyStyle=getComputedStyle(document.querySelector(sel.modalBody)).display;
    out.scrollHeight=document.querySelector(sel.modalBody).scrollHeight;
    out.clientHeight=document.querySelector(sel.modalBody).clientHeight;
    return out;
  });
}
async function useAdmin(width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'pt-BR'});
  const page=await context.newPage();
  const viewportLabel=width+'x'+height;
  try{
    let uncaught=[];
    page.on('pageerror',err=>uncaught.push(String(err.message)));
    const response=await page.goto(privateBase+'painel.html',{waitUntil:'domcontentloaded',timeout:45000});
    check(response?.ok(),'Painel indisponível '+viewportLabel);
    await page.locator('#token-input').fill(password);
    await page.locator('#login-submit').click();
    await page.locator('#cg-workspace').waitFor({state:'visible',timeout:22000});
    check(await page.locator('.cg-nav-button').count()===5,'Menu administrativo inconsistente');
    check((await page.locator('#stat-total').innerText()).trim()!=='','Contador não carregou');
    const nav=async(name)=>{
      if(width<=820){
        await page.locator('#cg-menu-toggle').click();
        await page.locator('.cg-sidebar.is-open').waitFor({state:'visible'});
      }
      await page.locator('.cg-nav-button[data-cg-view="'+name+'"]').click();
    };
    await nav('products');
    await page.locator('#btn-add').click();
    await page.locator('#editor-modal').waitFor({state:'visible'});
    // Conferir a estrutura real, não só a presença dos elementos no DOM.
    let rect=await geometry(page);
    check(rect.bodyStyle==='grid','A área do formulário precisa usar grid para impedir sobreposição: '+JSON.stringify(rect));
    check(rect.stockStyle==='grid','Quantidade e preço não estão na grade');
    check(rect.stock.bottom+3<=rect.caption.top,
      'Estoque está por cima da legenda em '+viewportLabel+': '+JSON.stringify(rect));
    check(rect.quantityField.bottom+3<=rect.available.top,'Quantidade sobrepõe Disponível: '+viewportLabel);
    check(rect.priceField.bottom+3<=rect.available.top,'Preço sobrepõe Disponível: '+viewportLabel);
    check(rect.captionLabel.bottom<=rect.captionInput.top,'Legenda cobre o campo de texto: '+viewportLabel);
    check(rect.collection.height>=35&&rect.collection.height<=56,'Coleção excessivamente alta em '+viewportLabel);
    check(rect.bodyWidth<=rect.viewport+4,'Rolagem horizontal na tela de edição '+viewportLabel);
    check(rect.scrollHeight>=rect.clientHeight,'A rolagem do formulário está incorreta');
    await page.locator('#product-variant-mode').selectOption('cor');
    check(await page.locator('#product-variants-container').isVisible(),'O editor não exibiu as variações');
    await page.locator('#product-add-variant').click();
    check(await page.locator('.admin-variant-card').count()===1,'Adicionar variação falhou');
    // Cancelar edição não altera o D1.
    await page.locator('#cancel-modal').click();
    check(!(await page.locator('#editor-modal').evaluate(el=>el.open)),'Cancelar não fecha o formulário');
    await nav('colors');
    await page.locator('#cg-tool-open').click();
    check(await page.locator('#colors-manager-dialog').evaluate(el=>el.open),'O gerenciador de cores não abre');
    await page.locator('#colors-manager-close').click();
    await nav('collections');
    await page.locator('#cg-tool-open').click();
    check(await page.locator('#collections-manager-dialog').evaluate(el=>el.open),'O gerenciador de coleções não abre');
    await page.locator('#collections-manager-close').click();
    await nav('contacts');
    check(await page.locator('#contact-info-form').isVisible(),'Contatos não estão acessíveis');
    await nav('overview');
    check(await page.locator('#cg-overview').isVisible(),'Visão geral não reabre');
    check(!uncaught.length,'Erros de JavaScript no painel: '+uncaught.join(' / '));
    console.log('OK painel '+viewportLabel+': login, layout real, campos, variações, cores, coleções, contatos e navegação. Verificações: '+checks);
    await page.locator('#logout').click();
    await page.locator('#login-screen').waitFor({state:'visible'});
  }finally{await context.close();}
}
async function usePublic(width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'pt-BR'});
  const page=await context.newPage();
  const label=width+'x'+height;
  try{
    const uncaught=[];
    page.on('pageerror',error=>uncaught.push(String(error.message)));
    const response=await page.goto(publicBase+'catalogo.html',{waitUntil:'domcontentloaded',timeout:45000});
    check(response?.ok(),'Catálogo público indisponível '+label);
    await page.locator('#catalog-grid .product-card').first().waitFor({state:'visible',timeout:25000});
    const cards=await page.locator('#catalog-grid .product-card').count();
    check(cards>=1,'Nenhum chaveiro renderizado no catálogo público');
    const overflow=await page.evaluate(()=>({
      html:document.documentElement.scrollWidth,viewport:window.innerWidth
    }));
    check(overflow.html<=overflow.viewport+4,'Catálogo com rolagem horizontal '+label+' '+JSON.stringify(overflow));
    const priceAndColor=page.locator('.product-card:has(.product-variation-toggle):has(.product-price)').first();
    if(await priceAndColor.count()){
      const rect=await priceAndColor.evaluate(el=>{
        const price=el.querySelector('.product-price').getBoundingClientRect();
        const colors=el.querySelector('.product-variation-toggle').getBoundingClientRect();
        const card=el.getBoundingClientRect();
        return {price:{bottom:price.bottom},colors:{top:colors.top,width:colors.width},card:{width:card.width}};
      });
      check(rect.price.bottom<=rect.colors.top+1,'Preço e seletor sobrepostos '+label+': '+JSON.stringify(rect));
      check(rect.colors.width>=rect.card.width*.68,'Seletor de cores apertado '+label+': '+JSON.stringify(rect));
      await priceAndColor.locator('.product-variation-toggle').click();
      check(await priceAndColor.locator('.product-variation-panel').isVisible(),'As opções de cores não abrem');
    }
    await page.locator('#buscar').fill('buscar-um-modelo-inexistente-xyz');
    await page.locator('#catalog-empty').waitFor({state:'visible'});
    await page.locator('#buscar').fill('');
    await page.locator('#catalog-grid .product-card').first().waitFor({state:'visible'});
    check(!uncaught.length,'Erros no catálogo público: '+uncaught.join(' / '));
    const contact=await page.goto(publicBase+'contato.html',{waitUntil:'domcontentloaded'});
    check(contact?.ok(),'Página de contato não abre '+label);
    check(await page.locator('#contact-info-email').count()===1,'E-mail público ausente');
    check(await page.locator('#contact-map-load').count()===1,'Botão de mapa ausente');
    console.log('OK público '+label+': '+cards+' cartões, cores, busca, responsividade e contatos.');
  }finally{await context.close();}
}
try{
  await useAdmin(1366,900);
  await useAdmin(1024,768);
  await useAdmin(768,1024);
  await useAdmin(390,844);
  await useAdmin(360,760);
  await usePublic(1366,900);
  await usePublic(1024,768);
  await usePublic(768,1024);
  await usePublic(390,844);
  await usePublic(360,760);
  console.log('AUDITORIA VISUAL: '+checks+' verificações em Chrome real, sem modificar os dados.');
}catch(error){
  errors++;
  console.error('FALHA DE AUDITORIA VISUAL: '+error.message);
}finally{await browser.close();}
if(errors)process.exitCode=1;