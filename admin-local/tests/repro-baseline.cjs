/* Reproduce los fallos sobre el código ORIGINAL. Uso: node repro-baseline.cjs <carpeta-proyecto> */
const fs = require('fs'); const path = require('path');
const { openAdmin, cloneProject, sleep, readJson, exists, makeFiles } = require('./harness.cjs');
const ui = require('./ui.cjs');
const src = path.resolve(process.argv[2] || '../..');
const res = [];
const note = (id, title, ok, detail) => { res.push({ id, ok }); console.log(`${ok ? 'OK  ' : 'FALLO'} ${id} ${title}\n      ${detail}`); };

(async () => {
  /* R1: Live Server recarga la página al escribir el primer archivo → publicación abortada */
  {
    const dir = cloneProject(src);
    const a = await openAdmin({ projectDir: dir, liveReload: true, hooks: { afterWrite: async (rel, { wsClients }) => { if (rel.startsWith('sources/projects/')) setTimeout(() => wsClients.forEach((w) => w.send('reload')), 40); } } });
    const files = makeFiles(3);
    await ui.pick(a.page, dir);
    await ui.newProject(a.page, 'Laboratorio VLAN', { files, publish: true });
    await sleep(700);
    await ui.publish(a.page, { settle: 2500 });
    const onDisk = fs.readdirSync(path.join(dir, 'sources/projects')).filter((n) => n !== 'projects.json');
    const filesOnDisk = onDisk.flatMap((d) => fs.statSync(path.join(dir, 'sources/projects', d)).isDirectory() ? fs.readdirSync(path.join(dir, 'sources/projects', d)) : []);
    const json = readJson(dir);
    note('R1', 'Recarga automática de Live Server durante «Guardar y publicar»', json.projects.length === 0 && filesOnDisk.length < 3,
      `recargas=${a.log.reloads - 1}; archivos en disco=${filesOnDisk.length}/3 (${filesOnDisk.join(', ')}); projects.json con ${json.projects.length} proyectos`);
    // reintento: ¿se duplican los archivos?
    await ui.pick(a.page, dir); await sleep(300);
    const p2 = await ui.idbProjects(a.page);
    note('R1b', 'Estado `written` tras la recarga', p2.every((p) => p.files.every((f) => f.written)) === false,
      `banderas written en IndexedDB: ${JSON.stringify(p2.map((p) => p.files.map((f) => f.written)))}`);
    await a.close();
  }
  /* R2: guardado con temporizador único: se pierde el cambio del primer proyecto */
  {
    const dir = cloneProject(src);
    const a = await openAdmin({ projectDir: dir });
    const files = makeFiles(1);
    await ui.pick(a.page, dir);
    for (const n of ['Alfa', 'Beta']) { await ui.newProject(a.page, n, { files, publish: true }); await sleep(700); }
    // Despublicar ambos con clics reales en la lista, uno tras otro en < 500 ms
    await a.page.click('#list li:nth-child(1) [data-pub]');
    await a.page.click('#list li:nth-child(2) [data-pub]');
    await sleep(1000);
    const idb = Object.fromEntries((await ui.idbProjects(a.page)).map((p) => [p.name, p.status]));
    const mem = Object.fromEntries(await a.page.evaluate(() => window.__admin.state.projects.map((p) => [p.name, p.status])));
    note('R2', 'Despublicar dos proyectos seguidos (<500 ms)', JSON.stringify(idb) !== JSON.stringify(mem),
      `en pantalla: ${JSON.stringify(mem)}; persistido en IndexedDB: ${JSON.stringify(idb)}`);
    await a.close();
  }
  /* R3: carpeta equivocada (otra copia del proyecto) → éxito aparente, la web servida no cambia */
  {
    const served = cloneProject(src); const other = cloneProject(src);
    const a = await openAdmin({ projectDir: served, serveDir: served });
    await ui.pick(a.page, other);
    await ui.newProject(a.page, 'Proyecto copia', { files: makeFiles(1), publish: true });
    await sleep(700); await ui.publish(a.page, { settle: 1800 });
    const msg = (await ui.toasts(a.page)).join(' | ');
    const servedJson = readJson(served).projects.length; const otherJson = readJson(other).projects.length;
    note('R3', 'Carpeta seleccionada distinta de la que sirve el servidor', /Publicado en local/.test(msg) && servedJson === 0 && otherJson === 1,
      `mensaje: «${msg}»; projects.json servido: ${servedJson} proyectos; en la carpeta elegida: ${otherJson}`);
    await a.close();
  }
  console.log(`\n${res.filter((r) => r.ok).length}/${res.length} fallos reproducidos`);
})().catch((e) => { console.error(e); process.exit(1); });
