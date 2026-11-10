import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile, mkdir, mkdtemp, copyFile, symlink, rm } from 'node:fs/promises';
import { createFixtureServer } from '../fixtures/server.mjs';

const root = new URL('../../', import.meta.url);
const binary = process.env.A11Y_CLI ? resolve(process.env.A11Y_CLI) : fileURLToPath(new URL(`target/debug/a11y${process.platform === 'win32' ? '.exe' : ''}`, root));
async function cli(args, executable = binary, env = process.env) {
  const child = spawn(executable, args, { cwd: tmpdir(), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
  const [code] = await once(child, 'close');
  return { code, output };
}

test('Rust CLI: real worker, files, errors and CI threshold', { timeout: 120000 }, async t => {
  const server = createFixtureServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const output = fileURLToPath(new URL('reports/cli-test/', root));
  await mkdir(output, { recursive: true });
  const common = ['--output', output, '--settle-ms', '0', '--delay-ms', '0'];
  const bad = await cli([origin, '--max-pages', '1', '--fail-on', 'serious', ...common]);
  assert.equal(bad.code, 3, bad.output);
  const report = JSON.parse(await readFile(`${output}/report.json`, 'utf8'));
  assert.equal(report.summary.scanned, 1); assert.ok(report.summary.violationNodes > 0);
  const html = await readFile(`${output}/report.html`, 'utf8');
  assert.match(html, /&lt;img/); assert.ok(!html.includes('<img src='));
  const good = await cli([`${origin}/good`, '--max-pages', '1', '--fail-on', 'minor', ...common]);
  assert.equal(good.code, 0, good.output);
  const mixed = await cli([origin, '--max-pages', '5', ...common]);
  assert.equal(mixed.code, 2, mixed.output);
  const invalid = await cli(['file:///tmp/no.html', ...common]);
  assert.equal(invalid.code, 1, invalid.output);

  // Copy the built executable so its compile-time workspace path cannot mask
  // runtime discovery. Spaces and a foreign cwd reproduce a folder move.
  const relocated = await mkdtemp(join(tmpdir(), 'a11y moved project '));
  assert.equal(dirname(relocated), resolve(tmpdir()));
  t.after(() => rm(relocated, { recursive: true, force: true }));
  const binDir = join(relocated, 'target', 'debug');
  await mkdir(binDir, { recursive: true });
  const movedBinary = join(binDir, `a11y${process.platform === 'win32' ? '.exe' : ''}`);
  await copyFile(binary, movedBinary);
  await symlink(fileURLToPath(new URL('browser/', root)), join(relocated, 'browser'), process.platform === 'win32' ? 'junction' : 'dir');
  const env = { ...process.env };
  delete env.A11Y_WORKER;
  const moved = await cli([`${origin}/good`, '--max-pages', '1', ...common], movedBinary, env);
  assert.equal(moved.code, 0, moved.output);
});
