/* El administrador genera/actualiza sources/projects/projects.data.js (copia para file://) sin romper el guardado.
   Uso: NODE_PATH=$(npm root -g) node admin-datajs.cjs */
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const {openAdmin,cloneProject,sleep,makeFiles,chromium}=require('../harness.cjs');const ui=require('../ui.cjs');
const SRC=path.resolve(__dirname,'../../..');
const res=[];const T=async(id,name,fn)=>{try{const d=await fn();res.push(1);console.log('✔',id,name,d?'\n     '+d:'')}catch(e){res.push(0);console.log('✘',id,name,'\n     '+e.message)}};
const ok=(c,m)=>{if(!c)throw new Error(m)};
async function fresh(opts={}){const dir=cloneProject(SRC);fs.mkdirSync(path.join(dir,'sources/projects'),{recursive:true});fs.writeFileSync(path.join(dir,'sources/projects/projects.json'),'{\n  "projects": []\n}\n');const a=await openAdmin({projectDir:dir,...opts});await ui.pick(a.page,dir);return {dir,a}}
async function pubWait(page){await page.evaluate(()=>document.querySelectorAll('#toasts .toast').forEach(t=>t.remove()));await page.click('#btnPublishLocal');
 await sleep(400);if(await page.$('#cfOk'))await page.click('#cfOk',{timeout:3000}).catch(()=>{});   // «vas a dejar la web sin proyectos»
 await page.waitForFunction(()=>/Publicado y verificado|Guardado en la carpeta|NO se ha completado|NO lo ve|copia para abrir/.test(document.querySelector('#toasts')?.textContent||'')||document.querySelector('#statusbar.err'),null,{timeout:15000});await sleep(250);return (await ui.toasts(page)).join(' | ')}
const check=(dir)=>spawnSync('node',[path.join(dir,'tools/sync-catalog.cjs'),'--check'],{cwd:dir,encoding:'utf8'});
const jsPath=(d)=>path.join(d,'sources/projects/projects.data.js');
(async()=>{
 const {dir,a}=await fresh();
 await T('A1','Publicar crea projects.data.js (marca de «generado», coincide con projects.json) y lo dice en el aviso',async()=>{
  await ui.newProject(a.page,'Laboratorio VLAN',{files:makeFiles(1),publish:true});const msg=await pubWait(a.page);
  ok(/Publicado y verificado/.test(msg)&&/Copia para file:\/\/ actualizada/.test(msg),msg);
  const js=fs.readFileSync(jsPath(dir),'utf8');ok(js.includes('GENERADO AUTOMÁTICAMENTE')&&js.includes('Laboratorio VLAN'),'contenido');
  const c=check(dir);ok(c.status===0,'la herramienta ve diferencias: '+c.stderr+c.stdout);return msg.split(' | ').pop()});
 await T('A2','Despublicar actualiza la copia: el proyecto desaparece también de la web abierta con file://',async()=>{
  await a.page.uncheck('#fPub');await sleep(700);const msg=await pubWait(a.page);ok(/Publicado y verificado|Guardado en la carpeta/.test(msg),msg);
  const js=fs.readFileSync(jsPath(dir),'utf8');ok(!js.includes('Laboratorio VLAN'),'la copia conserva un proyecto despublicado');ok(check(dir).status===0);
  const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+dir+'/index.html');await sleep(500);await p.dblclick('button.desk-icon:has-text("Proyectos")');await sleep(700);
  ok((await p.$$('.pj-card')).length===0,'file:// muestra un proyecto despublicado');await b.close()});
 await T('A3','Una projects.data.js AJENA (sin marca) no se sobrescribe: aviso claro y projects.json sigue publicado',async()=>{
  fs.writeFileSync(jsPath(dir),'// archivo mío');await a.page.check('#fPub');await sleep(700);const msg=await pubWait(a.page);
  ok(/no lo generó este administrador/.test(msg),msg);ok(fs.readFileSync(jsPath(dir),'utf8')==='// archivo mío','lo sobrescribió');
  ok(/Laboratorio VLAN/.test(fs.readFileSync(path.join(dir,'sources/projects/projects.json'),'utf8')),'projects.json no se actualizó');ok(/Publicado y verificado/.test(msg),'el éxito de projects.json se perdió')});
 await a.close();
 const f=await fresh({hooks:{failOn:(op,rel)=>/projects\.data\.js$/.test(rel||'')}});
 await T('A4','Si falla la escritura de la copia JS: projects.json se guarda igual y se avisa (no es un error de publicación)',async()=>{
  await ui.newProject(f.a.page,'X',{files:makeFiles(1),publish:true});const msg=await pubWait(f.a.page);
  ok(/Publicado y verificado/.test(msg)&&/copia para abrir la web con file:\/\//.test(msg),msg);
  ok(JSON.parse(fs.readFileSync(path.join(f.dir,'sources/projects/projects.json'),'utf8')).projects.length===1,'projects.json');ok(!fs.existsSync(jsPath(f.dir)),'quedó un archivo a medias')});
 await f.a.close();
 const bad=res.filter(x=>!x).length;console.log(`\n${res.length-bad}/${res.length} OK`);process.exit(bad?1:0)})();
