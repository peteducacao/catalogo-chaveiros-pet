// Gerador de ícones do catálogo: mesmo método do PET Gestão (amostragem subpixel).
import fs from 'node:fs';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
const table=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
const u32=n=>Buffer.from([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
function chunk(name,payload){const label=Buffer.from(name);let crc=0xffffffff;for(const b of Buffer.concat([label,payload]))crc=table[(crc^b)&255]^(crc>>>8);return Buffer.concat([u32(payload.length),label,payload,u32((crc^0xffffffff)>>>0)])}
function ellipse(x,y,cx,cy,rx,ry){return ((x-cx)/rx)**2+((y-cy)/ry)**2<=1}
function rounded(x,y,l,t,r,b,rad){const nx=Math.max(l+rad,Math.min(r-rad,x)),ny=Math.max(t+rad,Math.min(b-rad,y));return Math.hypot(x-nx,y-ny)<=rad}
function segment(x,y,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-ax-t*dx,y-ay-t*dy)}
function pixel(x,y,maskable){
 const cream=[252,248,242,255],navy=[9,45,80,255],teal=[0,185,168,255];
 const scale=maskable?.78:1; x=(x-.5)/scale+.5;y=(y-.5)/scale+.5;
 if(!maskable&&!rounded(x,y,0,0,1,1,.219))return [0,0,0,0];
 let c=cream;
 // Bobina vetorial sem texto, preservando as formas em qualquer resolução.
 if(ellipse(x,y,.5,.672,.225,.074))c=navy;
 if(rounded(x,y,.301,.371,.699,.672,.034))c=teal;
 for(const yy of [.445,.515,.585])if(y>=yy-.009&&y<=yy+.009&&x>=.301&&x<=.699)c=navy;
 if(ellipse(x,y,.5,.371,.225,.082))c=navy;
 if(ellipse(x,y,.5,.371,.094,.037))c=cream;
 // Curva única de filamento à direita.
 const points=[[.692,.606],[.758,.58],[.813,.597],[.845,.653],[.831,.715],[.768,.763],[.719,.764]];
 for(let i=1;i<points.length;i++)if(segment(x,y,...points[i-1],...points[i])<.0145)c=teal;
 return c;
}
function generate(size,maskable){
 const raw=Buffer.alloc((size*4+1)*size);
 for(let y=0;y<size;y++){const row=y*(size*4+1);for(let x=0;x<size;x++){const rgba=[0,0,0,0];for(const [sx,sy] of [[.125,.125],[.375,.125],[.625,.125],[.875,.125],[.125,.375],[.375,.375],[.625,.375],[.875,.375],[.125,.625],[.375,.625],[.625,.625],[.875,.625],[.125,.875],[.375,.875],[.625,.875],[.875,.875]]){const sample=pixel((x+sx)/size,(y+sy)/size,maskable);for(let k=0;k<4;k++)rgba[k]+=sample[k]}for(let k=0;k<4;k++)raw[row+1+4*x+k]=Math.round(rgba[k]/16)}}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
export function generatePwaIcons(directory){fs.mkdirSync(directory,{recursive:true});for(const size of [192,512])for(const maskable of [false,true])fs.writeFileSync(path.join(directory,'catalogo-'+(maskable?'maskable-':'')+size+'.png'),generate(size,maskable));fs.writeFileSync(path.join(directory,'catalogo-180.png'),generate(180,false))}
if(process.argv[1]?.endsWith('build-pwa-icons.mjs'))generatePwaIcons('assets');
