/* Ayudas para manejar la interfaz real del administrador */
const { sleep } = require('./harness.cjs');

async function pick(page, dir) {
  await page.evaluate((d) => { window.__pickTarget = d; }, dir);
  await page.click('#btnPickDir');
  await page.waitForFunction(() => /conectada|no parece|falta/i.test(document.querySelector('#statusbar .stext')?.textContent + document.querySelector('#toasts')?.textContent), null, { timeout: 8000 });
  await sleep(200);
}
async function newProject(page, name, { files = [], publish = false } = {}) {
  await page.click('#btnNew');
  await page.fill('#fName', name);
  if (files.length) { await page.setInputFiles('#fileInput', files); await page.waitForSelector('#flist li[data-fid]'); await sleep(150); }
  if (publish) await page.check('#fPub');
}
async function statusText(page) { return (await page.textContent('#statusbar .stext')) || ''; }
async function toasts(page) { return page.$$eval('#toasts .toast', (n) => n.map((x) => x.textContent)); }
async function publish(page, { settle = 1500 } = {}) {
  await page.click('#btnPublishLocal');
  await sleep(settle);
}
async function idbProjects(page) {
  return page.evaluate(() => new Promise((res, rej) => {
    const r = indexedDB.open('portfolio-admin');
    r.onsuccess = () => { const t = r.result.transaction('projects'); const q = t.objectStore('projects').getAll(); q.onsuccess = () => res(q.result.map((p) => ({ id: p.id, name: p.name, status: p.status, dir: p.dir, files: p.files.map((f) => ({ fileName: f.fileName, written: !!f.written })) }))); q.onerror = () => rej(q.error); };
    r.onerror = () => rej(r.error);
  }));
}
module.exports = { pick, newProject, statusText, toasts, publish, idbProjects };
