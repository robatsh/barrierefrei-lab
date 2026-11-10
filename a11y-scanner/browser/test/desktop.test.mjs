import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import axe from 'axe-core';
import { createFixtureServer } from '../fixtures/server.mjs';

test('Windows native Tauri: real IPC scan, filter and export', { timeout: 120000, skip: process.platform !== 'win32' }, async t => {
  const root = new URL('../../', import.meta.url);
  const fixture = createFixtureServer(); fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  t.after(() => new Promise(resolve => fixture.close(resolve)));
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const portProbe = createServer(); portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening');
  const debugPort = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  const binary = process.env.A11Y_DESKTOP ?? fileURLToPath(new URL('target/debug/a11y-desktop.exe', root));
  const app = spawn(binary, [], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort}`,
    WEBVIEW2_USER_DATA_FOLDER: fileURLToPath(new URL(`reports/webview-test-${debugPort}/`, root))
  } });
  let logs = '';
  app.stdout.on('data', b => { logs += b; }); app.stderr.on('data', b => { logs += b; });
  let spawnError; app.on('error', error => { spawnError = error; });
  t.after(() => { app.kill(); });
  let browser;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    if (app.exitCode !== null) throw new Error(`App beendet: ${app.exitCode}\n${logs}`);
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`, { timeout: 1000 }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 300)); }
  }
  assert.ok(browser, `WebView2 nicht erreichbar: ${logs}`);
  t.after(() => browser.close());
  const context = browser.contexts()[0];
  let page;
  for (let attempt = 0; attempt < 50; attempt++) {
    page = context.pages().find(p => /tauri|localhost|127\.0\.0\.1/.test(p.url()));
    if (page && await page.locator('#scan-form').count()) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(page, `Scanner-WebView fehlt: ${context.pages().map(p => p.url()).join(', ')}; App-Exitcode: ${app.exitCode}; ${logs}`);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.locator('.app-nav [data-view=scan]').click();
  await page.getByText('Erweiterte Einstellungen', { exact: true }).click();
  await page.locator('#url').fill(origin);
  await page.locator('#max-pages').fill('5');
  await page.locator('#start').click();
  await page.locator('#dashboard').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('.app-nav [data-view=improvements]').click();
  await page.getByText('Technische Befunde nach Seite', { exact: true }).click();
  await page.locator('#results').waitFor({ state: 'visible', timeout: 60000 });
  assert.match(await page.locator('#status').innerText(), /3 Seiten geprüft, 1 Fehlerseiten/);
  assert.equal(await page.locator('.page').count(), 4);
  assert.ok(await page.locator('.finding').count() > 0);
  await page.locator('.page > summary').first().click();
  await page.locator('.finding summary').first().click();
  assert.ok(await page.locator('.finding[open] pre').count() > 0);
  await page.locator('#filter').selectOption('incomplete');
  assert.equal(await page.locator('.finding:not(.review)').count(), 0);
  await page.locator('#filter').selectOption('all');
  assert.equal(await page.locator('.criterion').count(), 10);
  await page.locator('.app-nav [data-view=checklist]').click();
  await page.getByText(/Vollst.*ndiger.*Nachweise/).click();
  await page.locator('#criteria-search').fill('2.1.1');
  await page.locator('#standard-filter').selectOption('WCAG 2.1');
  await page.locator('.criterion > summary').click();
  await page.locator('.criterion textarea').fill('Tastaturprüfung der Stichprobe durchgeführt.');
  await page.locator('.criterion select').selectOption('passed');
  assert.match(await page.locator('.criterion > summary').innerText(), /Manuell erfüllt/);
  await page.locator('#criteria-search').fill('');
  await page.locator('#standard-filter').selectOption('all');
  const snapshot = await page.evaluate(async () => {
    const r = await window.__TAURI__.core.invoke('scan_website', { request: { startUrl: document.getElementById('url').value, maxPages: 1, maxDepth: 0, timeoutMs: 10000, settleMs: 0, delayMs: 0 } });
    const html = await window.__TAURI__.core.invoke('html_report', { report: r });
    return { version: r.schemaVersion, html };
  });
  assert.equal(snapshot.version, '1.0'); assert.match(snapshot.html, /&lt;img/);
  for (const format of ['json', 'html']) {
    const downloading = page.waitForEvent('download', { timeout: 10000 });
    await page.locator(`#export-${format}`).click();
    const download = await downloading;
    assert.equal(download.suggestedFilename(), `report.${format}`);
    await download.saveAs(fileURLToPath(new URL(`reports/desktop-export.${format}`, root)));
    const saved = await readFile(new URL(`reports/desktop-export.${format}`, root), 'utf8');
    if (format === 'json') {
      const manual = JSON.parse(saved).coverage.find(c => c.id === '2.1.1' && c.standard === 'WCAG 2.1');
      assert.equal(manual.status, 'passed');
      assert.match(manual.notes, /Tastaturprüfung/);
    } else assert.match(saved, /Manuell als erfüllt bewertet/);
  }
  // Check the scanner UI itself using axe through the debugging protocol.
  await page.evaluate(axe.source);
  const audit = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
  assert.deepEqual(audit.violations.map(r => r.id), [], 'Scanner UI accessibility');
  assert.deepEqual(errors, []);
  await mkdir(new URL('../../docs/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../../docs/desktop.png', import.meta.url)), fullPage: true });
});
