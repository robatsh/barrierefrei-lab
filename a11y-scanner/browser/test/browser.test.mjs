import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import Ajv from 'ajv';
import { scan } from '../src/scan.mjs';
import { createFixtureServer } from '../fixtures/server.mjs';

test('real Chromium: axe, crawl scope, errors, limits, robots and JSON protocol', { timeout: 120000 }, async t => {
  const server = createFixtureServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise(resolve => server.close(resolve)));
  const input = { startUrl: origin, maxPages: 10, maxDepth: 2, timeoutMs: 10000, settleMs: 100, delayMs: 0 };
  const report = await scan(input);
  assert.equal(report.summary.scanned, 3);
  assert.equal(report.summary.errors, 1);
  assert.equal(report.pages.length, 4);
  assert.equal(report.pages.filter(p => p.url === `${origin}/good`).length, 1);
  assert.equal(report.pages.find(p => p.url.endsWith('/private')).status, 'ok');
  assert.deepEqual(report.scope.robotsExcluded, []);
  assert.equal(report.scope.robotsPolicy, 'ignored');
  const ids = report.pages[0].violations.map(r => r.id);
  for (const id of ['image-alt', 'button-name', 'label', 'html-has-lang']) assert.ok(ids.includes(id), id);
  const imageRule = report.pages[0].violations.find(rule => rule.id === 'image-alt');
  assert.match(imageRule.help, /Alternativtext|alternativen Text/i);
  assert.doesNotMatch(imageRule.description, /Ensures|must have/);
  assert.doesNotMatch(imageRule.nodes[0].failureSummary, /Fix any|Fix all/);
  assert.equal(report.pages.find(p => p.url.endsWith('/good')).violations.length, 0);
  const schema = JSON.parse(await readFile(new URL('../../schema/report.schema.json', import.meta.url), 'utf8'));
  const validate = new Ajv({ strict: true }).compile(schema);
  assert.ok(validate(report), JSON.stringify(validate.errors));
  const limited = await scan({ ...input, maxPages: 1 });
  assert.equal(limited.pages.length, 1); assert.equal(limited.scope.truncated, true);
  const depthLimited = await scan({ ...input, maxDepth: 0 });
  assert.equal(depthLimited.pages.length, 1); assert.equal(depthLimited.scope.truncated, true);
  const redirected = await scan({ ...input, startUrl: `${origin}/external-redirect`, maxPages: 1 });
  assert.equal(redirected.summary.errors, 1);
  const formerlyBlocked = await scan({ ...input, startUrl: `${origin}/private` });
  assert.equal(formerlyBlocked.summary.scanned, 1); assert.equal(formerlyBlocked.summary.skipped, 0);
  const redirectOk = await scan({ ...input, startUrl: `${origin}/redirect`, maxPages: 1 });
  assert.equal(redirectOk.pages[0].finalUrl, `${origin}/good`);
  assert.equal(redirectOk.summary.scanned, 1);
  // A desktop shortcut or relocated executable can start outside the workspace.
  const child = spawn(process.execPath, [fileURLToPath(new URL('../src/worker.mjs', import.meta.url))], { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
  child.stdin.end(JSON.stringify({ ...input, maxPages: 1 }));
  const [code] = await once(child, 'close');
  assert.equal(code, 0, stderr); assert.equal(JSON.parse(stdout).summary.scanned, 1);
  if (process.env.A11Y_WRITE_EXAMPLE === '1') {
    const dir = new URL('../../examples/', import.meta.url);
    await mkdir(dir, { recursive: true });
    await writeFile(new URL('report.json', dir), JSON.stringify(report, null, 2));
  }
});

test('robots.txt 301, 403, 500, loop, timeout and Disallow never gate a scan', { timeout: 120000 }, async t => {
  for (const mode of ['301', '403', '500', 'loop', 'timeout', 'disallow']) {
    await t.test(mode, async () => {
      let robotsRequests = 0;
      const server = createFixtureServer({ robotsHandler: (_req, res) => {
        robotsRequests++;
        if (mode === 'timeout') return;
        if (mode === '301' || mode === 'loop') { res.writeHead(301, { Location: '/robots.txt' }); return res.end(); }
        if (mode === 'disallow') return res.end('User-agent: *\nDisallow: /\n');
        res.writeHead(Number(mode)); res.end('Unavailable');
      } });
      server.listen(0, '127.0.0.1'); await once(server, 'listening');
      try {
        const report = await scan({ startUrl: `http://127.0.0.1:${server.address().port}/good`, maxPages: 1, settleMs: 0 });
        assert.equal(report.summary.scanned, 1, mode);
        assert.equal(report.scope.robotsPolicy, 'ignored');
        assert.equal(robotsRequests, 0, 'robots.txt must not be a network prerequisite');
      } finally { await new Promise(resolve => server.close(resolve)); }
    });
  }
});

test('initial cross-origin redirect establishes the crawl origin; later redirects cannot escape', { timeout: 60000 }, async t => {
  const outside = createFixtureServer(); outside.listen(0, '127.0.0.1'); await once(outside, 'listening');
  const outsideOrigin = `http://127.0.0.1:${outside.address().port}`;
  const destination = http.createServer((req, res) => {
    if (req.url === '/escape') { res.writeHead(302, { Location: `${outsideOrigin}/good` }); return res.end(); }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html lang="de"><head><title>Ziel</title></head><body><main><h1>Ziel</h1><a href="/escape">Externe Weiterleitung</a></main></body></html>');
  });
  destination.listen(0, '127.0.0.1'); await once(destination, 'listening');
  const finalOrigin = `http://127.0.0.1:${destination.address().port}`;
  const entry = http.createServer((_req, res) => { res.writeHead(301, { Location: finalOrigin }); res.end(); });
  entry.listen(0, '127.0.0.1'); await once(entry, 'listening');
  t.after(async () => { for (const server of [entry, destination, outside]) await new Promise(resolve => server.close(resolve)); });
  const report = await scan({ startUrl: `http://127.0.0.1:${entry.address().port}`, maxPages: 3, settleMs: 0, delayMs: 0 });
  assert.equal(report.scope.origin, finalOrigin);
  assert.equal(report.pages[0].finalUrl, `${finalOrigin}/`);
  assert.equal(report.pages[0].status, 'ok');
  assert.equal(report.pages[1].url, `${finalOrigin}/escape`);
  assert.equal(report.pages[1].status, 'error');
});
