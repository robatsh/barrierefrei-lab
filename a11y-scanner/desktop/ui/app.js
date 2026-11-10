import { t, label, locale, localizeDocument } from './i18n.js';
import { elementReference, ruleReferences } from './references.js';

localizeDocument();
let report = null;
let pageOffset = 0;
let criteriaOffset = 0;
const pageSize = 5;
const criteriaSize = 10;
const $ = id => document.getElementById(id);
const invoke = (command, args) => {
  if (!window.__TAURI__?.core?.invoke) throw new Error(t('text070'));
  return window.__TAURI__.core.invoke(command, args);
};

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function referenceLinks(links) {
  const list = element('ul', undefined, 'references');
  for (const { title, url } of links) {
    const item = element('li');
    const link = element('a', title);
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.addEventListener('click', async event => {
      if (!window.__TAURI__?.core?.invoke) return;
      event.preventDefault();
      try { await invoke('open_documentation', { url }); }
      catch { window.alert(t('error.documentation')); }
    });
    item.append(link); list.append(item);
  }
  return list;
}
function affectedElement(node) {
  // Template contents stay inert; scanned markup is never attached to the page.
  const template = document.createElement('template');
  template.innerHTML = node.html || '';
  const root = template.content.firstElementChild;
  const tag = root?.localName;
  const identity = tag ? `<${tag}>${root.id ? ` #${root.id}` : ''}` : 'Element';
  const name = root?.getAttribute('name');
  const caption = root?.getAttribute('aria-label') || root?.getAttribute('alt') || root?.getAttribute('title') || root?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 120);
  const selector = (node.target || []).flat(Infinity).join(' \u2192 ');
  return { identity, name, caption, selector };
}
function renderAffected(node) {
  const info = affectedElement(node);
  const row = element('article', undefined, 'element-card');
  row.append(element('h4', info.identity));
  if (info.name) row.append(element('p', `Name: ${info.name}`, 'element-name'));
  if (info.caption) row.append(element('p', `Beschriftung: ${info.caption}`));
  if (!info.name && !info.caption) row.append(element('p', 'Keine Beschriftung vorhanden', 'muted'));
  if (info.selector) {
    const location = element('div', undefined, 'element-location');
    const selector = element('code', info.selector);
    const copy = element('button', 'Selektor kopieren'); copy.type = 'button';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(info.selector); copy.textContent = 'Kopiert'; }
      catch { copy.textContent = 'Bitte Selektor markieren und kopieren'; }
    });
    location.append(selector, copy); row.append(location);
  }
  const technical = element('details', undefined, 'element-technical');
  technical.append(element('summary', 'HTML und Pr\u00fcfdetails'), element('pre', node.html), element('p', node.failureSummary));
  for (const check of node.checks || []) technical.append(element('p', `${check.id}: ${check.message}`));
  row.append(technical);
  return row;
}
function render() {
  const s = report.summary;
  $('summary').replaceChildren(...[
    [s.scanned, t('text071')], [s.violationNodes, t('text072')],
    [(report.coverage ?? []).filter(c => c.status === 'unreviewed').length, t('text073')], [s.errors, t('text074')]
  ].map(([count, label]) => { const card = element('div', undefined, 'metric'); card.append(element('strong', String(count)), element('span', label)); return card; }));
  $('scope-summary').textContent = t('text145', {0: (report.scope.origin), 1: (report.scope.viewport.width), 2: (report.scope.viewport.height), 3: (report.tool.axeVersion), 4: (report.scope.truncated ? t('text075') : t('text076'))});
  $('limitations').replaceChildren(...report.limitations.map(text => element('li', text)));
  const filter = $('filter').value;
  const query = $('search').value.trim().toLowerCase();
  const matches = rule => `${rule.id} ${rule.help} ${rule.description} ${rule.tags.join(' ')} ${rule.nodes.map(n => `${n.html} ${JSON.stringify(n.target)}`).join(' ')}`.toLowerCase().includes(query);
  const visiblePages = report.pages.filter(page => {
    const rules = filter === 'all' ? [...page.violations, ...page.incomplete] : page[filter];
    return (filter === 'all' || rules.length > 0) && (!query || `${page.url} ${page.title}`.toLowerCase().includes(query) || rules.some(matches));
  });
  pageOffset = Math.min(pageOffset, Math.max(0, Math.ceil(visiblePages.length / pageSize) - 1));
  $('page-count').textContent = t('text146', {0: (visiblePages.length), 1: (pageOffset + 1), 2: (Math.max(1, Math.ceil(visiblePages.length / pageSize)))});
  $('previous').disabled = pageOffset === 0;
  $('next').disabled = (pageOffset + 1) * pageSize >= visiblePages.length;
  $('pages').replaceChildren();
  if (!visiblePages.length) $('pages').append(element('p', t('text077')));
  for (const page of visiblePages.slice(pageOffset * pageSize, (pageOffset + 1) * pageSize)) {
    const section = element('details', undefined, 'page');
    section.append(element('summary', t('text147', {0: (page.title || page.url), 1: (page.violations.length), 2: (page.incomplete.length), 3: (label('pageStatus', page.status))})));
    section.append(element('h3', page.title || t('text078')), element('code', page.url));
    section.append(element('p', t('text148', {0: (label('pageStatus', page.status)), 1: (page.httpStatus ?? '–'), 2: (page.violations.length)}), 'page-status'));
    if (page.finalUrl && page.finalUrl !== page.url) section.append(element('p', t('text149', {0: (page.finalUrl)})));
    if (page.error) section.append(element('p', page.error));
    if (page.status === 'ok' && !page.violations.length) section.append(element('p', t('text079')));
    for (const kind of ['violations', 'incomplete']) {
      if (filter !== 'all' && filter !== kind) continue;
      for (const rule of page[kind]) {
        if (query && !`${page.url} ${page.title}`.toLowerCase().includes(query) && !matches(rule)) continue;
        const details = element('details', undefined, `finding${kind === 'incomplete' ? ' review' : ''}`);
        details.append(element('summary', `${kind === 'incomplete' ? t('text046') : t('text169')} · ${label('impact', rule.impact)} · ${rule.help} (${rule.nodes.length})`));
        details.append(element('p', `${rule.id} · ${rule.tags.join(', ')}`), element('p', rule.description), element('p', t('text150', {0: (rule.suggestion)})));
        // All website content is rendered as text, never as active HTML.
        for (const node of rule.nodes) details.append(renderAffected(node));
        details.append(referenceLinks(ruleReferences(rule)));
        details.append(element('p', t('text152', {0: (rule.helpUrl)})));
        section.append(details);
      }
    }
    $('pages').append(section);
  }
  renderCriteria();
  renderWorkspace();
}

const statusLabels = { unreviewed: t('text046'), failed: t('text059'), passed: t('text060'), notApplicable: t('text061') };
function renderCriteria() {
  const coverage = report.coverage ?? [];
  const completed = coverage.filter(c => c.status !== 'unreviewed').length;
  $('coverage-progress').textContent = t('text153', {0: (coverage.length), 1: (completed), 2: (coverage.filter(c => c.status === 'unreviewed').length)});
  const query = $('criteria-search').value.trim().toLowerCase();
  const items = coverage.filter(c => ($('standard-filter').value === 'all' || c.standard === $('standard-filter').value) && ($('criteria-filter').value === 'all' || c.status === $('criteria-filter').value) && `${c.id} ${c.title} ${c.guidance}`.toLowerCase().includes(query));
  criteriaOffset = Math.min(criteriaOffset, Math.max(0, Math.ceil(items.length / criteriaSize) - 1));
  $('criteria-count').textContent = t('text154', {0: (items.length), 1: (criteriaOffset + 1), 2: (Math.max(1, Math.ceil(items.length / criteriaSize)))});
  $('criteria-previous').disabled = criteriaOffset === 0;
  $('criteria-next').disabled = (criteriaOffset + 1) * criteriaSize >= items.length;
  $('criteria').replaceChildren();
  if (!items.length) $('criteria').append(element('p', t('text081')));
  for (const criterion of items.slice(criteriaOffset * criteriaSize, (criteriaOffset + 1) * criteriaSize)) {
    const details = element('details', undefined, 'criterion');
    const heading = element('summary', `${criterion.id} · ${criterion.level} · ${criterion.title} — ${statusLabels[criterion.status]}`);
    details.append(heading, element('p', t('text155', {0: (criterion.standard), 1: (criterion.enClause)})), element('p', t('text156', {0: (criterion.condition)})), element('p', criterion.guidance));
    for (const finding of criterion.findings) details.append(element('p', t('text157', {0: (finding.kind === 'violations' ? t('text082') : t('text083')), 1: (finding.ruleId), 2: (finding.url), 3: (finding.nodes)})));
    const label = element('label', t('text084'));
    const select = element('select');
    for (const [value, title] of Object.entries(statusLabels)) { const option = element('option', title); option.value = value; select.append(option); }
    select.value = criterion.status;
    const notesLabel = element('label', t('text085'));
    const notes = element('textarea'); notes.rows = 3; notes.value = criterion.notes;
    notes.addEventListener('input', () => { criterion.notes = notes.value; persist(); });
    select.addEventListener('change', () => {
      if (['passed', 'notApplicable'].includes(select.value) && !notes.value.trim()) {
        notes.setCustomValidity(t('text086')); notes.reportValidity(); select.value = criterion.status; return;
      }
      if (criterion.findings.some(f => f.kind === 'violations') && select.value !== 'failed') {
        select.value = criterion.status; feedback.textContent = t('text087'); return;
      }
      criterion.status = select.value;
      $('summary').children[2].querySelector('strong').textContent = String(coverage.filter(c => c.status === 'unreviewed').length);
      heading.textContent = `${criterion.id} · ${criterion.level} · ${criterion.title} — ${statusLabels[criterion.status]}`;
      feedback.textContent = t('text088');
      $('coverage-progress').textContent = t('text158', {0: (coverage.length), 1: (coverage.filter(c => c.status === 'unreviewed').length)});
    });
    notes.addEventListener('input', () => notes.setCustomValidity(''));
    const feedback = element('p'); feedback.setAttribute('role', 'status');
    label.append(select); notesLabel.append(notes); details.append(label, notesLabel, feedback);
    $('criteria').append(details);
  }
}

$('scan-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (scanning) return;
  const scanStarted = performance.now();
  $('scan-progress').hidden = false;
  $('scan-form').setAttribute('aria-busy', 'true');
  $('start').textContent = t('scan.running');
  const updateElapsed = () => {
    const seconds = Math.floor((performance.now() - scanStarted) / 1000);
    $('scan-elapsed').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  updateElapsed();
  const elapsedTimer = setInterval(updateElapsed, 1000);
  $('start').disabled = true;
  $('error').hidden = true;
  scanning = true; renderProjects();
  const scanUrl = $('url').value;
  const targetProject = projects.find(p => p.id === activeProjectId && new URL(p.url).origin === new URL(scanUrl).origin) ?? null;
  const previousReport = targetProject?.report ?? null;
  $('status').textContent = t('text089');
  try {
    report = await invoke('scan_website', { request: {
      startUrl: $('url').value, maxPages: Number($('max-pages').value), maxDepth: Number($('max-depth').value),
      timeoutMs: Number($('timeout').value), settleMs: Number($('settle').value), delayMs: 200
    } });
    if (targetProject) activeProjectId = targetProject.id;
    else {
      const project = { id: crypto.randomUUID(), name: new URL(scanUrl).hostname, url: scanUrl, report: null };
      projects.push(project); activeProjectId = project.id;
    }
    projects.find(p => p.id === activeProjectId).url = scanUrl;
    reconcile(previousReport);
    persist();
    pageOffset = 0; criteriaOffset = 0;
    render();
    $('results').hidden = false;
    $('status').textContent = t('text159', {0: (report.summary.scanned), 1: (report.summary.errors)});
    showView('overview');
  } catch (error) {
    $('status').textContent = t('text090');
    console.error(error);
    $('error').textContent = t('error.scan');
    $('error').hidden = false;
  } finally {
    clearInterval(elapsedTimer);
    $('scan-progress').hidden = true;
    $('scan-form').removeAttribute('aria-busy');
    $('start').textContent = t('text033');
    scanning = false; $('start').disabled = false; renderProjects();
  }
});
$('filter').addEventListener('change', () => { if (report) render(); });
for (const id of ['search', 'filter']) $(id).addEventListener('input', () => { pageOffset = 0; if (report) render(); });
for (const id of ['criteria-search', 'standard-filter', 'criteria-filter']) $(id).addEventListener('input', () => { criteriaOffset = 0; if (report) renderCriteria(); });
for (const [id, delta] of [['previous', -1], ['next', 1]]) $(id).addEventListener('click', () => { pageOffset += delta; render(); });
for (const [id, delta] of [['criteria-previous', -1], ['criteria-next', 1]]) $(id).addEventListener('click', () => { criteriaOffset += delta; renderCriteria(); });
function save(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = element('a'); anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
$('export-json').addEventListener('click', () => { if (report) save('report.json', JSON.stringify(report, null, 2), 'application/json'); });
$('export-html').addEventListener('click', async () => {
  if (!report) return;
  try { save('report.html', await invoke('html_report', { report }), 'text/html'); }
  catch (error) { $('error').textContent = String(error); $('error').hidden = false; }
});


let currentView = 'projects';
const legacyStorageKey = 'a11y-workspace-v1';
const storageKey = 'a11y-projects-v2';
let projects = [];
let activeProjectId = null;
let scanning = false;
let pendingDeleteId = null;
function showView(view) {
  currentView = view;
  document.querySelectorAll('[data-screen]').forEach(node => { node.hidden = node.dataset.screen !== view; });
  document.querySelectorAll('.app-nav [data-view]').forEach(node => {
    if (node.dataset.view === view) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  });
  $('results').hidden = !report || !['improvements', 'checklist'].includes(view);
  $('empty-report').hidden = !!report || !['improvements', 'checklist'].includes(view);
  const heading = document.querySelector(`[data-screen="${view}"] h1, [data-screen="${view}"] h2`);
  if (heading && !heading.closest('[hidden]')) { heading.tabIndex = -1; heading.focus(); }
}
const empty = element('section', undefined, 'panel'); empty.id = 'empty-report'; empty.hidden = true;
empty.append(element('h2', t('text091')), element('p', t('text092')));
const startLink = element('button', t('text006')); startLink.type = 'button'; startLink.dataset.view = 'scan'; empty.append(startLink);
$('results').before(empty);
document.addEventListener('click', event => { const button = event.target.closest('[data-view]'); if (button) showView(button.dataset.view); });
function writeProjects(items = projects, activeId = activeProjectId) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: 2, activeProjectId: activeId, projects: items }));
    localStorage.removeItem(legacyStorageKey);
    $('storage-status').textContent = '';
    return true;
  } catch {
    $('storage-status').textContent = t('text094');
    return false;
  }
}
function persist() {
  const project = projects.find(p => p.id === activeProjectId);
  if (project) project.report = report;
  writeProjects();
  renderProjects();
}
function renderProjects() {
  const active = projects.find(p => p.id === activeProjectId);
  $('active-project').replaceChildren(
    element('span', t(active ? 'project.loaded' : 'project.none'), 'project-context-label'),
    element('strong', active ? active.name : t('project.chooseHint')),
    element('span', active ? active.url : t('text095'), 'project-context-detail')
  );
  $('change-project').textContent = t(active ? 'project.change' : 'project.choose');
  $('project-form').querySelectorAll('input, button').forEach(node => { node.disabled = scanning; });
  $('project-list').replaceChildren();
  if (!projects.length) $('project-list').append(element('p', t('text096')));
  for (const project of projects) {
    const card = element('article', undefined, 'panel project-card'); card.dataset.projectId = project.id;
    card.append(element('h2', project.name), element('p', project.url));
    const r = project.report;
    card.append(element('p', r ? t('text161', {0: (r.summary.scanned), 1: (grouped(r).length), 2: (r.workspace?.scannedAt ? new Date(r.workspace.scannedAt).toLocaleString(locale) : t('text098'))}) : t('text099')));
    if (project.id === activeProjectId) card.append(element('p', t('text100'), 'project-selected'));
    const actions = element('div', undefined, 'actions');
    const open = element('button', t('text101')); open.type = 'button'; open.disabled = scanning;
    open.addEventListener('click', () => activateProject(project.id));
    const remove = element('button', t('text102'), 'danger'); remove.type = 'button'; remove.disabled = scanning;
    remove.addEventListener('click', () => {
      pendingDeleteId = project.id;
      $('delete-description').textContent = t('text162', {0: (project.name)});
      $('delete-dialog').showModal();
    });
    actions.append(open, remove); card.append(actions); $('project-list').append(card);
  }
}
function activateProject(id) {
  if (scanning) return;
  const project = projects.find(p => p.id === id);
  activeProjectId = project?.id ?? null; report = project?.report ?? null;
  pageOffset = 0; criteriaOffset = 0;
  for (const id of ['search', 'criteria-search']) $(id).value = '';
  for (const id of ['filter', 'standard-filter', 'criteria-filter']) $(id).value = 'all';
  $('url').value = project?.url ?? '';
  $('welcome').hidden = !!report; $('dashboard').hidden = !report;
  $('error').hidden = true; $('status').textContent = t('text103');
  if (report) render();
  writeProjects(); renderProjects(); showView('overview');
}
$('project-form').addEventListener('submit', event => {
  event.preventDefault(); if (scanning) return;
  const url = new URL($('project-url').value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    $('project-feedback').textContent = t('text104'); return;
  }
  const name = $('project-name').value.trim();
  if (!name) { $('project-feedback').textContent = t('text105'); return; }
  const project = { id: crypto.randomUUID(), name, url: url.href, report: null };
  if (!writeProjects([...projects, project], project.id)) return;
  projects.push(project); $('project-form').reset(); $('project-feedback').textContent = t('text106');
  activateProject(project.id); showView('scan');
});
$('cancel-delete').addEventListener('click', () => $('delete-dialog').close());
$('delete-dialog').addEventListener('close', () => { pendingDeleteId = null; });
$('confirm-delete').addEventListener('click', () => {
  if (scanning || !pendingDeleteId) return;
  const remaining = projects.filter(p => p.id !== pendingDeleteId);
  const nextId = activeProjectId === pendingDeleteId ? remaining[0]?.id ?? null : activeProjectId;
  if (!writeProjects(remaining, nextId)) { $('delete-dialog').close(); return; }
  projects = remaining; $('delete-dialog').close();
  activateProject(nextId); showView('projects');
  $('project-feedback').textContent = t('text107');
});
function grouped(r = report) {
  const groups = new Map();
  for (const page of r?.pages ?? []) for (const rule of page.violations) {
    if (!groups.has(rule.id)) groups.set(rule.id, { ...rule, count: 0, urls: [], occurrences: [] });
    const item = groups.get(rule.id); item.count += rule.nodes.length; item.urls.push(page.url); item.occurrences.push({ page, nodes: rule.nodes });
    if (item.nodes !== rule.nodes) item.nodes = [...item.nodes, ...rule.nodes];
  }
  const rank = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  return [...groups.values()].sort((a, b) => (rank[a.impact] ?? 4) - (rank[b.impact] ?? 4) || b.count - a.count);
}
function reconcile(previous) {
  const sameSite = previous?.scope.origin === report.scope.origin;
  report.workspace = { scannedAt: new Date().toISOString(), tasks: {}, checks: {}, comparison: null };
  const now = grouped();
  if (!sameSite) return;
  const old = grouped(previous);
  for (const item of now) report.workspace.tasks[item.id] = previous.workspace?.tasks?.[item.id] ?? 'open';
  report.workspace.comparison = {
    remaining: now.filter(n => old.some(o => o.id === n.id)).length,
    added: now.filter(n => !old.some(o => o.id === n.id)).length,
    absent: old.filter(o => !now.some(n => n.id === o.id)).length
  };
}
const guidance = {
  'image-alt': [t('text108'), t('text109')],
  'color-contrast': [t('text110'), t('text111')],
  'label': [t('text112'), t('text113')],
  'link-name': [t('text114'), t('text115')],
  'button-name': [t('text116'), t('text117')]
};
const taskLabels = { open: t('text058'), working: t('text118'), review: t('text119') };
function renderWorkspace() {
  if (!report) return;
  report.workspace ??= { tasks: {}, checks: {}, scannedAt: null };
  const w = report.workspace; const tasks = grouped();
  $('welcome').hidden = true; $('dashboard').hidden = false;
  $('scan-meta').textContent = t('text163', {0: (report.scope.origin), 1: (w.scannedAt ? new Date(w.scannedAt).toLocaleString(locale) : t('text098')), 2: (report.summary.scanned)});
  $('dashboard-summary').replaceChildren(...$('summary').cloneNode(true).children);
  $('next-step').textContent = tasks.length ? t('text120') : t('text121');
  $('top-tasks').replaceChildren(...tasks.slice(0, 3).map(item => element('p', t('text164', {0: (guidance[item.id]?.[0] ?? item.help), 1: (item.count)}))));
  const review = tasks.filter(t => w.tasks[t.id] === 'review').length;
  $('task-progress').textContent = t('text165', {0: (review), 1: (tasks.length)});
  const c = w.comparison;
  $('comparison').textContent = c ? t('text166', {0: (c.absent), 1: (c.remaining), 2: (c.added)}) : t('text122');
  $('tasks').replaceChildren();
  if (!tasks.length) $('tasks').append(element('p', t('text123')));
  for (const item of tasks) {
    const card = element('article', undefined, 'panel task');
    card.append(element('h3', guidance[item.id]?.[0] ?? item.help), element('p', guidance[item.id]?.[1] ?? item.description), element('p', t('text167', {0: (item.suggestion)})), element('p', t('text168', {0: (item.count), 1: (new Set(item.urls).size), 2: ( {critical:t('text125'),serious:t('text173'),moderate:t('text174'),minor:t('text175')}[item.impact] ?? t('text176') )})));
    const label = element('label', t('text170')); const select = element('select');

    for (const [value, text] of Object.entries(taskLabels)) { const option = element('option', text); option.value = value; select.append(option); }
    select.value = w.tasks[item.id] ?? 'open'; select.addEventListener('change', () => { w.tasks[item.id] = select.value; persist(); renderWorkspace(); }); label.append(select); card.append(label);
    const affected = element('section', undefined, 'task-elements');
    affected.append(element('h4', `Betroffene Elemente (${item.count})`));
    for (const { page, nodes } of item.occurrences) {
      const group = element('details', undefined, 'affected-page');
      group.open = item.occurrences.length === 1;
      group.append(element('summary', `${page.title || page.url} \u00b7 ${nodes.length} Elemente`), element('p', page.url, 'muted'));
      for (const node of nodes) group.append(renderAffected(node));
      affected.append(group);
    }
    card.append(affected);
    const detail = element('details'); detail.append(element('summary', 'Anleitungen und Regel'), element('p', item.id), referenceLinks(ruleReferences(item)));
    card.append(detail); $('tasks').append(card);
  }
  renderGuided();
}
const guided = [
  ['keyboard', t('text127'), t('text128')],
  ['focus', t('text129'), t('text130')],
  ['zoom', t('text131'), t('text132')],
  ['content', t('text133'), t('text134')],
  ['forms', t('text135'), t('text136')]
];
function renderGuided() {
  $('guided-checks').replaceChildren();
  for (const [id, title, instructions] of guided) {
    const value = report.workspace.checks[id] ?? { status: 'open', notes: '' };
    const card = element('article', undefined, 'panel'); card.append(element('h3', title), element('p', instructions));
    const label = element('label', t('text137')); const select = element('select');
    for (const [key, text] of Object.entries({open:t('text138'), passed:t('text171'), failed:t('text139'), na:t('text140'), unsure:t('text172')})) { const option = element('option', text); option.value = key; select.append(option); }
    select.value = value.status; label.append(select);
    const notesLabel = element('label', t('text141')); const notes = element('textarea'); notes.rows = 2; notes.value = value.notes; notesLabel.append(notes);
    const update = () => { value.notes = notes.value; report.workspace.checks[id] = value; persist(); };
    notes.addEventListener('input', () => { notes.setCustomValidity(''); update(); });
    select.addEventListener('change', () => {
      if (['passed', 'na'].includes(select.value) && !notes.value.trim()) { notes.setCustomValidity(t('text142')); notes.reportValidity(); select.value = value.status; return; }
      value.status = select.value; update();
    });
    card.append(label, notesLabel); $('guided-checks').append(card);
  }
}
try {
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    const stored = JSON.parse(raw);
    if (stored.version !== 2 || !Array.isArray(stored.projects)) throw new Error(t('text143'));
    projects = stored.projects;
    activeProjectId = projects.some(p => p.id === stored.activeProjectId) ? stored.activeProjectId : projects[0]?.id ?? null;
  } else {
    const legacy = JSON.parse(localStorage.getItem(legacyStorageKey));
    if (legacy?.pages && legacy?.summary && legacy?.scope) {
      const project = { id: crypto.randomUUID(), name: new URL(legacy.scope.origin).hostname, url: legacy.request?.startUrl ?? legacy.scope.origin, report: legacy };
      projects = [project]; activeProjectId = project.id; writeProjects();
    }
  }
  report = projects.find(p => p.id === activeProjectId)?.report ?? null;
  if (report) render();
  $('url').value = projects.find(p => p.id === activeProjectId)?.url ?? '';
} catch { $('storage-status').textContent = t('text144'); }
renderProjects();
showView('projects');
