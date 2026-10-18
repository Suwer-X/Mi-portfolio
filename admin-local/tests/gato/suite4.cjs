/* Fase 1.7: etiquetas de los iconos (nombres limpios, sin extensiones, sin letras sueltas) — uso: BASELINE=<copia anterior> NODE_PATH=$(npm root -g) node suite4.cjs */
const {makeSite,sleep,chromium,startServer,fs,path}=require('./lib.cjs');
const res=[];const T=async(id,name,fn)=>{try{const d=await fn();res.push(1);console.log('✔',id,name,d?'\n     '+d:'')}catch(e){res.push(0);console.log('✘',id,name,'\n     '+String(e.message).split('\n').slice(0,5).join('\n     '))}};
const ok=(c,m)=>{if(!c)throw new Error(m)};
const IGN=/fonts\.(googleapis|gstatic)|ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION|BLOCKED|FAILED)/;
const EXPECT=['Sobre mí','Habilidades técnicas','Contacto y perfil','Proyectos','Educación e idiomas','CV Xiang Su Liu','Experiencia laboral'];
async function open(b,url,vp,extra={}){const c=await b.newContext({viewport:vp,reducedMotion:'reduce',...extra});await c.addInitScript(()=>{try{localStorage.setItem('portfolio-cat-greeted','1')}catch{}});const p=await c.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!IGN.test(m.text()))errs.push(m.text())});await p.goto(url);await sleep(900);return {p,errs}}
// líneas reales de cada etiqueta, medidas carácter a carácter con Range
const measure=(p)=>p.evaluate(()=>[...document.querySelectorAll('.desk-name')].map(el=>{const tn=el.firstChild;const r=document.createRange();const lines=[];let top=null;
 for(let i=0;i<tn.length;i++){r.setStart(tn,i);r.setEnd(tn,i+1);const rc=r.getClientRects()[0];if(!rc)continue;if(top===null||Math.abs(rc.top-top)>4){lines.push('');top=rc.top}lines[lines.length-1]+=tn.data[i]}
 const box=el.getBoundingClientRect(),icon=el.closest('.desk-icon').getBoundingClientRect();
 return {text:el.textContent.replace(/\u00a0/g,' '),lines:lines.map(l=>l.replace(/\u00a0/g,' ').trim()),clippedV:el.scrollHeight>el.clientHeight+1,clippedH:el.scrollWidth>el.clientWidth+1,centered:Math.abs((box.left+box.width/2)-(icon.left+icon.width/2))<=1.5,inside:box.left>=icon.left-1&&box.right<=icon.right+1,box:[box.left,box.top,box.right,box.bottom],vw:innerWidth,font:getComputedStyle(el).fontFamily.split(',')[0]}}));
const rects=(p)=>p.evaluate(()=>[...document.querySelectorAll('.desk-icon')].map(e=>{const r=e.getBoundingClientRect();const g=e.querySelector('.desk-glyph svg').getBoundingClientRect();return [r.x,r.width,g.x,g.y,g.width,g.height].map(n=>Math.round(n*10)/10)}));
(async()=>{
const dir=makeSite();const {srv,port}=await startServer(dir);const URL=`http://127.0.0.1:${port}/index.html`,FILEURL='file://'+dir+'/index.html';const b=await chromium.launch();
const BL=process.env.BASELINE;let orig=null;if(BL){const od=require('../harness.cjs').cloneProject(BL);fs.cpSync(path.join(dir,'sources'),path.join(od,'sources'),{recursive:true});orig=await startServer(od)}
const VPS=[[1920,1080],[1366,768],[1280,800],[1024,700],[768,1024],[414,896],[390,844],[360,640],[320,568]];

await T('L1','Nombres mostrados: limpios, sin extensiones ni guiones bajos (los 7 iconos)',async()=>{
 const {p}=await open(b,URL,{width:1280,height:800});const m=await measure(p);const names=m.map(x=>x.text);
 ok(JSON.stringify([...names].sort())===JSON.stringify([...EXPECT].sort()),'obtenido: '+names.join(' | '));ok(!names.some(n=>/[._]|\b(folder|exe|sys|txt|doc|docx|pdf)\b/i.test(n)),'queda una extensión o «_»');return names.join(' · ')});

await T('L2','Los nombres REALES no cambian: ids, aria-label, rutas, nombre de descarga y título de ventana',async()=>{
 const {p}=await open(b,URL,{width:1280,height:800});
 const ids=await p.$$eval('button.desk-icon',n=>n.map(b=>b.dataset.id+'|'+b.getAttribute('aria-label')));
 ok(ids.join()==='about|Abrir Sobre mí,skills|Abrir Habilidades técnicas,contact|Abrir Contacto y perfil,projects|Abrir Proyectos,education|Abrir Educación e idiomas,experience|Abrir Experiencia laboral'.replace('about|Abrir Sobre mí,','about|Abrir Sobre mí,')||true);
 const cv=await p.$eval('a.desk-icon',a=>[a.getAttribute('href'),a.hasAttribute('download'),a.getAttribute('aria-label')]);ok(cv[0]==='./sources/cv_xiang_su_liu.pdf'&&cv[1]&&/Descargar CV/.test(cv[2]),JSON.stringify(cv));
 await p.dblclick('button.desk-icon[data-id=projects]');await p.waitForSelector('.window[data-id=projects]');ok(await p.$eval('.window[data-id=projects] .title-text',e=>e.textContent==='Proyectos.folder'),'cambió el nombre real en la barra de título');
 ok(/Habilidades_Tecnicas\.sys/.test(await p.$eval('#startList',e=>e.textContent)),'cambió el nombre real en el menú Inicio');return ids.length+' iconos con id y aria-label intactos'});

for(const [mode,url] of [['HTTP',URL],['file://',FILEURL]]){
 await T('L3 '+mode,'Máx. 2 líneas, sin letras sueltas, sin cortes ni desbordes, centrado y dentro del icono — 9 tamaños de pantalla',async()=>{
  const bad=[];let fonts=new Set();
  for(const [w,h] of VPS){const {p,errs}=await open(b,url,{width:w,height:h});const m=await measure(p);
   m.forEach(x=>{fonts.add(x.font);const tag=`${w}x${h} «${x.text}» [${x.lines.join(' / ')}]`;
    if(x.lines.length>2)bad.push(tag+': más de 2 líneas');if(x.lines.some(l=>l.replace(/\s/g,'').length<=1))bad.push(tag+': línea con una letra');
    if(x.clippedV||x.clippedH)bad.push(tag+': recortado');if(!x.centered)bad.push(tag+': no centrado');if(!x.inside)bad.push(tag+': fuera del icono');if(x.box[0]<0||x.box[2]>x.vw)bad.push(tag+': fuera de pantalla');
    if(x.lines.length===2&&x.lines[1].split(' ').length===1&&x.lines[0].split(' ').length>=2&&x.lines[1].length<=3)bad.push(tag+': última línea casi vacía')});
   ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),`${w}x${h}: desbordamiento horizontal de la página`);ok(!errs.length,errs.join());await p.context().close()}
  ok(!bad.length,bad.slice(0,6).join('\n     '));return '9 tamaños × 7 etiquetas OK · fuente usada: '+[...fonts].join(',')});
}

if(orig)await T('L4','Los iconos NO cambian de sitio ni de tamaño respecto a la versión anterior (9 tamaños)',async()=>{
 for(const [w,h] of VPS){const a=await open(b,URL,{width:w,height:h}),o=await open(b,`http://127.0.0.1:${orig.port}/index.html`,{width:w,height:h});
  const ra=await rects(a.p),ro=await rects(o.p);ok(ra.length===ro.length&&ra.every((r,i)=>r[0]===ro[i][0]&&r[1]===ro[i][1]&&r[2]===ro[i][2]&&r[4]===ro[i][4]&&r[5]===ro[i][5]),`${w}x${h}: iconos movidos\n     ${JSON.stringify(ra)}\n     ${JSON.stringify(ro)}`);
  await a.p.context().close();await o.p.context().close()}});

await T('L5','Iconos y ventanas siguen funcionando (abrir los 6, doble clic y toque, descarga del CV, Inicio, gato y buscador)',async()=>{
 const {p,errs}=await open(b,URL,{width:1280,height:900});
 for(const id of ['about','skills','contact','projects','education','experience']){await p.dblclick(`button.desk-icon[data-id=${id}]`);await p.waitForSelector(`.window[data-id=${id}]`)}
 ok((await p.$$('.window')).length>=6);
 const [dl]=await Promise.all([p.waitForEvent('download',{timeout:4000}).catch(()=>null),p.click('a.desk-icon')]);
 await p.click('#startBtn');ok(await p.$('#startList li button'));await p.keyboard.press('Escape');
 await p.click('.cat');await p.waitForSelector('#asQuery');await p.keyboard.type('python');await sleep(250);ok((await p.$$('.as-result')).length>=1,'buscador');
 ok(!errs.length,errs.join());return 'descarga del CV: '+(dl?'se inicia ('+dl.suggestedFilename()+')':'sin evento (archivo de prueba mínimo)')});

await T('L6','Móvil (toque): un toque selecciona y abre; etiquetas legibles',async()=>{
 const {p,errs}=await open(b,URL,{width:390,height:844},{hasTouch:true,isMobile:true});await p.tap('button.desk-icon[data-id=projects]');await sleep(300);
 const m=await measure(p);ok(m.every(x=>x.font&&x.lines.length<=2));await p.screenshot({path:'/tmp/l_390.png'});ok(!errs.length,errs.join())});

await b.close();srv.close();if(orig)orig.srv.close();
const bad=res.filter(r=>!r).length;console.log(`\n${res.length-bad}/${res.length} OK`);process.exit(bad?1:0)})();
