import http from 'node:http';
import { pathToFileURL } from 'node:url';

export function createFixtureServer({ robotsHandler } = {}) {
  return http.createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/robots.txt') {
      if (robotsHandler) return robotsHandler(req, res);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('User-agent: *\nDisallow: /private\n');
    }
    if (path === '/redirect') { res.writeHead(302, { Location: '/good' }); return res.end(); }
    if (path === '/external-redirect') { res.writeHead(302, { Location: 'http://localhost:1/outside' }); return res.end(); }
    if (path === '/missing') { res.writeHead(404); return res.end('Missing'); }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (path === '/good') return res.end(`<!doctype html><html lang="de"><head><title>Gute Testseite</title></head><body><main><h1>Kontakt</h1><p>Eine kleine Testseite.</p><label for="email">E-Mail</label><input id="email" type="email"><button>Absenden</button><a href="/">Startseite</a></main></body></html>`);
    if (path === '/private') return res.end('<!doctype html><html lang="de"><head><title>robots-gesperrte Testseite</title></head><body><main><h1>Auch bei Disallow prüfen</h1></main></body></html>');
    return res.end(`<!doctype html><html><head><title>Fehlerhafte Testseite</title></head><body><main><h1>Beispiel mit Fehlern</h1><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"><button></button><input type="text"><p style="color:#aaa;background:#fff">Text mit schwachem Kontrast</p><a href="/good">Kontakt</a><a href="/good#fragment">Kontakt erneut</a><a href="/private">Privat</a><a href="/missing">Fehlende Seite</a><a href="mailto:test@example.org">E-Mail</a></main></body></html>`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createFixtureServer();
  server.listen(4179, '127.0.0.1', () => console.log('Testwebsite: http://127.0.0.1:4179'));
}
