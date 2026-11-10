import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, coverageFor } from '../src/coverage.mjs';

test('catalog includes WCAG A/AA, EN web additions and document clauses without void clauses', () => {
  assert.equal(catalog.filter(c => c.standard === 'WCAG 2.1').length, 50);
  assert.equal(new Set(catalog.map(c => `${c.standard}:${c.id}`)).size, catalog.length);
  for (const id of ['5.3', '6.2.3.d', '7.1.5', '9.6', '10.1.4.10', '10.4.1.3', '11.8.5', '12.2.4']) assert.ok(catalog.some(c => c.id === id), id);
  for (const id of ['10.2.4.1', '10.2.4.5', '10.3.2.3', '10.3.2.4']) assert.ok(!catalog.some(c => c.id === id), id);
});

test('absence of findings never implies conformance; web findings do not pass documents', () => {
  const clean = coverageFor([]);
  assert.ok(clean.every(c => c.status === 'unreviewed'));
  const pages = [{ url: 'https://example.org', violations: [{ id: 'image-alt', tags: ['wcag111'], nodes: [{}] }], incomplete: [{ id: 'contrast', tags: ['wcag143'], nodes: [{}] }] }];
  const coverage = coverageFor(pages);
  assert.equal(coverage.find(c => c.id === '1.1.1').status, 'failed');
  assert.equal(coverage.find(c => c.id === '1.4.3').status, 'unreviewed');
  assert.equal(coverage.find(c => c.id === '10.1.1.1').status, 'unreviewed');
  assert.equal(coverage.find(c => c.id === '1.1.1').findings[0].ruleId, 'image-alt');
});
