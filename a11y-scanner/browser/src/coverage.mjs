import { readFileSync } from 'node:fs';

export const catalog = JSON.parse(readFileSync(new URL('../../desktop/ui/criteria.json', import.meta.url), 'utf8'));

// A matching axe rule covers only part of a success criterion. Even a clean
// result must remain open for human review; absence of a finding is not a pass.
export function coverageFor(pages) {
  return catalog.map(criterion => {
    const tag = `wcag${criterion.id.replaceAll('.', '')}`;
    const findings = pages.flatMap(page => ['violations', 'incomplete'].flatMap(kind =>
      page[kind].filter(rule => criterion.standard === 'WCAG 2.1' && rule.tags.includes(tag))
        .map(rule => ({ url: page.url, ruleId: rule.id, kind, nodes: rule.nodes.length }))));
    return { ...criterion, status: findings.some(f => f.kind === 'violations') ? 'failed' : 'unreviewed', notes: '', findings };
  });
}
