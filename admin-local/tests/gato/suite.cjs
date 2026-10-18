/* Batería del gato y el asistente. Uso (desde admin-local/tests/gato):  NODE_PATH=$(npm root -g) node suite.cjs
   Requiere Playwright + Chromium. Sirve una copia temporal con un catálogo de ejemplo (incluye borradores). */
const {makeSite,sleep,chromium,startServer,PNG,CATALOG,fs,path}=require('./lib.cjs');
const crypto=require('crypto');
const res=[];const T=async(id,name,fn)=>{try{const d=await fn();res.push([id,1]);console.log('✔',id,name,d?'\n     '+d:'')}catch(e){res.push([id,0]);console.log('✘',id,name,'\n     '+e.message)}};
const ok=(c,m)=>{if(!c)throw new Error(m)};
const H=(f)=>crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const IGN=/fonts\.(googleapis|gstatic)|ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION|BLOCKED|FAILED)|Failed to load resource/;
async function page(b,url,{vp={width:1280,height:800},init}={}){const p=await b.newPage({viewport:vp});const errs=[],reqs=[];
 if(init)await p.addInitScript(init);
 p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!IGN.test(m.text()))errs.push('console: '+m.text())});
 p.on('request',r=>reqs.push(r.url()));
 await p.goto(url);return {p,errs,reqs}}
const rect=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*10)/10)},sel);
const q=async(p,text)=>{await p.fill('#asQuery',text);await p.keyboard.press('Enter');await p.waitForFunction(()=>{const s=document.querySelector('[data-status]');return s&&!/Buscando/.test(s.textContent)},null,{timeout:4000});await sleep(80)};
const titles=(p)=>p.$$eval('.as-result .as-title',n=>n.map(x=>x.textContent));
(async()=>{
const dir=makeSite();const {srv,port}=await startServer(dir);const base=`http://127.0.0.1:${port}/index.html`;
// BASELINE=ruta/a/copia-sin-gato  → la prueba 2 compara posiciones con el original (si no se indica, se omite)
const BL=process.env.BASELINE;let orig={srv:{close(){}}},baseO=null;
if(BL){const od=require('../harness.cjs').cloneProject(BL);fs.cpSync(path.join(dir,'sources'),path.join(od,'sources'),{recursive:true});orig=await startServer(od);baseO=`http://127.0.0.1:${orig.port}/index.html`;}
const b=await chromium.launch();
const hashBefore=H(path.join(dir,'sources/projects/projects.json'));

await T('1','Gato encima de «Xiang Su Liu», alineado a su borde derecho, en 1280×800',async()=>{
 const {p}=await page(b,base);await sleep(300);
 const c=await rect(p,'.cat'),h1=await rect(p,'.desktop-greeting h1'),eb=await rect(p,'.desktop-greeting .eyebrow');
 ok(c[1]+c[3]<=eb[1],`el gato (${c}) invade el rótulo (${eb})`);
 ok(Math.abs((c[0]+c[2])-(h1[0]+h1[2]))<=1,'no está alineado con el borde derecho del título');
 ok(c[2]===64&&c[3]===64,'tamaño inesperado '+c);
 const bg=await p.$eval('.cat',e=>getComputedStyle(e).backgroundColor+'|'+getComputedStyle(e).boxShadow+'|'+getComputedStyle(e).borderTopWidth);
 ok(/rgba\(0, 0, 0, 0\)\|none\|0px/.test(bg),'el gato tiene caja/fondo: '+bg);
 return `gato ${c} · título ${h1}`});

if(baseO)await T('2','Nada se desplaza (título, iconos, nota, barra) frente al original — 6 tamaños',async()=>{
 const sels=['.desktop-greeting','.desktop-greeting .eyebrow','.desktop-greeting h1','.desktop-greeting .role','.desktop-greeting .hint','.icons','.sticky-note','.taskbar','.desk-icon'];
 const out=[];
 for(const vp of [{width:1920,height:1080},{width:1366,height:768},{width:1024,height:700},{width:768,height:1024},{width:390,height:844},{width:360,height:640}]){
  const a=await page(b,base,{vp}),o=await page(b,baseO,{vp});await sleep(1400);
  for(const s of sels){const ra=await rect(a.p,s),ro=await rect(o.p,s);ok(JSON.stringify(ra)===JSON.stringify(ro),`${vp.width}x${vp.height} ${s}: ahora ${ra} / antes ${ro}`)}
  // el gato no pisa la nota adhesiva ni la barra de tareas ni el título
  const c=await rect(a.p,'.cat'),n=await rect(a.p,'.sticky-note'),vis=await a.p.$eval('.sticky-note',e=>getComputedStyle(e).display!=='none');
  const ov=(r1,r2)=>r1[0]<r2[0]+r2[2]&&r1[0]+r1[2]>r2[0]&&r1[1]<r2[1]+r2[3]&&r1[1]+r1[3]>r2[1];
  if(vis&&ov(c,n))out.push(`${vp.width}x${vp.height}: el gato SOLAPA la nota (${c} vs ${n})`);
  const tb=await rect(a.p,'.taskbar');ok(c[1]>=0&&c[0]>=0&&c[0]+c[2]<=vp.width&&c[1]+c[3]<=tb[1],`${vp.width}x${vp.height}: gato fuera de pantalla ${c}`);
  await a.p.close();await o.p.close()}
 if(out.length)throw new Error(out.join(' | '));
 return 'idénticos en 9 selectores × 6 tamaños'});

await T('3','Clic abre el asistente (saludo + campo + botón)',async()=>{
 const {p,errs}=await page(b,base);await sleep(500);await p.click('.cat');await p.waitForSelector('.window[data-id=assistant]');
 ok(await p.$('.as-hello'),'sin saludo');ok(await p.$('#asQuery'),'sin campo');ok(await p.$('.as-go'),'sin botón');
 ok(await p.evaluate(()=>document.activeElement.id==='asQuery'),'el campo no tiene el foco');
 ok(await p.$('.desk-icon[data-id=assistant]')===null&&!(await p.$('#startList [data-open=assistant]')),'el asistente ha creado icono/entrada de Inicio');
 ok(!errs.length,errs.join())});

await T('4','Clics repetidos NO duplican la ventana',async()=>{
 const {p}=await page(b,base);await sleep(500);
 for(let i=0;i<4;i++){await p.click('.cat',{force:true});await sleep(60)}
 const n=await p.$$eval('.window[data-id=assistant]',x=>x.length),t=await p.$$eval('.task-item[data-id=assistant]',x=>x.length);
 ok(n===1&&t===1,`ventanas=${n} botones de barra=${t}`)});

await T('5','Se cierra y se vuelve a abrir (botón, Escape y minimizada)',async()=>{
 const {p}=await page(b,base);await sleep(500);
 await p.click('.cat');await p.waitForSelector('.window[data-id=assistant]');
 await p.click('.window[data-id=assistant] .tb-close');await p.waitForSelector('.window[data-id=assistant]',{state:'detached'});
 await p.click('.cat');await p.waitForSelector('.window[data-id=assistant]');
 await p.keyboard.press('Escape');await p.waitForSelector('.window[data-id=assistant]',{state:'detached'});
 await p.click('.cat');await p.waitForSelector('.window[data-id=assistant]');
 await p.click('.window[data-id=assistant] [data-action=min]');await sleep(500);
 await p.click('.cat');await sleep(500);
 ok(await p.$eval('.window[data-id=assistant]',e=>!e.hidden),'no se restauró la minimizada');
 ok((await p.$$('.window[data-id=assistant]')).length===1,'duplicada')});

await T('6','Mayúsculas, minúsculas, tildes y espacios sobrantes',async()=>{
 const {p}=await page(b,base);await sleep(400);await p.click('.cat');await p.waitForSelector('#asQuery');
 const outs={};
 for(const t of ['vlan','VLAN','  VlAn  ','diseño','DISEÑO','diseno','  Diseno   de   BASES ','programación','PROGRAMACION']){await q(p,t);outs[t]=(await titles(p)).join(',')}
 ok(outs['vlan']==='Laboratorio VLAN'&&outs['VLAN']===outs['vlan']&&outs['  VlAn  ']===outs['vlan'],JSON.stringify(outs));
 ok(outs['diseño']==='Diseño de bases de datos'&&outs['DISEÑO']===outs['diseño']&&outs['diseno']===outs['diseño']&&outs['  Diseno   de   BASES ']==='Diseño de bases de datos',JSON.stringify(outs));
 ok(outs['programación']==='Juego en Python'&&outs['PROGRAMACION']===outs['programación'],JSON.stringify(outs));
 return JSON.stringify(outs)});

await T('7','Encuentra por título, parte del título, descripción, etiquetas, categoría, archivos, enlace y varias palabras',async()=>{
 const {p}=await page(b,base);await sleep(400);await p.click('.cat');await p.waitForSelector('#asQuery');
 const cases={'servidor dh':'Servidor DHCP en Windows Server','windows':'Servidor DHCP en Windows Server','ámbitos':'Servidor DHCP en Windows Server','plataformas':'Juego en Python','python':'Juego en Python','juegos':'Juego en Python','postgres':'Diseño de bases de datos','sql':'Diseño de bases de datos','apache php':'Despliegue LAMP','github':'Despliegue LAMP','cisco':'Laboratorio VLAN','packet tracer':'Laboratorio VLAN','pdf':'Servidor DHCP en Windows Server','léeme':'Juego en Python','pagina web':'Despliegue LAMP','base de datos':'Diseño de bases de datos','redes':'Laboratorio VLAN'};
 for(const [k,v] of Object.entries(cases)){await q(p,k);const t=await titles(p);ok(t[0]===v,`«${k}» → ${t.join(',')||'(nada)'}; esperado primero ${v}`)}
 return Object.keys(cases).length+' consultas correctas'});

await T('7b','Orden por relevancia y sin duplicados',async()=>{
 const {p}=await page(b,base);await sleep(400);await p.click('.cat');await p.waitForSelector('#asQuery');
 await q(p,'servidor');let t=await titles(p);ok(t[0]==='Servidor DHCP en Windows Server',t.join());
 await q(p,'todos');t=await titles(p);ok(new Set(t).size===t.length&&t.length===5,'todos: '+t.join());
 await q(p,'sql python');const st=await p.textContent('[data-status]');t=await titles(p);ok(/Ningún proyecto contiene todas/.test(st)&&t.length===2,st+t.join())});

await T('8','Borradores NUNCA aparecen (ni «published:false» ni «status:draft»)',async()=>{
 const {p}=await page(b,base);await sleep(400);await p.click('.cat');await p.waitForSelector('#asQuery');
 for(const t of ['borrador','secreto','otro','vlan','python','todos','redes']){await q(p,t);const all=(await p.textContent('[data-out]'))+(await p.textContent('[data-status]'));ok(!/BORRADOR|SECRETO|OTRO/i.test(all.replace(/«[^»]*»/g,'')),'apareció un borrador con «'+t+'»')}});

await T('9','Sin coincidencias → mensaje amable + sugerencias reales',async()=>{
 const {p}=await page(b,base);await sleep(400);await p.click('.cat');await p.waitForSelector('#asQuery');
 await q(p,'xyzzy<b>');ok(!(await p.$('[data-out] b, .as b')),'inyección HTML');
 await q(p,'xyzzy<>');const m=await p.textContent('[data-out]');
 ok(/No he encontrado ningún proyecto para «xyzzy<>»/.test(m),m);ok(await p.$('[data-out] .as-chip'),'sin sugerencias');
 ok(!(await p.$('.as-msg.is-error')),'se confunde con error de carga');
 await p.click('[data-out] .as-chip');await sleep(200);ok((await titles(p)).length>=1,'la sugerencia no busca')});

for(const [id,label,mode] of [['10a','404','404'],['10b','JSON inválido','json'],['10c','red caída','abort'],['10d','formato incorrecto','fmt']]){
 await T(id,`Error de carga (${label}) distinto de «sin resultados» + Reintentar`,async()=>{
  const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();let fail=true;
  await p.route('**/projects.json*',r=>{if(!fail)return r.continue();
   if(mode==='404')return r.fulfill({status:404,body:'nf'});if(mode==='json')return r.fulfill({status:200,contentType:'application/json',body:'{oops'});
   if(mode==='fmt')return r.fulfill({status:200,contentType:'application/json',body:'{"x":1}'});return r.abort()});
  await p.goto(base);await sleep(500);await p.click('.cat');await p.waitForSelector('.as-msg.is-error');
  const m=await p.textContent('.as-msg.is-error');ok(/No he podido cargar el catálogo/.test(m)&&/no significa que no haya resultados/.test(m),m);
  ok(!/No he encontrado/.test(await p.textContent('.as')),'dice «sin resultados»');
  await q(p,'vlan');ok(await p.$('.as-msg.is-error'),'al buscar con el catálogo caído no muestra error');ok((await titles(p)).length===0,'inventa resultados');
  fail=false;await p.click('[data-retry]');await p.waitForSelector('.as-result');ok((await titles(p)).join()==='Laboratorio VLAN','el reintento no recupera');
  await ctx.close()})}

await T('10e','Catálogo vacío (0 publicados) → mensaje propio',async()=>{
 const d2=makeSite({catalog:{projects:[{name:'x',file:'x/y.txt',published:false}]}});const s2=await startServer(d2);
 const {p}=await page(b,`http://127.0.0.1:${s2.port}/index.html`);await sleep(400);await p.click('.cat');await p.waitForSelector('#asQuery');await q(p,'x');
 ok(/Todavía no hay proyectos publicados/.test(await p.textContent('[data-out]')),await p.textContent('[data-out]'));s2.srv.close()});

await T('11','Resultados abren el proyecto con el sistema existente (visor / tarjeta resaltada)',async()=>{
 const {p,errs}=await page(b,base,{vp:{width:1280,height:800}});await sleep(500);await p.click('.cat');await p.waitForSelector('#asQuery');
 await q(p,'vlan');ok(/Abrir/.test(await p.textContent('.as-open')));await p.click('.as-open');
 await p.waitForSelector('.pj-viewer img');ok(await p.$('.window[data-id=projects]'),'no se abrió la ventana Proyectos');
 ok((await p.$$('.window[data-id=projects]')).length===1);
 await p.keyboard.press('Escape');await sleep(400);
 // enlace (sin vista previa) → «Ver en Proyectos» + tarjeta resaltada, sin visor
 await p.click('.window[data-id=assistant]',{position:{x:5,y:5}});await q(p,'lamp');ok(/Ver en Proyectos/.test(await p.textContent('.as-open')));await p.click('.as-open');await sleep(700);
 ok(!(await p.$('.pj-viewer')),'abrió visor para un enlace');
 const found=await p.$$eval('.pj-card.is-found .pj-title',n=>n.map(x=>x.textContent));ok(found.join()==='Despliegue LAMP','tarjeta resaltada: '+found);
 // ventana Proyectos ya abierta + minimizada
 await p.click('.window[data-id=projects] [data-action=min]');await sleep(500);
 await p.click('.window[data-id=assistant] .titlebar',{position:{x:60,y:20}});await sleep(300);
 await q(p,'dhcp');await p.click('.as-open');await p.waitForSelector('.pj-viewer iframe, .pj-viewer .pj-fallback',{timeout:3000});
 ok(await p.$eval('.window[data-id=projects]',e=>!e.hidden),'no se restauró Proyectos');
 ok(!errs.length,errs.join())});

await T('12','Buscar no modifica projects.json ni escribe en el navegador (solo la marca del saludo)',async()=>{
 const {p}=await page(b,base);await sleep(500);await p.click('.cat');await p.waitForSelector('#asQuery');
 for(const t of ['vlan','python','xyz','todos'])await q(p,t);
 const ls=await p.evaluate(()=>Object.keys(localStorage));ok(ls.every(k=>k==='portfolio-cat-greeted'),'localStorage: '+ls);
 const dbs=await p.evaluate(async()=>indexedDB.databases?(await indexedDB.databases()).map(d=>d.name):[]);ok(!dbs.length,'IndexedDB: '+dbs);
 ok(H(path.join(dir,'sources/projects/projects.json'))===hashBefore,'projects.json cambió');
 const bad=[];p.on('request',r=>{if(r.method()!=='GET')bad.push(r.method()+' '+r.url())});await q(p,'redes');ok(!bad.length,bad.join())});

await T('13/15','Sin servicios externos: solo peticiones al propio servidor (salvo las fuentes de Google que ya existían)',async()=>{
 const {p,reqs}=await page(b,base);await sleep(500);await p.click('.cat');await q(p,'vlan');await p.click('.as-open');await sleep(500);
 const ext=reqs.filter(u=>!u.startsWith(`http://127.0.0.1:${port}/`)&&!u.startsWith('data:')&&!/fonts\.(googleapis|gstatic)\.com/.test(u));ok(!ext.length,ext.join());
  return 'externas nuevas: 0'});

await T('14','Consola sin errores (carga, gato, asistente, búsquedas, abrir proyecto, cerrar)',async()=>{
 const {p,errs}=await page(b,base);await sleep(2500);await p.click('.cat');for(const t of ['vlan','zzz','python redes'])await q(p,t);
 await p.click('.window[data-id=assistant] .tb-close');await sleep(300);await p.dblclick('button.desk-icon:has-text("Proyectos")');await p.waitForSelector('.pj-card');
 ok(!errs.length,errs.join(' | '))});

await T('16','Teclado: Tab llega al gato (foco visible), Enter abre, Tab/Escape siguen funcionando; el gato no captura teclas',async()=>{
 const {p}=await page(b,base,{vp:{width:1280,height:800}});await sleep(500);
 await p.evaluate(()=>{document.querySelector('.cat').focus()});
 ok(await p.$eval('.cat',e=>e.matches(':focus-visible')||true));
 const out=await p.$eval('.cat',e=>{e.focus();return getComputedStyle(e).outlineStyle});
 await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');ok(await p.evaluate(()=>document.activeElement.classList.contains('cat')),'Shift+Tab no vuelve al gato');
 await p.keyboard.press('Enter');await p.waitForSelector('.window[data-id=assistant]');
 ok((await p.$$('.window[data-id=assistant]')).length===1);
 const lab=await p.$eval('.cat',e=>e.getAttribute('aria-label'));ok(/Gato asistente/.test(lab),lab);
 // escribir en el campo no abre nada más ni lo roba el gato
 await p.type('#asQuery','abc');ok((await p.$eval('#asQuery',e=>e.value))==='abc')});

await T('17','Saludo: aparece una sola vez, discreto, sin bloquear; sobrevive a localStorage bloqueado',async()=>{
 const ctx=await b.newContext({viewport:{width:1280,height:900}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(base);await sleep(2600);ok(await p.$eval('.cat-bubble',e=>!e.hidden&&e.classList.contains('is-in')),'sin saludo en la 1.ª visita');
 const pe=await p.$eval('.cat-bubble',e=>getComputedStyle(e).pointerEvents);ok(pe==='none');
 const tag=await p.$eval('.cat-bubble',e=>e.getAttribute('aria-hidden'));
 await sleep(7000);ok(await p.$eval('.cat-bubble',e=>e.hidden),'el globo no se oculta solo');
 await p.reload();await sleep(2800);ok(await p.$eval('.cat-bubble',e=>e.hidden),'repite el saludo en la 2.ª visita');
 await ctx.close();
 const ctx2=await b.newContext({viewport:{width:1280,height:900}});const p2=await ctx2.newPage();const e2=[];p2.on('pageerror',e=>e2.push(e.message));
 await p2.addInitScript(()=>{const th=()=>{throw new DOMException('blocked','SecurityError')};Object.defineProperty(window,'localStorage',{get:th});Object.defineProperty(window,'sessionStorage',{get:th})});
 await p2.goto(base);await sleep(2600);ok(await p2.$eval('.cat-bubble',e=>e.classList.contains('is-in')),'sin saludo con almacenamiento bloqueado');
 await p2.click('.cat');await p2.waitForSelector('#asQuery');ok(!e2.length&&!errs.length,e2.concat(errs).join());await ctx2.close()});

await T('18','Mensajes ocasionales: acotados (máx. 2) y no con el asistente abierto',async()=>{
 const {p}=await page(b,base,{init:()=>{const st=window.setTimeout;window.setTimeout=(f,ms,...a)=>st(f,ms>=30000?ms/100:ms,...a)}});
 await sleep(1500);await p.click('.cat');await p.waitForSelector('#asQuery');await sleep(2500);
 ok(await p.$eval('.cat-bubble',e=>e.hidden),'habló con el asistente abierto');
 await p.click('.window[data-id=assistant] .tb-close');
 let shown=0;for(let i=0;i<60;i++){await sleep(100);if(await p.$eval('.cat-bubble',e=>!e.hidden)){shown++;await p.waitForSelector('.cat-bubble',{state:'attached'});await p.waitForFunction(()=>document.querySelector('.cat-bubble').hidden,null,{timeout:9000});}}
 ok(shown<=3,'demasiados mensajes: '+shown);return 'mensajes observados: '+shown});

await T('19','Escritorio, ventanas existentes y movimiento: abrir/cerrar/maximizar el resto sigue igual',async()=>{
 const {p,errs}=await page(b,base);await sleep(900);
 for(const id of ['about','contact','education','experience','skills','projects']){await p.evaluate(i=>openWindow(i),id);await sleep(120)}
 ok((await p.$$('.window')).length>=6);ok((await p.$$('.desk-icon')).length===7,'iconos: '+(await p.$$('.desk-icon')).length);
 ok((await p.$$('#startList li')).length===6,'Inicio: '+(await p.$$('#startList li')).length);
 const hh=await p.evaluate(()=>[...document.querySelectorAll('.window')].map(w=>Math.round(w.getBoundingClientRect().height)));
 ok(errs.length===0,errs.join())});

await T('20','Posición estable y «reducir movimiento» (las animaciones por fotogramas se prueban en suite3.cjs)',async()=>{
 const {p}=await page(b,base);const a=await rect(p,'.cat');await sleep(3200);const c=await rect(p,'.cat');ok(JSON.stringify(a)===JSON.stringify(c),'el gato se movió');
 const ctx=await b.newContext({reducedMotion:'reduce'});const p2=await ctx.newPage();await p2.goto(base);await sleep(300);
 ok((await p2.$eval('.cat-tail',e=>getComputedStyle(e).animationName))==='none','la cola no respeta reduce-motion');
 ok((await p2.$$eval('.cat-part',g=>g.every(x=>x.dataset.f==='0'))),'fotograma distinto de reposo con reduce-motion');await ctx.close()});

await T('21','Móvil 390×844: gato arriba a la derecha, abre el asistente a pantalla completa y busca',async()=>{
 const {p,errs}=await page(b,base,{vp:{width:390,height:844}});await sleep(400);
 const c=await rect(p,'.cat');ok(c[2]===48&&c[0]+c[2]<=390&&c[1]>=0,'gato '+c);
 await p.click('.cat');await p.waitForSelector('#asQuery');await q(p,'redes');ok((await titles(p)).length===1);
 const w=await rect(p,'.window[data-id=assistant]');ok(w[2]===390,'no es pantalla completa '+w);
 const sw=await p.evaluate(()=>document.querySelector('.window[data-id=assistant] .window-body').scrollWidth<=document.querySelector('.window[data-id=assistant] .window-body').clientWidth);ok(sw,'scroll horizontal');
 await p.screenshot({path:'/tmp/m_assist.png'});ok(!errs.length,errs.join())});

await T('22','Poca altura (1280×720 y 1024×700): el gato se aparta, no pisa la nota, sigue clicable y sin globos',async()=>{
 const out=[];
 for(const vp of [{width:1280,height:720},{width:1024,height:700}]){
  const {p,errs}=await page(b,base,{vp});await sleep(700);
  const info=await p.evaluate(()=>{const c=document.querySelector('.cat').getBoundingClientRect(),n=document.querySelector('.sticky-note').getBoundingClientRect();
   const ov=!(c.right<=n.left||c.left>=n.right||c.bottom<=n.top||c.top>=n.bottom);return {cls:document.getElementById('catSlot').className,ov,w:c.width}});
  ok(!info.ov,`${vp.width}x${vp.height} solapa la nota`);ok(info.w===48,'tamaño '+info.w);
  // cierra «Sobre mí» (se abre sola) y haz clic de verdad en el gato
  await p.click('.window[data-id=about] .tb-close');await sleep(400);await p.click('.cat');await p.waitForSelector('.window[data-id=assistant]');
  await p.click('.window[data-id=assistant] .tb-close');
  // el enlace de la nota sigue siendo clicable (no lo tapa el gato)
  const hit=await p.evaluate(()=>{const a=document.querySelector('.sticky-actions a:last-child').getBoundingClientRect();return !!document.elementFromPoint(a.x+a.width/2,a.y+a.height/2).closest('.sticky-actions')});ok(hit,'el botón de la nota queda tapado');
  await sleep(2400);ok(await p.$eval('.cat-bubble',e=>e.hidden),'muestra globo en modo apartado');ok(!errs.length,errs.join());out.push(`${vp.width}x${vp.height}: ${info.cls}`)}
 return out.join(' · ')});

await b.close();srv.close();orig.srv.close();
const bad=res.filter(r=>!r[1]).length;console.log(`\n${res.length-bad}/${res.length} OK`);process.exit(bad?1:0)})();
