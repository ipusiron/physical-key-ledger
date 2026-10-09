// i18n.js - language selection and text replacement.
//
// The pure parts (pickLang, t, formatters) are tested with node; applyI18n
// is the only function that touches the DOM.

import { MESSAGES, LANGS } from "./messages.js";

export const DEFAULT_LANG = "ja";
export const LANG_STORAGE_KEY = "lang";

export function isLang(value) {
  return LANGS.includes(value);
}

/**
 * Order: ?lang= in the URL, then the saved choice, then the browser.
 * Anything that is not Japanese falls back to English, which is what a
 * visitor from outside Japan is most likely to read.
 */
export function pickLang({ urlLang, savedLang, browserLang } = {}) {
  if (isLang(urlLang)) return urlLang;
  if (isLang(savedLang)) return savedLang;
  const b = String(browserLang || "").toLowerCase();
  if (b.startsWith("ja")) return "ja";
  if (b) return "en";
  return DEFAULT_LANG;
}

// Fills {name} placeholders. Missing values are left as an empty string so
// that a typo shows up as a gap, not as "{undefined}".
export function fmt(lang, key, vars = {}) {
  return String(t(lang, key)).replace(/\{(\w+)\}/g, (_, name) => {
    const v = vars[name];
    return v == null ? "" : String(v);
  });
}

export function t(lang, key, fallback = "") {
  const dict = MESSAGES[lang] || MESSAGES[DEFAULT_LANG];
  const value = dict[key];
  if (value != null) return value;
  const base = MESSAGES[DEFAULT_LANG][key];
  return base != null ? base : fallback || key;
}

// Replaces text, markup and attributes inside root.
//   data-i18n="key"                      -> textContent
//   data-i18n-html="key"                 -> innerHTML (our own markup only)
//   data-i18n-attr="placeholder:key,..." -> attributes
export function applyI18n(root, lang) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(lang, el.dataset.i18n, el.textContent);
  }
  for (const el of root.querySelectorAll("[data-i18n-html]")) {
    el.innerHTML = t(lang, el.dataset.i18nHtml, el.innerHTML);
  }
  for (const el of root.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(",")) {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (!attr || !key) continue;
      el.setAttribute(attr, t(lang, key, el.getAttribute(attr) || ""));
    }
  }
  const html = root.ownerDocument ? root.ownerDocument.documentElement : root.documentElement;
  if (html) html.setAttribute("lang", lang);
}

export function otherLang(lang) {
  return lang === "ja" ? "en" : "ja";
}

// Checks both dictionaries have the same keys, no empty values, and the same
// number of HTML tags in the markup entries. Used by the tests.
export function dictionaryReport() {
  const [a, b] = LANGS;
  const keysA = Object.keys(MESSAGES[a]).sort();
  const keysB = Object.keys(MESSAGES[b]).sort();
  const missingInB = keysA.filter((k) => !keysB.includes(k));
  const missingInA = keysB.filter((k) => !keysA.includes(k));
  const empty = [];
  const tagMismatch = [];
  for (const lang of LANGS) {
    for (const [k, v] of Object.entries(MESSAGES[lang])) {
      if (typeof v !== "string" || v.trim() === "") empty.push(`${lang}:${k}`);
    }
  }
  for (const k of keysA) {
    if (!k.endsWith("_html") || !keysB.includes(k)) continue;
    const count = (s) => (String(s).match(/<[a-z]/gi) || []).length;
    if (count(MESSAGES[a][k]) !== count(MESSAGES[b][k])) tagMismatch.push(k);
  }
  return { langs: LANGS, keys: keysA.length, missingInA, missingInB, empty, tagMismatch };
}
