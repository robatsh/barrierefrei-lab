import de from './locales/de.js';

// Explicit application language; independent of the operating system language.
// Register future catalogs here. Missing translations fall back to German.
const catalogs = { de };
const language = 'de';
const catalog = catalogs[language];
export const locale = catalog.locale;

export function t(key, values = {}) {
  const message = catalog.messages[key] ?? de.messages[key];
  if (message === undefined) throw new Error(`Unbekannter Textschlüssel: ${key}`);
  return message.replace(/\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder);
}

export function label(group, value) {
  if (group === 'impact' && value == null) return catalog.noImpact ?? de.noImpact;
  return catalog.labels[group]?.[value] ?? de.labels[group]?.[value] ?? catalog.unknown ?? de.unknown;
}

export function localizeDocument() {
  document.documentElement.lang = language;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const attribute of ['placeholder', 'aria-label']) {
    for (const node of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)));
    }
  }
}
