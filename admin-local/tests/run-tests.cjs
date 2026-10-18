/* Batería de pruebas del administrador. Uso (desde admin-local/tests):
     NODE_PATH=$(npm root -g) node run-tests.cjs [carpeta-del-proyecto]
   Requiere Playwright + Chromium. Usa un "disco" real (carpeta temporal) detrás de la API de carpetas. */
const fs = require('fs'); const path = require('path'); const os = require('os');
const { openAdmin, cloneProject, sleep, readJson, exists, makeFiles } = require('./harness.cjs');
const ui = require('./ui.cjs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../..'));

const results = [];
async function T(id, name, fn) {
  const t0 = Date.now();
  try { const detail = await fn(); results.push({ id, name, ok: true, detail }); console.log(`✔ ${id} ${name}${detail ? '\n    ' + detail : ''}`); }
  catch (e) { results.push({ id, name, ok: false, detail: e.message }); console.log(`✘ ${id} ${name}\n    ${e.message}`); }
}
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const EXPECTED3 = ['captura-2.png', 'datos-3.csv', 'memoria-1.txt'];
const lsProject = (dir, sub) => { const d = path.join(dir, 'sources/projects', sub); return fs.existsSync(d) ? fs.readdirSync(d).sort() : []; };

async function waitResult(page, timeout = 15000) {
  await page.waitForFunction(() => {
    const t = document.querySelector('#toasts')?.textContent || '';
    return /Publicado y verificado|Guardado en la carpeta|NO se ha completado|NO lo ve/.test(t) || document.querySelector('#statusbar.err');
  }, null, { timeout });
  await sleep(150);
}
async function publishAndWait(page) {
  await page.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); });   // evita leer avisos anteriores
  await page.click('#btnPublishLocal'); await waitResult(page); return (await ui.toasts(page)).join(' | ');
}
async function fresh(opts = {}) {
  const dir = cloneProject(SRC);
  // catálogo de partida vacío y sin proyectos de prueba previos
  fs.writeFileSync(path.join(dir, 'sources/projects/projects.json'), '{\n  "projects": []\n}\n');
  const a = await openAdmin({ projectDir: dir, ...opts });
  await ui.pick(a.page, dir);
  return { dir, a };
}
async function publicCards(base, ctxBrowser) {
  const pg = await ctxBrowser.newPage();
  await pg.goto(`${base}/index.html`);
  await pg.dblclick('button.desk-icon:has-text("Proyectos")');
  await pg.waitForSelector('.pj-card, .pj-empty', { timeout: 8000 });
  const cards = await pg.$$eval('.pj-card .pj-title', (n) => n.map((x) => x.textContent));
  const empty = await pg.$$eval('.pj-empty-title, .pj-empty-text', (n) => n.map((x) => x.textContent).join(' / '));
  const broken = await pg.$$eval('.pj-card img', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).length);
  await pg.close();
  return { cards, empty, broken };
}

(async () => {
  console.log(`Proyecto probado: ${SRC}\n`);
  const files3 = makeFiles(3);

  /* ---------------- 1-5, 7: ciclo básico ---------------- */
  let shared;
  await T('T1', 'Crear un proyecto y guardarlo directamente; aparece en projects.json', async () => {
    shared = await fresh();
    const { a, dir } = shared;
    await ui.newProject(a.page, 'Laboratorio VLAN', { files: [files3[0]], publish: true });
    const msg = await publishAndWait(a.page);
    ok(/Publicado y verificado/.test(msg), `mensaje inesperado: ${msg}`);
    const j = readJson(dir);
    eq(j.projects.map((p) => p.name), ['Laboratorio VLAN'], 'catálogo');
    ok(exists(dir, 'sources/projects/' + j.projects[0].file), 'el archivo principal no existe en disco');
    return `projects.json → ${j.projects.length} proyecto; mensaje: «${msg.split(' | ').pop()}»`;
  });
  await T('T2', 'Segundo proyecto: el primero no desaparece', async () => {
    const { a, dir } = shared;
    await ui.newProject(a.page, 'Servidor DHCP', { files: [files3[0]], publish: true });
    await publishAndWait(a.page);
    eq(readJson(dir).projects.map((p) => p.name).sort(), ['Laboratorio VLAN', 'Servidor DHCP'], 'catálogo');
  });
  await T('T3', 'Tres archivos: los tres existen en disco con el mismo contenido', async () => {
    const { a, dir } = shared;
    await ui.newProject(a.page, 'Proyecto tres archivos', { files: files3, publish: true });
    await publishAndWait(a.page);
    const e = readJson(dir).projects.find((p) => p.name === 'Proyecto tres archivos');
    const refs = [e.file, e.cover, ...(e.files || []).map((f) => f.file)].filter(Boolean);
    const uniq = [...new Set(refs)];
    eq(uniq.length, 3, 'referencias distintas en el catálogo');
    const onDisk = lsProject(dir, 'proyecto-tres-archivos');
    eq(onDisk.length, 3, 'archivos en disco');
    for (const src of files3) {
      const match = onDisk.find((n) => fs.readFileSync(path.join(dir, 'sources/projects/proyecto-tres-archivos', n)).equals(fs.readFileSync(src)));
      ok(match, `no hay copia idéntica de ${path.basename(src)}`);
    }
    return `disco: ${onDisk.join(', ')}`;
  });
  await T('T4', 'Las rutas de los tres archivos funcionan (HTTP 200 y mismo tamaño)', async () => {
    const { a, dir } = shared;
    const e = readJson(dir).projects.find((p) => p.name === 'Proyecto tres archivos');
    const refs = [...new Set([e.file, e.cover, ...(e.files || []).map((f) => f.file)].filter(Boolean))];
    const out = await a.page.evaluate(async (rs) => Promise.all(rs.map(async (r) => { const x = await fetch('/sources/projects/' + r, { cache: 'no-store' }); return [r, x.status, (await x.arrayBuffer()).byteLength]; })), refs);
    for (const [r, st, size] of out) { eq(st, 200, `HTTP ${r}`); eq(size, fs.statSync(path.join(dir, 'sources/projects', r)).size, `tamaño ${r}`); }
    return out.map((o) => `${o[0]} → ${o[1]}`).join('; ');
  });
  await T('T5', 'Recargar el administrador: los datos persisten', async () => {
    const { a, dir } = shared;
    const before = await a.page.$$eval('#list .pname', (n) => n.map((x) => x.textContent).sort());
    await a.page.reload(); await a.page.waitForSelector('#list li');
    const after = await a.page.$$eval('#list .pname', (n) => n.map((x) => x.textContent).sort());
    eq(after, before, 'lista tras recargar');
    await ui.pick(a.page, dir);
    ok(/todo guardado/.test(await ui.statusText(a.page)), `estado: ${await ui.statusText(a.page)}`);
    return `${after.length} proyectos tras recargar; estado «${await ui.statusText(a.page)}»`;
  });
  await T('T7', 'La web pública muestra los proyectos publicados (y no los borradores)', async () => {
    const { a, dir } = shared;
    await ui.newProject(a.page, 'Borrador secreto', { files: [files3[0]], publish: false });
    await sleep(600); await publishAndWait(a.page);
    const pub = await publicCards(a.base, a.browser);
    eq(pub.cards.sort(), ['Laboratorio VLAN', 'Proyecto tres archivos', 'Servidor DHCP'], 'tarjetas públicas');
    ok(!exists(dir, 'sources/projects/borrador-secreto/memoria-1.txt'), 'un borrador se escribió en disco');
    return `web pública: ${pub.cards.length} tarjetas; imágenes rotas: ${pub.broken}`;
  });
  await T('T8', 'Despublicar: desaparece de la web y NO se borran sus archivos', async () => {
    const { a, dir } = shared;
    const before = lsProject(dir, 'proyecto-tres-archivos');
    await a.page.click('#list li:has-text("Proyecto tres archivos") [data-pub]');
    await publishAndWait(a.page);
    ok(!readJson(dir).projects.some((p) => p.name === 'Proyecto tres archivos'), 'sigue en el catálogo');
    eq(lsProject(dir, 'proyecto-tres-archivos'), before, 'archivos en disco');
    const pub = await publicCards(a.base, a.browser);
    ok(!pub.cards.includes('Proyecto tres archivos'), 'sigue en la web pública');
    return `web pública ahora: ${pub.cards.join(', ')}; archivos conservados: ${before.length}`;
  });
  await T('T9', 'Editar un proyecto conserva datos y archivos (sin duplicar)', async () => {
    const { a, dir } = shared;
    await a.page.click('#list li:has-text("Proyecto tres archivos") [data-pick]');
    await a.page.fill('#fDesc', 'Descripción editada'); await a.page.fill('#fTags', 'VLAN, CCNA');
    await a.page.check('#fPub');
    await publishAndWait(a.page);
    const e = readJson(dir).projects.find((p) => p.name === 'Proyecto tres archivos');
    eq(e.description, 'Descripción editada', 'descripción'); eq(e.tags, ['VLAN', 'CCNA'], 'etiquetas');
    eq(lsProject(dir, 'proyecto-tres-archivos'), EXPECTED3, 'archivos en disco (sin duplicados)');
  });
  await T('T10', 'El catálogo del ZIP es idéntico al del guardado directo', async () => {
    const { a, dir } = shared;
    await a.page.click('#btnExport'); await a.page.waitForSelector('[data-x="zip"]');
    const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('[data-x="zip"]')]);
    const zipPath = path.join(os.tmpdir(), 'test-export.zip'); await dl.saveAs(zipPath);
    const b64 = fs.readFileSync(zipPath).toString('base64');
    const info = await a.page.evaluate(async (b) => {
      const blob = new Blob([Uint8Array.from(atob(b), (c) => c.charCodeAt(0))]);
      const ent = await window.__admin.zipRead(blob);
      return { names: ent.map((e) => e.name), json: await ent.find((e) => e.name === 'sources/projects/projects.json').blob.text() };
    }, b64);
    eq(info.json, fs.readFileSync(path.join(dir, 'sources/projects/projects.json'), 'utf8'), 'projects.json del ZIP vs disco');
    const refs = [...new Set(JSON.parse(info.json).projects.flatMap((p) => [p.file, p.cover, ...(p.files || []).map((f) => f.file)]).filter(Boolean))];
    const fileEntries = info.names.filter((n) => n !== 'sources/projects/projects.json');
    const zipB64 = await a.page.evaluate(async (b) => { const ent = await window.__admin.zipRead(new Blob([Uint8Array.from(atob(b), (c) => c.charCodeAt(0))])); const o = {}; for (const e of ent) { const u = new Uint8Array(await e.blob.arrayBuffer()); let s = ''; u.forEach((x) => { s += String.fromCharCode(x); }); o[e.name] = btoa(s); } return o; }, b64);
    for (const n of fileEntries) eq(zipB64[n], fs.readFileSync(path.join(dir, n)).toString('base64'), `contenido de ${n} en el ZIP vs disco`);
    for (const r of refs) ok(info.names.includes('sources/projects/' + r), `el ZIP no contiene ${r}`);
    return `ZIP con ${info.names.length} entradas; projects.json y ${fileEntries.length} archivos idénticos byte a byte a los de disco`;
  });
  await shared.a.close();

  /* ---------------- 11-12: errores ---------------- */
  await T('T11', 'Error de escritura de un archivo: sin mensaje de éxito y projects.json intacto; el reintento no duplica', async () => {
    let fail = true;
    const { a, dir } = await fresh({ hooks: { failOn: (kind, rel) => fail && kind === 'close' && /captura-2/.test(rel || '') } });
    const before = fs.readFileSync(path.join(dir, 'sources/projects/projects.json'), 'utf8');
    await ui.newProject(a.page, 'Con fallo', { files: files3, publish: true });
    const msg = await publishAndWait(a.page);
    ok(/NO se ha completado/.test(msg) && !/Publicado y verificado|Guardado en la carpeta/.test(msg), `mensaje: ${msg}`);
    eq(fs.readFileSync(path.join(dir, 'sources/projects/projects.json'), 'utf8'), before, 'projects.json debe seguir igual');
    ok(/error|err/.test(await a.page.getAttribute('#statusbar', 'class')), 'la barra de estado no marca error');
    fail = false;
    const msg2 = await publishAndWait(a.page);
    ok(/Publicado y verificado/.test(msg2), `reintento: ${msg2}`);
    eq(lsProject(dir, 'con-fallo'), EXPECTED3, 'archivos tras el reintento (sin duplicados)');
    eq(readJson(dir).projects.length, 1, 'catálogo tras reintentar');
    await a.close();
    return `error mostrado: «${msg.split(' | ').pop().slice(0, 140)}…»`;
  });
  await T('T11b', 'Error al escribir projects.json: catálogo anterior intacto y sin éxito', async () => {
    let fail = false;
    const { a, dir } = await fresh({ hooks: { failOn: (kind, rel) => fail && kind === 'close' && /projects\.json$/.test(rel || '') } });
    await ui.newProject(a.page, 'Uno', { files: [files3[0]], publish: true }); await publishAndWait(a.page);
    const good = fs.readFileSync(path.join(dir, 'sources/projects/projects.json'), 'utf8');
    await ui.newProject(a.page, 'Dos', { files: [files3[0]], publish: true });
    fail = true; const msg = await publishAndWait(a.page);
    ok(/NO se ha completado/.test(msg), msg);
    eq(fs.readFileSync(path.join(dir, 'sources/projects/projects.json'), 'utf8'), good, 'projects.json debe conservar el catálogo anterior');
    await a.close();
  });
  await T('T12', 'Un error o un estado desactualizado nunca sustituye el catálogo por una lista vacía', async () => {
    // a) navegador "nuevo" (IndexedDB vacío) con un catálogo ya publicado en la carpeta
    const dir = cloneProject(SRC);
    fs.writeFileSync(path.join(dir, 'sources/projects/projects.json'), JSON.stringify({ projects: [{ id: 'p-viejo', name: 'Existente', description: 'x', file: 'existente/a.txt', date: '2026-01-01' }] }, null, 2) + '\n');
    fs.mkdirSync(path.join(dir, 'sources/projects/existente'), { recursive: true }); fs.writeFileSync(path.join(dir, 'sources/projects/existente/a.txt'), 'hola');
    let a = await openAdmin({ projectDir: dir }); await ui.pick(a.page, dir);
    await ui.newProject(a.page, 'Nuevo', { files: [files3[0]], publish: true });
    await publishAndWait(a.page);
    eq(readJson(dir).projects.map((p) => p.name).sort(), ['Existente', 'Nuevo'], 'a) catálogo conservado e importado');
    // b) despublicar el último → confirmación; cancelar deja el catálogo
    await a.page.click('#list li:has-text("Existente") [data-pub]'); await a.page.click('#list li:has-text("Nuevo") [data-pub]');
    await a.page.click('#btnPublishLocal'); await a.page.waitForSelector('#cfOk', { timeout: 8000 });
    await a.page.click('#dlg [data-close]'); await sleep(400);
    eq(readJson(dir).projects.length, 2, 'b) tras cancelar el catálogo debe seguir con 2');
    // c) JSON actual corrupto → no se sobrescribe
    fs.writeFileSync(path.join(dir, 'sources/projects/projects.json'), '{ "projects": [ rotos');
    await a.page.click('#list li:has-text("Existente") [data-pub]');
    const msg = await publishAndWait(a.page);
    ok(/NO se ha completado/.test(msg) && /no es JSON válido/.test(msg), `c) ${msg}`);
    eq(fs.readFileSync(path.join(dir, 'sources/projects/projects.json'), 'utf8'), '{ "projects": [ rotos', 'c) el JSON roto no debe tocarse');
    await a.close();
    return 'a) importa y conserva · b) vaciar exige confirmación · c) JSON roto no se sobrescribe';
  });

  /* ---------------- 13: sin File System Access API / Brave ---------------- */
  await T('T13', 'Sin File System Access API: aviso claro y exportar ZIP disponible (y mensaje específico de Brave)', async () => {
    const dir = cloneProject(SRC);
    let a = await openAdmin({ projectDir: dir, noFSA: true });
    const t = await ui.statusText(a.page);
    ok(/ZIP/.test(t) && !(await a.page.$('#btnPublishLocal')), `texto: ${t}`);
    await ui.newProject(a.page, 'Solo ZIP', { files: [files3[0]], publish: true }); await sleep(600);
    const [dl] = await Promise.all([a.page.waitForEvent('download'), (async () => { await a.page.click('#btnExportZip'); await a.page.waitForSelector('[data-x="zip"]'); await a.page.click('[data-x="zip"]'); })()]);
    ok(/\.zip$/.test(dl.suggestedFilename()), 'no se descargó un ZIP');
    await a.close();
    // simulación de Brave: API ausente y navigator.brave presente
    const dir2 = cloneProject(SRC);
    const { chromium } = require('./harness.cjs');
    a = await openAdmin({ projectDir: dir2, noFSA: true });
    await a.context.addInitScript('Object.defineProperty(navigator, "brave", { value: { isBrave: async () => true }, configurable: true });');
    await a.page.reload(); await a.page.waitForSelector('#statusbar .stext');
    const tb = await ui.statusText(a.page);
    ok(/brave:\/\/flags\/#file-system-access-api/.test(tb), `mensaje Brave: ${tb}`);
    await a.close();
    return `mensaje: «${t.slice(0, 90)}…»; ZIP descargado: ${dl.suggestedFilename()}`;
  });

  /* ---------------- Extras: robustez ---------------- */
  await T('E1', 'Live Server recarga mientras se guarda: la publicación termina completa', async () => {
    const dir = cloneProject(SRC);
    const a = await openAdmin({ projectDir: dir, liveReload: true, hooks: { afterWrite: async (rel, { wsClients }) => { if (rel.startsWith('sources/projects/')) setTimeout(() => wsClients.forEach((w) => w.send('reload')), 40); } } });
    await ui.pick(a.page, dir);
    await ui.newProject(a.page, 'Laboratorio VLAN', { files: files3, publish: true });
    const navBefore = a.log.reloads;
    const msg = await publishAndWait(a.page); await sleep(800);
    eq(lsProject(dir, 'laboratorio-vlan'), EXPECTED3, 'archivos'); eq(readJson(dir).projects.length, 1, 'catálogo');
    eq(a.log.reloads - navBefore, 0, 'recargas durante la publicación');
    await a.close(); return `0 recargas; ${msg.split(' | ').pop().slice(0, 100)}`;
  });
  await T('E2', 'Recarga FORZADA a mitad de publicación: el reintento continúa sin duplicar archivos', async () => {
    const dir = cloneProject(SRC); let a; let n = 0;
    a = await openAdmin({ projectDir: dir, hooks: { afterWrite: async (rel) => { if (rel.includes('/laboratorio-vlan/') && ++n === 2) setTimeout(() => a.page.reload().catch(() => {}), 10); } } });
    await ui.pick(a.page, dir);
    await ui.newProject(a.page, 'Laboratorio VLAN', { files: files3, publish: true }); await sleep(600);
    await a.page.click('#btnPublishLocal'); await sleep(2500);
    await a.page.waitForSelector('#list li');
    ok(readJson(dir).projects.length === 0, 'el catálogo debería seguir vacío tras la interrupción');
    const parcial = lsProject(dir, 'laboratorio-vlan').length;
    await ui.pick(a.page, dir);
    const msg = await publishAndWait(a.page);
    const d = lsProject(dir, 'laboratorio-vlan');
    eq(d, EXPECTED3, 'archivos tras reanudar (sin duplicados)');
    eq(readJson(dir).projects.length, 1, 'catálogo');
    await a.close(); return `tras la interrupción: ${parcial}/3 archivos; tras reanudar: 3/3, sin duplicados`;
  });
  await T('E3', 'Carpeta incorrecta: error claro, sin crear ni renombrar carpetas', async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'par-')); fs.cpSync(SRC, path.join(parent, 'portfolio5'), { recursive: true });
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'vacia-'));
    const a = await openAdmin({ projectDir: path.join(parent, 'portfolio5') });
    const antes = fs.readdirSync(parent).join(',');
    await ui.pick(a.page, parent);
    const t1 = (await ui.toasts(a.page)).join(' | ');
    ok(/no parece la raíz/.test(t1) && /portfolio5/.test(t1), `padre: ${t1}`);
    await ui.pick(a.page, empty);
    const t2 = (await ui.toasts(a.page)).join(' | ');
    ok(/no parece la raíz/.test(t2) && /index\.html/.test(t2), `vacía: ${t2}`);
    ok(!(await ui.statusText(a.page)).includes('conectada.') || /no conectada/i.test(await ui.statusText(a.page)), 'no debería quedar conectada');
    eq(fs.readdirSync(parent).join(','), antes, 'el contenido del padre no debe cambiar'); eq(fs.readdirSync(empty).length, 0, 'la carpeta vacía no debe modificarse');
    await a.close(); return `padre → «${t1.split(' | ').pop().slice(0, 130)}…»`;
  });
  await T('E4', 'Archivo ajeno con el mismo nombre: no se sobrescribe', async () => {
    const dir = cloneProject(SRC);
    fs.mkdirSync(path.join(dir, 'sources/projects/mi-proyecto'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'sources/projects/mi-proyecto/memoria-1.txt'), 'AJENO');
    const a = await openAdmin({ projectDir: dir }); await ui.pick(a.page, dir);
    await ui.newProject(a.page, 'Mi proyecto', { files: [files3[0]], publish: true }); await publishAndWait(a.page);
    eq(fs.readFileSync(path.join(dir, 'sources/projects/mi-proyecto/memoria-1.txt'), 'utf8'), 'AJENO', 'el ajeno debe conservarse');
    ok(exists(dir, 'sources/projects/mi-proyecto/memoria-1-2.txt'), 'debe guardarse como -2');
    await a.close();
  });
  await T('E5', 'Dos proyectos modificados seguidos (<500 ms): ambos se guardan en el navegador', async () => {
    const { a } = await fresh();
    await ui.newProject(a.page, 'Alfa', { files: [files3[0]], publish: true }); await sleep(700);
    await ui.newProject(a.page, 'Beta', { files: [files3[0]], publish: true }); await sleep(700);
    await a.page.click('#list li:nth-child(1) [data-pub]'); await a.page.click('#list li:nth-child(2) [data-pub]'); await sleep(900);
    const idb = Object.fromEntries((await ui.idbProjects(a.page)).map((p) => [p.name, p.status]));
    eq(Object.entries(idb).sort(), [['Alfa', 'draft'], ['Beta', 'draft']], 'IndexedDB'); await a.close();
  });
  await T('E6', 'Carpeta equivocada (otra copia): se avisa de que el servidor no ve el cambio', async () => {
    const served = cloneProject(SRC); const other = cloneProject(SRC);
    const a = await openAdmin({ projectDir: served }); await ui.pick(a.page, other);
    await ui.newProject(a.page, 'Copia', { files: [files3[0]], publish: true }); await sleep(600);
    const msg = await publishAndWait(a.page);
    ok(/NO lo ve/.test(msg) && !/Publicado y verificado/.test(msg), msg);
    eq(readJson(served).projects.length, 0, 'la carpeta servida no cambió'); await a.close();
  });
  await T('E7', 'Web pública: distingue catálogo vacío, 404 y JSON inválido', async () => {
    const dir = cloneProject(SRC); const a = await openAdmin({ projectDir: dir });
    const pj = path.join(dir, 'sources/projects/projects.json');
    const read = async () => (await publicCards(a.base, a.browser)).empty;
    const vacio = await read();
    fs.writeFileSync(pj, '{ roto'); const json = await read();
    fs.rmSync(pj); const nf = await read();
    ok(/Aún no hay trabajos publicados/.test(vacio), 'vacío: ' + vacio);
    ok(/No se ha podido cargar/.test(json) && /JSON válido/.test(json), 'json: ' + json);
    ok(/No se ha podido cargar/.test(nf) && /404/.test(nf), '404: ' + nf);
    await a.close(); return `vacío → «${vacio.slice(0, 40)}…» | JSON roto → «${json.slice(-70)}» | 404 → «${nf.slice(-85)}»`;
  });

  const bad = results.filter((r) => !r.ok);
  console.log(`\n==== ${results.length - bad.length}/${results.length} pruebas correctas ====`);
  fs.writeFileSync(path.join(__dirname, 'ultimo-resultado.json'), JSON.stringify(results, null, 2));
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
