import test from 'node:test';
import assert from 'node:assert/strict';
import { t, label, locale } from '../../desktop/ui/i18n.js';

test('German is explicit and protocol values have German display labels', () => {
  assert.equal(locale, 'de-DE');
  assert.equal(label('pageStatus', 'ok'), 'Geprüft');
  assert.equal(label('pageStatus', 'skipped'), 'Übersprungen');
  assert.equal(label('impact', 'critical'), 'Sehr hoch');
  assert.equal(label('impact', null), 'Ohne Gewichtung');
  assert.equal(label('impact', 'future-value'), 'Unbekannt');
});

test('interpolation preserves zero values and never interprets inserted text as markup', () => {
  assert.equal(t('text149', { 0: '<script>{1}</script>' }), 'Weitergeleitet zu: <script>{1}</script>');
  assert.match(t('text146', { 0: 0, 1: 1, 2: 1 }), /^0 passende Seiten/);
  assert.throws(() => t('missing-message'), /Unbekannter Textschlüssel/);
});
