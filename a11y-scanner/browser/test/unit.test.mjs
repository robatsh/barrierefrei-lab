import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, validateRequest, mapRule, summarize } from '../src/policy.mjs';

test('URL normalization preserves query but removes fragments and rejects credentials', () => {
  assert.equal(normalizeUrl('/a?q=2#x', 'https://example.org'), 'https://example.org/a?q=2');
  assert.equal(normalizeUrl('https://EXAMPLE.org:443'), 'https://example.org/');
  for (const url of ['file:///tmp/x', 'mailto:a@b.de', 'https://user:pass@example.org']) assert.throws(() => normalizeUrl(url));
});
test('request boundaries reject invalid or expensive scans', () => {
  assert.equal(validateRequest({ startUrl: 'http://localhost' }).maxPages, 10);
  for (const extra of [{ maxPages: 0 }, { maxPages: 101 }, { maxDepth: 6 }, { timeoutMs: 999 }, { settleMs: -1 }, { delayMs: 0.5 }]) {
    assert.throws(() => validateRequest({ startUrl: 'https://example.org', ...extra }));
  }
});
test('axe mapping preserves nested selectors and check messages', () => {
  const rule = mapRule({ id: 'image-alt', help: 'Alt', description: 'Missing alt', helpUrl: 'https://example.org/rule', tags: ['wcag2a'], impact: 'critical', nodes: [{ target: [['iframe', '#photo']], html: '<img>', any: [{ id: 'alt', message: 'Missing alt' }], all: [], none: [] }] });
  assert.deepEqual(rule.nodes[0].target, [['iframe', '#photo']]);
  assert.equal(rule.nodes[0].checks[0].message, 'Missing alt');
  assert.match(rule.suggestion, /Alternativtext/);
});
test('summary counts rule occurrences per page separately from nodes', () => {
  assert.deepEqual(summarize([
    { status: 'ok', violations: [{ nodes: [1, 2] }], incomplete: [1] },
    { status: 'error', violations: [], incomplete: [] },
    { status: 'skipped', violations: [], incomplete: [] }
  ]), { scanned: 1, errors: 1, skipped: 1, violationRules: 1, violationNodes: 2, reviewRules: 1 });
});
