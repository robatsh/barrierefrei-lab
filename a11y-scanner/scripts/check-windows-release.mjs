import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createFixtureServer } from '../browser/fixtures/server.mjs';

const release = resolve(process.argv[2] ?? 'dist/A11y-Scanner-Windows-x64');
const output = resolve('reports/release-smoke');
await mkdir(output, { recursive: true });
const server = createFixtureServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const child = spawn(join(release, 'a11y.exe'), [
    `http://127.0.0.1:${server.address().port}/good`, '--max-pages', '1',
    '--settle-ms', '0', '--output', output,
  ], {
    cwd: output, windowsHide: true,
    env: { ...process.env, PATH: process.env.SystemRoot + '\\System32',
      A11Y_NODE: join(release, 'runtime/node.exe'),
      A11Y_WORKER: join(release, 'browser/src/worker.mjs'),
      PLAYWRIGHT_BROWSERS_PATH: join(release, 'browsers') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', b => { logs += b; });
  child.stderr.on('data', b => { logs += b; });
  const [code] = await once(child, 'close');
  assert.equal(code, 0, logs);
  const report = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));
  assert.equal(report.summary.scanned, 1);
  assert.ok((await readFile(join(output, 'report.html'), 'utf8')).includes('<html'));
  console.log('Release scan passed with packaged Node, worker and Chromium; no developer tools on PATH.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
