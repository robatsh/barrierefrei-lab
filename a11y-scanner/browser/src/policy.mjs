export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
export const USER_AGENT = 'A11yScanner/0.1';

export function normalizeUrl(raw, base) {
  const url = new URL(raw, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Nur HTTP(S)-URLs ohne Zugangsdaten sind erlaubt.');
  }
  url.hash = '';
  return url.href;
}

export function validateRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('JSON-Objekt erwartet.');
  const startUrl = normalizeUrl(input.startUrl);
  const defaults = { maxPages: 10, maxDepth: 2, timeoutMs: 15000, settleMs: 300, delayMs: 200 };
  const ranges = { maxPages: [1, 100], maxDepth: [0, 5], timeoutMs: [1000, 60000], settleMs: [0, 5000], delayMs: [0, 5000] };
  const request = { startUrl };
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = input[key] ?? fallback;
    const [min, max] = ranges[key];
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key}: Ganzzahl zwischen ${min} und ${max} erwartet.`);
    request[key] = value;
  }
  return request;
}

const hints = {
  'image-alt': 'Inhaltlichen Bildern einen passenden Alternativtext geben; rein dekorative Bilder mit alt="" kennzeichnen.',
  'button-name': 'Dem Button einen verständlichen sichtbaren Text oder einen passenden zugänglichen Namen geben.',
  'link-name': 'Den Zweck des Links durch einen verständlichen Linktext oder zugänglichen Namen beschreiben.',
  label: 'Das Eingabefeld mit einem sichtbaren label und passender for/id-Zuordnung verbinden.',
  'color-contrast': 'Text- und Hintergrundfarbe so anpassen, dass der erforderliche Kontrast erreicht wird; alle Zustände prüfen.',
  'html-has-lang': 'Die hauptsächliche Seitensprache im lang-Attribut des html-Elements angeben.',
  'document-title': 'Einen aussagekräftigen, seitenspezifischen title ergänzen.',
  region: 'Seiteninhalte in passende Landmarken wie main, nav oder header einordnen.'
};

export function mapRule(rule) {
  return {
    id: rule.id, impact: rule.impact ?? null, help: rule.help,
    description: rule.description, helpUrl: rule.helpUrl, tags: rule.tags,
    suggestion: hints[rule.id] ?? 'Die Regelbeschreibung und die Hinweise am Element prüfen; eine passende Korrektur umsetzen und erneut testen.',
    nodes: rule.nodes.map(node => ({
      target: node.target, html: node.html, failureSummary: node.failureSummary ?? '',
      checks: [...node.any, ...node.all, ...node.none].map(check => ({ id: check.id, message: check.message }))
    }))
  };
}

export function summarize(pages) {
  return {
    scanned: pages.filter(p => p.status === 'ok').length,
    errors: pages.filter(p => p.status === 'error').length,
    skipped: pages.filter(p => p.status === 'skipped').length,
    violationRules: pages.reduce((n, p) => n + p.violations.length, 0),
    violationNodes: pages.reduce((n, p) => n + p.violations.reduce((m, r) => m + r.nodes.length, 0), 0),
    reviewRules: pages.reduce((n, p) => n + p.incomplete.length, 0)
  };
}
