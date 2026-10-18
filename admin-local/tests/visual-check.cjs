/* Compara capturas de la web pública (original vs corregida) con el mismo catálogo de ejemplo + comprueba errores JS del administrador */
const fs = require('fs'); const path = require('path');
const { openAdmin, cloneProject, startServer, sleep, chromium, makeFiles } = require('./harness.cjs');
const ui = require('./ui.cjs');
const [orig, fixed] = [path.resolve(process.argv[2]), path.resolve(process.argv[3])];
const catalog = { projects: [
  { id: 'a', name: 'Laboratorio VLAN', description: 'Segmentación con VLANs en Packet Tracer', category: 'Redes', tags: ['VLAN', 'CCNA'], date: '2026-05-01', file: 'lab/a.txt', size: 120, link: 'https://example.com' },
  { id: 'b', name: 'Servidor DHCP', description: 'Windows Server', category: 'Sistemas', tags: [], date: '2026-04-01', file: 'dhcp/b.pdf' },
] };
async function shot(dir) {
  fs.writeFileSync(path.join(dir, 'sources/projects/projects.json'), JSON.stringify(catalog, null, 2));
  fs.mkdirSync(path.join(dir, 'sources/projects/lab'), { recursive: true }); fs.writeFileSync(path.join(dir, 'sources/projects/lab/a.txt'), 'x');
  const { srv, port } = await startServer(dir); const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await p.goto(`http://127.0.0.1:${port}/index.html`); await p.dblclick('button.desk-icon:has-text("Proyectos")');
  await p.waitForSelector('.pj-card'); await sleep(1500);
  const img = await p.screenshot(); await b.close(); srv.close(); return img;
}
(async () => {
  const a = await shot(cloneProject(orig)); const f = await shot(cloneProject(fixed));
  console.log(a.equals(f) ? 'VISUAL: capturas idénticas byte a byte (original vs corregida)' : `VISUAL: DIFERENCIAS (${a.length} vs ${f.length} bytes)`);
  // errores JS del administrador en un flujo completo
  const dir = cloneProject(fixed); const ad = await openAdmin({ projectDir: dir });
  await ui.pick(ad.page, dir); await ui.newProject(ad.page, 'X', { files: makeFiles(2), publish: true }); await sleep(600);
  await ad.page.click('#btnPublishLocal'); await sleep(2500);
  console.log('ERRORES JS en el administrador:', ad.errors.length ? ad.errors.join(' | ') : 'ninguno'); await ad.close();
})();
