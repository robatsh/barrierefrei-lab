import { coverageFor } from './coverage.mjs';
import { chromium } from 'playwright';
import axe from 'axe-core';
import { readFileSync } from 'node:fs';
import { normalizeUrl, validateRequest, mapRule, summarize, TAGS, USER_AGENT } from './policy.mjs';

// Keep the engine's rule and check messages in the application language too.
const axeLocale = JSON.parse(readFileSync(new URL('../node_modules/axe-core/locales/de.json', import.meta.url), 'utf8'));

export async function scan(input) {
  const request = validateRequest(input);
  const startedAt = new Date().toISOString();
  // An interactive audit is user-directed. robots.txt is deliberately not fetched
  // or used as a gate, so redirects, errors and Disallow cannot stop the scan.
  let origin = new URL(request.startUrl).origin;
  let resolvingStart = true;
  let startPage = null;
  const browser = await chromium.launch({ headless: true });
  const pages = [];
  const queue = [{ url: request.startUrl, depth: 0 }];
  const discovered = new Set([request.startUrl]);
  const visited = new Set();
  let truncated = false;
  try {
    // No persisted login state. Popups and downloads do not become crawl targets.
    const context = await browser.newContext({ userAgent: USER_AGENT, serviceWorkers: 'block', acceptDownloads: false, viewport: { width: 1280, height: 900 } });
    await context.route('**/*', async route => {
      const req = route.request();
      const url = req.url();
      if (req.isNavigationRequest()) {
        try { normalizeUrl(url); } catch { return route.abort('blockedbyclient'); }
        // Follow the initial top-level redirect chain (HTTP→HTTPS, www, etc.).
        // Subsequent crawl navigation stays within the final site's origin.
        const initialRedirect = resolvingStart && req.frame() === startPage?.mainFrame();
        if (!initialRedirect && new URL(url).origin !== origin) return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    while (queue.length && pages.length < request.maxPages) {
      const { url, depth } = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);
      const result = { url, finalUrl: null, depth, status: 'ok', httpStatus: null, title: '', error: null, violations: [], incomplete: [], passes: 0, inapplicable: 0 };
      const page = await context.newPage();
      if (resolvingStart) startPage = page;
      page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
      page.on('popup', popup => popup.close().catch(() => {}));
      page.setDefaultTimeout(request.timeoutMs);
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: request.timeoutMs });
        result.finalUrl = normalizeUrl(page.url());
        if (resolvingStart) {
          origin = new URL(result.finalUrl).origin;
          resolvingStart = false;
        }
        result.httpStatus = response?.status() ?? null;
        if (!response || !response.ok()) throw new Error(`HTTP ${result.httpStatus ?? 'ohne Antwort'}`);
        if (!(response.headers()['content-type'] ?? '').toLowerCase().includes('text/html')) throw new Error('Keine HTML-Seite.');
        if (new URL(result.finalUrl).origin !== origin) throw new Error('Weiterleitung außerhalb des erlaubten Bereichs.');
        if (result.finalUrl !== url && visited.has(result.finalUrl)) {
          result.status = 'skipped'; result.error = 'Ziel der Weiterleitung wurde bereits geprüft.';
        } else {
          visited.add(result.finalUrl);
          await page.waitForTimeout(request.settleMs);
          result.title = await page.title();
          await page.addScriptTag({ content: axe.source });
          await page.evaluate(locale => window.axe.configure({ locale }), axeLocale);
          let timer;
          const raw = await Promise.race([
            page.evaluate(tags => window.axe.run(document, {
              runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'incomplete', 'passes', 'inapplicable']
            }), TAGS),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('axe-Prüfung: Zeitlimit überschritten.')), request.timeoutMs); })
          ]).finally(() => clearTimeout(timer));
          result.violations = raw.violations.map(mapRule);
          result.incomplete = raw.incomplete.map(mapRule);
          result.passes = raw.passes.length;
          result.inapplicable = raw.inapplicable.length;
          const links = await page.locator('a[href]').evaluateAll(anchors => anchors.map(a => a.href));
          for (const link of links) {
            let next;
            try { next = normalizeUrl(link); } catch { continue; }
            if (new URL(next).origin !== origin || discovered.has(next) || visited.has(next)) continue;
            if (depth >= request.maxDepth) { truncated = true; continue; }
            // Bound queued URLs as well as visited pages to avoid huge link lists.
            if (discovered.size >= request.maxPages * 10) { truncated = true; continue; }
            discovered.add(next);
            queue.push({ url: next, depth: depth + 1 });
          }
        }
      } catch (error) {
        result.status = 'error';
        const message = String(error.message ?? error);
        if (/^(HTTP |Keine HTML-Seite\.|Weiterleitung außerhalb|axe-Prüfung:)/u.test(message)) {
          result.error = message;
        } else if (/timeout|time limit/i.test(message)) {
          result.error = 'Das Zeitlimit zum Laden oder Prüfen der Seite wurde überschritten.';
        } else {
          result.error = 'Die Seite konnte nicht geladen oder geprüft werden.';
        }
        // Preserve the browser diagnostic in worker logs, outside the UI copy.
        console.error(message);
        result.violations = []; result.incomplete = [];
      } finally {
        resolvingStart = false;
        await page.close();
      }
      pages.push(result);
      if (queue.length) await new Promise(resolve => setTimeout(resolve, request.delayMs));
    }
    truncated ||= queue.some(item => !visited.has(item.url));
  } finally {
    await browser.close();
  }
  return {
    schemaVersion: '1.0', tool: { name: 'A11yScanner', version: '0.1.0', axeVersion: axe.version },
    startedAt, finishedAt: new Date().toISOString(), request,
    scope: { origin, tags: TAGS, viewport: { width: 1280, height: 900 }, robotsPolicy: 'ignored', robotsExcluded: [], truncated },
    summary: summarize(pages), pages, coverage: coverageFor(pages),
    limitations: [
      'Automatische Momentaufnahme; kein Nachweis vollständiger WCAG-Konformität.',
      'Tastaturbedienung, Screenreader, sinnvolle Texte und komplette Nutzerabläufe manuell prüfen.',
      'Nur entdeckte HTML-Links derselben Website; keine Anmeldung, Formularaktionen, Seitenverzeichnisse oder Navigation durch Anwendungszustände.',
      'Eine Ansicht für Computer; dynamische Inhalte nur nach der eingestellten Wartezeit. Eingebettete Seiten anderer Websites können unvollständig sein.'
    ]
  };
}
