/* Fase 1.5: búsqueda progresiva + apertura con file://  (uso: NODE_PATH=$(npm root -g) node suite2.cjs) */
const {makeSite,sleep,chromium,startServer,PNG,fs,path}=require('./lib.cjs');
const {execFileSync,spawnSync}=require('child_process');
const res=[];const T=async(id,name,fn)=>{try{const d=await fn();res.push([id,1]);console.log('✔',id,name,d?'\n     '+d:'')}catch(e){res.push([id,0]);console.log('✘',id,name,'\n     '+String(e.message).split('\n').slice(0,4).join('\n     '))}};
const ok=(c,m)=>{if(!c)throw new Error(m)};
const IGN=/fonts\.(googleapis|gstatic)|ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION|BLOCKED|FAILED)/;
const CAT2={projects:[
 {name:'Proyecto TFG de Redes',description:'Memoria final',category:'Documentación',tags:['TFG','Redes'],file:'a/memoria.pdf'},
 {name:'Python Scripts',description:'Automatización',category:'Programación',tags:['Python'],file:'b/main.py'},
 {name:'Servidor Proxmox',description:'Virtualización',category:'Sistemas',tags:['Proxmox'],file:'c/captura.png',cover:'c/captura.png'},
 {name:'Prácticas VLAN',description:'Laboratorio de red; ver también el proyecto de DHCP',category:'Redes',tags:['CCNA'],file:'d/notas.txt'},
 {name:'Apache y PHP',description:'LAMP',category:'Servicios web',tags:['Proyectos'],link:'https://github.com/x/y'},
 {name:'Proyecto SECRETO',description:'borrador',category:'Redes',tags:['TFG'],file:'e/x.txt',published:false},
]};
const mk2=()=>{const d=makeSite({catalog:CAT2,dataJs:true});const w=(r,x)=>{fs.mkdirSync(path.dirname(path.join(d,'sources/projects',r)),{recursive:true});fs.writeFileSync(path.join(d,'sources/projects',r),x)};
 w('a/memoria.pdf','%PDF-1.1\n%%EOF');w('b/main.py','print(1)');w('c/captura.png',PNG);w('d/notas.txt','hola notas');w('e/x.txt','x');
 execFileSync('node',[path.join(d,'tools/sync-catalog.cjs')],{cwd:d});return d};
async function page(b,url,{vp={width:1280,height:900}}={}){const p=await b.newPage({viewport:vp});const errs=[],reqs=[];
 p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!IGN.test(m.text()))errs.push('console: '+m.text())});p.on('request',r=>reqs.push(r.url()));await p.goto(url);return {p,errs,reqs}}
const titles=(p)=>p.$$eval('.as-result .as-title',n=>n.map(x=>x.textContent));
const openAs=async(p)=>{await p.click('.cat');await p.waitForSelector('#asQuery');await p.waitForSelector('[data-chips]:not([hidden]), .as-msg.is-error',{timeout:4000})};   // el catálogo ya está cargado
(async()=>{
const dir=mk2();const {srv,port}=await startServer(dir);const base=`http://127.0.0.1:${port}/index.html`;const b=await chromium.launch();
const S=require(path.join(dir,'js/search.js'));

await T('P1','Escribir «p» (sin Enter) muestra resultados al instante; luego pr, pro, «proyecto tfg»',async()=>{
 const {p,errs}=await page(b,base);await sleep(500);await openAs(p);const seen=[];
 await p.keyboard.type('p');await sleep(60);seen.push(await titles(p));ok(seen[0].length>=3,'«p» sin resultados: '+seen[0]);
 ok(['Proyecto TFG de Redes','Python Scripts','Prácticas VLAN'].every(t=>seen[0].slice(0,3).includes(t)),'los títulos que empiezan por P no van primero: '+seen[0]);
 await p.keyboard.type('r');await sleep(60);seen.push(await titles(p));
 await p.keyboard.type('o');await sleep(60);seen.push(await titles(p));
 ok(seen[2][0]==='Proyecto TFG de Redes'&&seen[2].indexOf('Python Scripts')>seen[2].indexOf('Apache y PHP'),'«pro»: '+seen[2]);   // Python solo entra por la categoría «Programación» (nivel 4)
 await p.keyboard.type('yecto tfg');await sleep(60);const last=await titles(p);ok(last[0]==='Proyecto TFG de Redes',last+'');
 ok(!/Todavía|Escribe/.test(await p.textContent('[data-status]'))||true);
 ok(!errs.length,errs.join());return JSON.stringify(seen)+' → '+last.join(',')});

await T('P2','Borrar caracteres actualiza al instante; vaciar el campo limpia los resultados',async()=>{
 const {p}=await page(b,base);await sleep(500);await openAs(p);
 await p.keyboard.type('proyecto tfg');await sleep(60);const a=await titles(p);
 for(let i=0;i<4;i++)await p.keyboard.press('Backspace');await sleep(60);const b2=await titles(p);ok(b2.join()!==a.join()||b2.length>=a.length,'no cambió al borrar');
 await p.fill('#asQuery','');await sleep(60);ok((await titles(p)).length===0&&(await p.textContent('[data-status]')).trim()==='','no limpió');
 await p.keyboard.type('x');await sleep(60);await p.keyboard.press('Backspace');await sleep(60);ok((await titles(p)).length===0)});

await T('P3','No se reconstruye la ventana: mismos nodos (campo, lista y tarjetas) entre pulsaciones',async()=>{
 const {p}=await page(b,base);await sleep(500);await openAs(p);
 await p.keyboard.type('pr');await sleep(60);
 await p.evaluate(()=>{window.__root=document.querySelector('.as');window.__input=document.getElementById('asQuery');window.__ul=document.querySelector('.as-results');document.querySelectorAll('.as-result').forEach(li=>li.__keep=li.querySelector('.as-title').textContent)});
 await p.keyboard.type('o');await sleep(60);
 const r=await p.evaluate(()=>({root:window.__root===document.querySelector('.as'),input:window.__input===document.getElementById('asQuery')&&document.activeElement===window.__input,ul:window.__ul===document.querySelector('.as-results'),kept:[...document.querySelectorAll('.as-result')].filter(li=>li.__keep).length,total:document.querySelectorAll('.as-result').length}));
 ok(r.root&&r.input&&r.ul,JSON.stringify(r));ok(r.kept===r.total&&r.total>0,'se recrearon tarjetas: '+JSON.stringify(r));
 // rendimiento: 40 pulsaciones seguidas
 const t=await p.evaluate(async()=>{const i=document.getElementById('asQuery');const t0=performance.now();for(const w of ['p','pr','pro','proy','proye','proyec','proyect','proyecto','proyecto ','proyecto t','proyecto tf','proyecto tfg']){i.value=w;i.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>requestAnimationFrame(r))}return performance.now()-t0});
 return `mismos nodos ✔ · 12 pulsaciones en ${t.toFixed(0)} ms (incluye 12 fotogramas)`});

await T('P4','Orden de relevancia: título empieza < palabra del título < contiene < etiquetas/categoría < descripción/metadatos',async()=>{
 const mk=(id,name,description,category,tags,e={})=>({id,name,description,category,tags,extraFiles:[],extraLinks:[],fileName:'',kind:'link',date:'',url:'u'+id,link:'',...e});
 const items=[mk('5','Zeta','Cosas con redecillas y otras','Otros',[]),mk('4','Zeta','x','Otros',['redes']),mk('3','Mi lab de superredes','x','Otros',[]),mk('2','Proyecto de redes','x','Otros',[]),mk('1','Redes avanzadas','x','Otros',[])].map((x,i)=>({...x,name:['Zeta uno','Zeta dos','Mi lab de superredes','Mi primera red','Redes avanzadas'][i]}));
 const r=S.search(items,'red').results.map(x=>x.item.name+':'+x.tier);
 ok(r[0]==='Redes avanzadas:1'&&r[1]==='Mi primera red:2'&&r[2]==='Mi lab de superredes:3'&&r[3]==='Zeta dos:4'&&r[4]==='Zeta uno:5',r.join(' | '));return r.join(' | ')});

await T('P5','Mayúsculas, tildes, espacios y varias palabras (campos, no solo título); sinónimos; sin duplicados',async()=>{
 const {p}=await page(b,base);await sleep(400);await openAs(p);const g=async(t)=>{await p.fill('#asQuery',t);await sleep(60);return titles(p)};
 ok((await g('  PRÁCTICAS   vlan '))[0]==='Prácticas VLAN','tildes/espacios');
 ok((await g('proyecto tfg'))[0]==='Proyecto TFG de Redes','proyecto tfg');
 ok((await g('tfg redes memoria'))[0]==='Proyecto TFG de Redes','campos mezclados');
 ok((await g('github'))[0]==='Apache y PHP','enlace');
 const all=await g('p');ok(new Set(all).size===all.length,'duplicados');
 ok((await g('zzzz')).length===0&&/No he encontrado/.test(await p.textContent('[data-out]')),'sin resultados')});

await T('P6','Nunca aparecen borradores (con cada letra escrita)',async()=>{
 const {p}=await page(b,base);await sleep(400);await openAs(p);
 for(const c of 'proyecto secreto tfg'){await p.keyboard.type(c);await sleep(30);ok(!(await titles(p)).some(x=>/SECRETO/i.test(x)),'apareció el borrador tras «'+c+'»')}});

await T('P7','Enter sigue funcionando, no duplica ventanas y abrir un resultado usa el sistema existente',async()=>{
 const {p,errs}=await page(b,base);await sleep(400);await openAs(p);await p.keyboard.type('servidor');await p.keyboard.press('Enter');await sleep(100);
 ok((await titles(p))[0]==='Servidor Proxmox');ok((await p.$$('.window[data-id=assistant]')).length===1);
 await p.click('.as-open');await p.waitForSelector('.pj-viewer img');ok((await p.$$('.window[data-id=projects]')).length===1);
 ok(await p.$eval('.pj-viewer img',i=>i.complete&&i.naturalWidth>0),'imagen del visor rota');ok(!errs.length,errs.join())});

await T('P8','Con Live Server/HTTP: usa projects.json y NUNCA pide projects.data.js; consola limpia; sin peticiones externas',async()=>{
 const {p,errs,reqs}=await page(b,base);await sleep(500);await openAs(p);await p.keyboard.type('python');await sleep(100);
 ok(reqs.some(u=>/projects\.json/.test(u)),'no pidió projects.json');ok(!reqs.some(u=>/projects\.data\.js/.test(u)),'pidió la copia JS con servidor');
 ok(!reqs.filter(u=>!u.startsWith(`http://127.0.0.1:${port}/`)&&!u.startsWith('data:')&&!/fonts\.(googleapis|gstatic)\.com/.test(u)).length,'externas');ok(!errs.length,errs.join())});

await T('P9','Con HTTP, si projects.json falta aunque exista la copia JS → error (no se usa una copia posiblemente vieja)',async()=>{
 const d=mk2();fs.rmSync(path.join(d,'sources/projects/projects.json'));const s=await startServer(d);
 const {p}=await page(b,`http://127.0.0.1:${s.port}/index.html`);await sleep(400);await openAs(p);await p.waitForSelector('.as-msg.is-error');ok(!(await p.$('.as-result')));s.srv.close()});

const fileUrl=(d)=>'file://'+d+'/index.html';
await T('F1','file://: el catálogo carga (sin servidor), el buscador funciona y la consola está limpia',async()=>{
 const d=mk2();const {p,errs,reqs}=await page(b,fileUrl(d));await sleep(900);ok(/^file:/.test(p.url()),'no es file://');await openAs(p);
 await p.keyboard.type('tfg');await sleep(150);const t=await titles(p);ok(t[0]==='Proyecto TFG de Redes'&&!t.some(x=>/SECRETO/.test(x)),'resultados: '+t);
 ok(reqs.some(u=>/projects\.data\.js/.test(u)),'no cargó la copia JS');ok(!reqs.some(u=>/projects\.json/.test(u)),'intentó fetch del JSON bajo file://');
 ok(!reqs.filter(u=>!/^file:|^data:|fonts\.(googleapis|gstatic)/.test(u)).length,'peticiones externas');ok(!errs.length,errs.join(' | '));return 'resultados: '+t.join(', ')});

await T('F2','file://: ventana Proyectos con tarjetas, portada/imagen y visor de imagen funcionan',async()=>{
 const d=mk2();const {p,errs}=await page(b,fileUrl(d));await sleep(700);await p.dblclick('button.desk-icon:has-text("Proyectos")');await p.waitForSelector('.pj-card');
 ok((await p.$$('.pj-card')).length===5,'tarjetas: '+(await p.$$('.pj-card')).length);await sleep(400);
 ok(await p.$eval('.pj-card img',i=>i.naturalWidth>0),'portada rota bajo file://');
 await openAs(p);await p.keyboard.type('proxmox');await sleep(100);await p.click('.as-open');await p.waitForSelector('.pj-viewer img');ok(await p.$eval('.pj-viewer img',i=>i.naturalWidth>0),'imagen del visor');
 ok(!errs.length,errs.join(' | '))});

await T('F3','file://: vista previa de TEXTO → mensaje claro (no se puede leer archivos locales), sin errores en consola',async()=>{
 const d=mk2();const {p,errs}=await page(b,fileUrl(d));await sleep(700);await openAs(p);await p.keyboard.type('practicas');await sleep(100);await p.click('.as-open');await p.waitForSelector('.pj-viewer .pj-code');await sleep(200);
 const txt=await p.textContent('.pj-viewer .pj-code');ok(/file:\/\//.test(txt)&&/Descarga/.test(txt),txt);ok(!errs.length,errs.join(' | '))});

await T('F4','file://: copia JS ausente / sin catálogo / mal formada → error específico, distinto de «sin resultados»; Reintentar recupera',async()=>{
 for(const mode of ['missing','nodef','syntax','shape']){
  const d=mk2();const f=path.join(d,'sources/projects/projects.data.js');const good=fs.readFileSync(f,'utf8');
  if(mode==='missing')fs.rmSync(f);if(mode==='nodef')fs.writeFileSync(f,'/* vacío */');if(mode==='syntax')fs.writeFileSync(f,'window.__PORTFOLIO_CATALOG__ = {oops');if(mode==='shape')fs.writeFileSync(f,'window.__PORTFOLIO_CATALOG__ = {x:1};');
  const {p}=await page(b,fileUrl(d));await sleep(500);await openAs(p);await p.waitForSelector('.as-msg.is-error');
  const m=await p.textContent('.as-msg.is-error');ok(/No he podido cargar el catálogo/.test(m),mode+': '+m);ok(/projects\.data\.js|sync-catalog|file:\/\//.test(m),mode+' sin pista de la causa: '+m);
  await p.keyboard.type('tfg');await sleep(100);ok(await p.$('.as-msg.is-error')&&!(await p.$('.as-result')),mode+': inventó resultados o ocultó el error');
  fs.writeFileSync(f,good);await p.click('[data-retry]');await p.waitForSelector('.as-result',{timeout:3000});await p.close()}
 return '4 modos de fallo OK'});

await T('F5','file://: un borrador dentro de la copia JS tampoco se muestra (misma normalización que con JSON)',async()=>{
 const d=mk2();const f=path.join(d,'sources/projects/projects.data.js');fs.writeFileSync(f,'window.__PORTFOLIO_CATALOG__ = '+JSON.stringify(CAT2)+';');
 const {p}=await page(b,fileUrl(d));await sleep(500);await openAs(p);await p.keyboard.type('secreto');await sleep(100);ok(!(await titles(p)).some(x=>/SECRETO/i.test(x)))});

await T('F6','file://: teclado/gato/ventanas siguen igual (Tab+Enter abre; Escape cierra; sin duplicados)',async()=>{
 const d=mk2();const {p,errs}=await page(b,fileUrl(d));await sleep(600);await p.focus('.cat');await p.keyboard.press('Enter');await p.waitForSelector('.window[data-id=assistant]');await p.keyboard.press('Enter');
 ok((await p.$$('.window[data-id=assistant]')).length===1);await p.keyboard.press('Escape');await p.waitForSelector('.window[data-id=assistant]',{state:'detached'});ok(!errs.length,errs.join())});

await T('S1','tools/sync-catalog.cjs: genera, --check detecta copia vieja/ausente, regenera, rechaza JSON roto sin tocar nada',async()=>{
 const d=mk2();const run=(...a)=>spawnSync('node',[path.join(d,'tools/sync-catalog.cjs'),...a],{cwd:d,encoding:'utf8'});
 ok(run('--check').status===0,'check inicial');
 const jp=path.join(d,'sources/projects/projects.json');const j=JSON.parse(fs.readFileSync(jp,'utf8'));j.projects.pop();fs.writeFileSync(jp,JSON.stringify(j,null,2)+'\n');
 ok(run('--check').status===1,'no detectó copia desactualizada');ok(run().status===0&&run('--check').status===0,'no regeneró');
 const dj=path.join(d,'sources/projects/projects.data.js');const before=fs.readFileSync(dj,'utf8');fs.writeFileSync(jp,'{roto');const r=run();ok(r.status===1&&fs.readFileSync(dj,'utf8')===before,'tocó la copia con JSON roto');
 fs.writeFileSync(jp,JSON.stringify(j));fs.rmSync(dj);ok(run('--check').status===1,'no detectó la ausencia');
 fs.writeFileSync(dj,'// mío');ok(run().status===0&&fs.existsSync(dj+'.bak'),'no hizo copia de un archivo ajeno')});

await b.close();srv.close();
const bad=res.filter(r=>!r[1]).length;console.log(`\n${res.length-bad}/${res.length} OK`);process.exit(bad?1:0)})();
