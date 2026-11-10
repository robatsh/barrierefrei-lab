import test from 'node:test';
import assert from 'node:assert/strict';
import { elementReference, ruleReferences } from '../../desktop/ui/references.js';

test('references inspect only known root elements and never use scanned URLs', () => {
  assert.equal(elementReference('<IMG src="https://example.org">').title, 'HTML <img> (MDN)');
  assert.equal(elementReference('<h2>Title</h2>').url.endsWith('/Heading_Elements'), true);
  for (const html of ['<custom-element><img></custom-element>', 'plain text', '<img-malicious>', '<svg></svg>']) {
    assert.equal(elementReference(html), null);
  }
  const links = ruleReferences({ id: 'image-alt', helpUrl: 'javascript:alert(1)', nodes: [{ html: '<img>' }, { html: '<img>' }] });
  assert.equal(links.length, 2);
  assert.equal(links[0].url, 'https://www.w3.org/WAI/tutorials/images/decision-tree/');
  assert.deepEqual(ruleReferences({ id: 'unknown', nodes: [] }), []);
});
