// Curated documentation, independent of URLs supplied by a scanned website.
const tutorials = {
  'image-alt': ['images/decision-tree/', 'Alternativtexte auswählen'],
  'input-image-alt': ['images/functional/', 'Funktionale Bilder beschriften'],
  'label': ['forms/labels/', 'Formularfelder beschriften'],
  'select-name': ['forms/labels/', 'Formularfelder beschriften'],
  'button-name': ['forms/labels/', 'Schaltflächen beschriften'],
  'heading-order': ['page-structure/headings/', 'Überschriften strukturieren'],
  'empty-heading': ['page-structure/headings/', 'Überschriften strukturieren'],
  'page-has-heading-one': ['page-structure/headings/', 'Überschriften strukturieren'],
  'region': ['page-structure/regions/', 'Seitenbereiche kennzeichnen'],
  'landmark-one-main': ['page-structure/regions/', 'Seitenbereiche kennzeichnen'],
  'td-headers-attr': ['tables/multi-level/', 'Komplexe Tabellen zuordnen'],
  'th-has-data-cells': ['tables/', 'Tabellen zugänglich gestalten'],
  'table-fake-caption': ['tables/caption-summary/', 'Tabellen beschriften']
};
const elements = new Set(('a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p picture pre progress q rp rt ruby s samp script search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr').split(' '));

export function elementReference(html = '') {
  // Inspect only the affected root element; never insert scanned markup into the DOM.
  const tag = /^\s*<([a-z][a-z0-9-]*)(?=[\s/>])/i.exec(html)?.[1].toLowerCase();
  if (!elements.has(tag)) return null;
  return { title: `HTML <${tag}> (MDN)`, url: `https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/${/^h[1-6]$/.test(tag) ? 'Heading_Elements' : tag}` };
}

export function ruleReferences(rule) {
  const links = [];
  const tutorial = tutorials[rule.id];
  if (tutorial) links.push({ title: `W3C WAI: ${tutorial[1]}`, url: `https://www.w3.org/WAI/tutorials/${tutorial[0]}` });
  if (rule.id === 'color-contrast') links.push({ title: 'W3C: Kontrast verstehen', url: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html' });
  if (rule.id === 'link-name') links.push({ title: 'W3C: Verständliche Linktexte', url: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html' });
  for (const node of rule.nodes ?? []) {
    const link = elementReference(node.html);
    if (link && !links.some(existing => existing.url === link.url)) links.push(link);
  }
  return links;
}
