/* Rejilla de 80 tamaños de pantalla: el gato no solapa la nota, queda dentro de pantalla y es clicable. */
const {makeSite,sleep,chromium,startServer}=require('./lib.cjs');
(async()=>{const dir=makeSite();const {srv,port}=await startServer(dir);const b=await chromium.launch();let bad=0;const rows=[];
for(const W of [1001,1100,1180,1181,1280,1366,1440,1536,1920,2560])for(const H of [641,680,720,768,800,840,900,1080]){
 const p=await b.newPage({viewport:{width:W,height:H},reducedMotion:'reduce'});await p.goto(`http://127.0.0.1:${port}/index.html`);await sleep(350);
 const r=await p.evaluate(()=>{const c=document.querySelector('.cat').getBoundingClientRect(),n=document.querySelector('.sticky-note').getBoundingClientRect(),t=document.querySelector('.desktop-greeting h1').getBoundingClientRect();
  const ov=!(c.right<=n.left||c.left>=n.right||c.bottom<=n.top||c.top>=n.bottom);
  const hit=document.elementFromPoint(c.x+c.width/2,c.y+c.height/2);return {ov,side:document.getElementById('catSlot').className.replace('cat-slot','').trim()||'normal',size:c.width,inView:c.right<=innerWidth&&c.left>=0&&c.top>=0,hit:!!hit.closest('.cat'),ctr:Math.round(c.x)+','+Math.round(c.y)}});
 if(r.ov||!r.inView||!r.hit){bad++;console.log('✘',W,H,JSON.stringify(r))}else rows.push(`${W}x${H}:${r.side}`);await p.close()}
console.log(bad?`${bad} MALOS`:'rejilla OK (80 tamaños): sin solape, dentro de pantalla y clicable');console.log(rows.join('  '));await b.close();srv.close()})();
