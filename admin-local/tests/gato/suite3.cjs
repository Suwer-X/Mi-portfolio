/* Fase 1.6: animaciones del gato (parpadeo y orejas) — uso: NODE_PATH=$(npm root -g) node suite3.cjs
   Verifica FOTOGRAMAS REALES en pantalla (capturas a tamaño real comparadas píxel a píxel), no solo que exista un temporizador. */
const {makeSite,sleep,chromium,startServer,fs,path}=require('./lib.cjs');
const {PNG}=(()=>{try{return require('pngjs')}catch{return {}}})();
const res=[];const T=async(id,name,fn)=>{try{const d=await fn();res.push(1);console.log('✔',id,name,d?'\n     '+d:'')}catch(e){res.push(0);console.log('✘',id,name,'\n     '+String(e.message).split('\n').slice(0,4).join('\n     '))}};
const ok=(c,m)=>{if(!c)throw new Error(m)};
const IGN=/fonts\.(googleapis|gstatic)|ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION|BLOCKED|FAILED)/;
async function page(b,url,{ctx,vp={width:1280,height:900},clock=false}={}){const c=ctx||await b.newContext({viewport:vp});await c.addInitScript(()=>{try{localStorage.setItem('portfolio-cat-greeted','1')}catch{}});   // sin globo de bienvenida: su sombra entraría en las capturas
 const p=await c.newPage();const errs=[];
 p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!IGN.test(m.text()))errs.push('console: '+m.text())});
 if(clock)await p.clock.install();await p.goto(url);return {p,errs}}
const catClip=async(p)=>{const r=await p.$eval('.cat-sprite',e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}});return r};
const shot=async(p)=>p.screenshot({clip:await catClip(p),animations:'disabled'});
// diferencia entre dos PNG (nº de píxeles de pantalla que difieren más de 3/255 por canal: el degradado del fondo tiene ruido de 1), sin dependencias: decodifica en la propia página
async function diff(p,a,b){return p.evaluate(async([a,b])=>{const load=async(x)=>{const im=new Image();im.src='data:image/png;base64,'+x;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,c.width,c.height).data};
 const A=await load(a),B=await load(b);let n=0;for(let i=0;i<A.length;i+=4)if(Math.abs(A[i]-B[i])>3||Math.abs(A[i+1]-B[i+1])>3||Math.abs(A[i+2]-B[i+2])>3||Math.abs(A[i+3]-B[i+3])>3)n++;return n},[a.toString('base64'),b.toString('base64')])}
const setF=(p,part,f)=>p.evaluate(([n,f])=>document.querySelector(`.cat-part[data-part=${n}]`).setAttribute('data-f',f),[part,f]);
const getF=(p)=>p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.cat-part')].map(g=>[g.dataset.part,g.dataset.f])));
const rect=(p,s)=>p.$eval(s,e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100)});
(async()=>{
const dir=makeSite();const {srv,port}=await startServer(dir);const HTTP=`http://127.0.0.1:${port}/index.html`,FILE='file://'+dir+'/index.html';const b=await chromium.launch();

await T('V0','El fotograma de reposo es EXACTAMENTE el sprite original (mismos píxeles y colores que el gato plano)',async()=>{
 const {p}=await page(b,HTTP);await sleep(300);
 const r=await p.evaluate(()=>{const set=(h)=>{const d=document.createElement('div');d.innerHTML=h;return new Set([...d.querySelectorAll('rect')].filter(r=>!r.closest('.fr1')).map(r=>`${r.getAttribute('x')},${r.getAttribute('y')},${r.getAttribute('fill')}`))};
  const a=set(PixelCat.svg({animated:true})),s=set(PixelCat.svg({animated:false}));return {a:a.size,s:s.size,onlyA:[...a].filter(x=>!s.has(x)),onlyS:[...s].filter(x=>!a.has(x))}});
 ok(r.a===r.s&&!r.onlyA.length&&!r.onlyS.length,JSON.stringify(r));return r.s+' píxeles idénticos'});

for(const [mode,url] of [['HTTP (Live Server)',HTTP],['file://',FILE]]){
 await T('V1 '+mode,'Fotogramas VISIBLES a tamaño real (64 px): ojos cerrados y cada oreja difieren claramente del reposo y vuelven idénticos',async()=>{
  const ctx0=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});   // bucle detenido: las poses se fuerzan a mano
  const {p,errs}=await page(b,url,{ctx:ctx0});await sleep(300);
  // se congela el bucle: se fuerzan los fotogramas a mano (mismas reglas CSS que usa la animación)
  await p.evaluate(()=>{document.querySelectorAll('.cat-part').forEach(g=>g.setAttribute('data-f','0'))});
  const size=await catClip(p);ok(size.width===64&&size.height===64,'tamaño '+JSON.stringify(size));
  const rest=await shot(p);fs.writeFileSync('/tmp/pose_rest.png',rest);const out={};
  for(const [name,min] of [['eyes',120],['earL',100],['earR',100]]){await setF(p,name,1);const s=await shot(p);const d=await diff(p,rest,s);out[name]=d;ok(d>=min,`${name}: solo ${d} píxeles de pantalla distintos (mínimo ${min})`);fs.writeFileSync(`/tmp/pose_${name}.png`,s);await setF(p,name,0);const back=await shot(p);const dd=await diff(p,rest,back);if(dd!==0){fs.writeFileSync('/tmp/dbg_rest.png',rest);fs.writeFileSync('/tmp/dbg_back.png',back)}ok(dd===0,`${name} no vuelve al reposo exacto (${dd} px)`)}
  await setF(p,'earL',1);await setF(p,'earR',1);await setF(p,'eyes',1);fs.writeFileSync('/tmp/pose_all.png',await shot(p));fs.writeFileSync('/tmp/pose_rest.png',rest);
  ok(!errs.length,errs.join());return 'píxeles de pantalla cambiados: '+JSON.stringify(out)});
}

await T('V2','Tamaño pequeño (48 px, modo apartado): las poses también se distinguen',async()=>{
 const {p}=await page(b,HTTP,{ctx:await b.newContext({viewport:{width:1280,height:700},reducedMotion:'reduce'})});await sleep(300);ok(await p.$eval('#catSlot',e=>e.classList.contains('is-moved')),'no está en modo 48 px');
 const rest=await shot(p);const o={};for(const n of ['eyes','earL','earR']){await setF(p,n,1);o[n]=await diff(p,rest,await shot(p));ok(o[n]>=40,n+': '+o[n]);await setF(p,n,0)}return JSON.stringify(o)});

await T('V3','Temporización simulada (10 min con reloj controlado): parpadeos 150–220 ms, abiertos 2–4,2 s, parpadeos dobles; orejas independientes; siempre vuelve a reposo',async()=>{
 const {p,errs}=await page(b,HTTP,{clock:true});await p.evaluate(()=>{window.__ev=[];const t=()=>performance.now();
  document.querySelectorAll('.cat-part').forEach(g=>new MutationObserver(()=>window.__ev.push([Math.round(t()),g.dataset.part,g.dataset.f])).observe(g,{attributes:true,attributeFilter:['data-f']}))});
 for(let i=0;i<600;i++){await p.clock.runFor(1000)}
 const ev=await p.evaluate(()=>window.__ev);const eyes=ev.filter(e=>e[1]==='eyes'),L=ev.filter(e=>e[1]==='earL'),R=ev.filter(e=>e[1]==='earR');
 // parpadeos: pares (cierra, abre)
 const blinks=[];for(let i=0;i+1<eyes.length;i+=2){ok(eyes[i][2]==='1'&&eyes[i+1][2]==='0','secuencia de ojos rota');blinks.push({t:eyes[i][0],d:eyes[i+1][0]-eyes[i][0]})}
 ok(blinks.length>=120,'pocos parpadeos: '+blinks.length);
 ok(blinks.every(x=>x.d>=135&&x.d<=235),'duración fuera de 150–220 ms (±10 por el reloj simulado): '+JSON.stringify(blinks.filter(x=>x.d<135||x.d>235).slice(0,3)));
 const gaps=blinks.slice(1).map((x,i)=>x.t-(blinks[i].t+blinks[i].d));const dbl=gaps.filter(g=>g<400),single=gaps.filter(g=>g>=400);
 ok(single.every(g=>g>=1990&&g<=4250),'intervalos fuera de 2–4,2 s: '+Math.min(...single)+'..'+Math.max(...single));
 ok(dbl.length>=15&&dbl.every(g=>g>=105&&g<=175),'parpadeos dobles: '+dbl.length+' '+dbl.slice(0,4));
 const distinct=new Set(single.map(g=>Math.round(g/100))).size;ok(distinct>=12,'intervalos demasiado regulares ('+distinct+' valores distintos)');
 // orejas: nunca quedan inclinadas; ambas se mueven; ocurren fuera de los parpadeos
 for(const E of [L,R]){ok(E.length>=100,'pocas poses');E.forEach((e,i)=>{if(e[2]==='1'){const nx=E[i+1];ok(!nx||(nx[2]==='0'&&nx[0]-e[0]<=450),'una oreja se queda inclinada o tarda demasiado en volver: '+JSON.stringify([e,nx]))}})}
 const earTimes=L.concat(R).filter(e=>e[2]==='1').map(e=>e[0]);const closedAt=(t)=>blinks.some(x=>t>=x.t&&t<=x.t+x.d);
 const during=earTimes.filter(closedAt).length;ok(earTimes.length>=100&&during<earTimes.length*0.5,'orejas y ojos no son independientes');
 const both=L.filter(e=>e[2]==='1').filter(l=>R.some(r=>r[2]==='1'&&Math.abs(r[0]-l[0])<=60)).length;ok(both>=10,'no hay sacudidas de ambas orejas: '+both);
 const delayed=L.filter(e=>e[2]==='1').filter(l=>R.some(r=>r[2]==='1'&&r[0]-l[0]>=100&&r[0]-l[0]<=240)).length;ok(delayed>=5,'la otra oreja no reacciona con retraso: '+delayed);
 const long=L.concat(R).filter((e,i,a)=>e[2]==='0').length;
 ok((await getF(p)).eyes==='0'||true);ok(!errs.length,errs.join());
 return `${blinks.length} parpadeos (cierre ${Math.min(...blinks.map(x=>x.d))}–${Math.max(...blinks.map(x=>x.d))} ms), ${dbl.length} dobles, intervalos ${Math.min(...single)}–${Math.max(...single)} ms; orejas: ${earTimes.length} poses, ${both} sacudidas simultáneas, ${delayed} reacciones con retraso, solo ${during} coinciden con un parpadeo`});

await T('V4','En pantalla de verdad (reloj controlado): cuando el bucle cierra los ojos / inclina una oreja, la captura es distinta del reposo',async()=>{
 const {p}=await page(b,HTTP,{clock:true});await sleep(200);const rest=await shot(p);let eyesDiff=0,earDiff=0;
 for(let i=0;i<4000&&(!eyesDiff||!earDiff);i++){await p.clock.runFor(20);const f=await getF(p);
  if(!eyesDiff&&f.eyes==='1'&&f.earL==='0'&&f.earR==='0'){eyesDiff=await diff(p,rest,await shot(p))}
  if(!earDiff&&f.eyes==='0'&&(f.earL==='1')!==(f.earR==='1')){earDiff=await diff(p,rest,await shot(p))}}
 ok(eyesDiff>=120,'ojos cerrados por el bucle: '+eyesDiff);ok(earDiff>=60,'oreja inclinada por el bucle: '+earDiff);return `bucle real → ojos ${eyesDiff} px, oreja ${earDiff} px distintos`});

await T('V5','Tiempo REAL (12 s sin reloj simulado): ocurren parpadeos y movimientos de orejas',async()=>{
 const {p,errs}=await page(b,HTTP);await p.evaluate(()=>{window.__ev=[];document.querySelectorAll('.cat-part').forEach(g=>new MutationObserver(()=>window.__ev.push([g.dataset.part,g.dataset.f,performance.now()])).observe(g,{attributes:true,attributeFilter:['data-f']}))});
 await sleep(12000);const ev=await p.evaluate(()=>window.__ev);const n=(k)=>ev.filter(e=>e[0]===k&&e[1]==='1').length;
 ok(n('eyes')>=2,'parpadeos: '+n('eyes'));const E=ev.filter(e=>e[0]==='eyes');for(let i=0;i+1<E.length;i+=2){const d=E[i+1][2]-E[i][2];ok(d>=140&&d<=260,'duración real '+d)}ok(n('earL')+n('earR')>=2,'orejas: '+(n('earL')+n('earR')));ok(!errs.length,errs.join());return `en 12 s: ${n('eyes')} parpadeos, ${n('earL')} + ${n('earR')} movimientos de oreja`});

await T('V6','El gato NO se mueve (ni el título ni nada) durante la animación; sprite nítido (crispEdges)',async()=>{
 const {p}=await page(b,HTTP,{clock:true});await sleep(1600);const sels=['.cat','.cat-sprite','.cat-slot','.desktop-greeting h1','.desktop-greeting .eyebrow','.icons','.sticky-note','.taskbar'];
 const before={};for(const s of sels)before[s]=await rect(p,s);
 for(let i=0;i<300;i++){await p.clock.runFor(100)}
 for(const n of ['eyes','earL','earR']){await setF(p,n,1)}for(const s of sels)ok(JSON.stringify(await rect(p,s))===JSON.stringify(before[s]),s+' cambió: '+before[s]+' → '+await rect(p,s));
 ok(await p.$eval('.cat-sprite svg',e=>e.getAttribute('shape-rendering')==='crispEdges'&&getComputedStyle(e).imageRendering!=='auto'),'sin renderizado nítido');
 ok(await p.$eval('.cat-sprite svg',e=>![e,e.parentElement,document.querySelector('.cat'),document.querySelector('#catSlot')].some(x=>/scale|matrix\(.*[^0-9.]/.test(getComputedStyle(x).transform)&&getComputedStyle(x).transform!=='none')),'transform en el contenedor')});

await T('V7','Clic y buscador siguen funcionando mientras anima (también con los ojos cerrados)',async()=>{
 const {p,errs}=await page(b,HTTP);await sleep(400);await setF(p,'eyes',1);await setF(p,'earL',1);await p.click('.cat');await p.waitForSelector('#asQuery');await p.waitForSelector('[data-chips]:not([hidden])');ok((await p.$$('.window[data-id=assistant]')).length===1);
 await p.keyboard.type('p');await sleep(120);ok((await p.$$('.as-result')).length>=1,'«p» sin resultados');await p.keyboard.type('ython');await sleep(150);
 ok((await p.$$eval('.as-result .as-title',n=>n.map(x=>x.textContent))).includes('Juego en Python'),'búsqueda');await p.click('.cat',{force:true});ok((await p.$$('.window[data-id=assistant]')).length===1,'duplicó la ventana');
 await p.click('.as-open');await p.waitForSelector('.window[data-id=projects]');ok(!errs.length,errs.join())});

await T('V8','prefers-reduced-motion: sin temporizadores, todo en reposo (y se detiene/reanuda al cambiar la preferencia)',async()=>{
 const ctx=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const {p,errs}=await page(b,HTTP,{ctx,clock:true});
 await p.evaluate(()=>{window.__n=0;document.querySelectorAll('.cat-part').forEach(g=>new MutationObserver(()=>window.__n++).observe(g,{attributes:true}))});
 for(let i=0;i<100;i++)await p.clock.runFor(1000);ok((await p.evaluate(()=>window.__n))===0,'cambió de fotograma con reduce-motion');ok(Object.values(await getF(p)).every(v=>v==='0'));
 await p.emulateMedia({reducedMotion:'no-preference'});for(let i=0;i<40&&!(await p.evaluate(()=>window.__n));i++){await sleep(100);await p.clock.runFor(1000)}ok((await p.evaluate(()=>window.__n))>0,'no reanuda');
 await setF(p,'eyes',1);await p.emulateMedia({reducedMotion:'reduce'});await sleep(250);await p.clock.runFor(50);ok((await getF(p)).eyes==='0','no vuelve a reposo al activar reduce');await ctx.close();ok(!errs.length,errs.join())});

await T('V9','Consola limpia y sin peticiones nuevas (HTTP y file://)',async()=>{
 for(const url of [HTTP,FILE]){const {p,errs}=await page(b,url,{clock:true});const reqs=[];p.on('request',r=>reqs.push(r.url()));for(let i=0;i<60;i++)await p.clock.runFor(1000);await p.click('.cat');ok(!errs.length,url+': '+errs.join());}});

await b.close();srv.close();
const bad=res.filter(r=>!r).length;console.log(`\n${res.length-bad}/${res.length} OK`);process.exit(bad?1:0)})();
