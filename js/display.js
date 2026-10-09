// display.js - pure display helpers (no DOM, no IndexedDB).
// Every function that produces text takes the language, so the screen can be
// redrawn in the other language without recomputing anything.

import { t, fmt } from "./i18n.js";

export const CATEGORIES = ["physical-key", "ic-card", "card-key"];
export const STATUSES = ["stored", "loaned", "retired"];

// Which types belong to which category. The labels live in messages.js.
export const TYPE_OPTIONS = {
  "physical-key": ["master", "original", "spare"],
  "ic-card": ["employee", "visitor", "contractor", "temporary", "other"],
  "card-key": ["room-key", "access-card", "parking-card", "locker-key", "other"]
};

export const ALL_TYPES = [...new Set(Object.values(TYPE_OPTIONS).flat())];

export function translateStatus(lang, status) {
  return t(lang, `status.${status}`, status);
}

export function translateCategory(lang, category) {
  return t(lang, `cat.${category}`, category);
}

export function translateType(lang, type) {
  return t(lang, `type.${type}`, type);
}

export function typeOptionsFor(category) {
  return TYPE_OPTIONS[category] || TYPE_OPTIONS["physical-key"];
}

// Escape for HTML text and attribute contexts.
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

const MINUTE = 60000;
const HOUR = 3600000;
const DAY = 86400000;
const WEEK = 604800000;

// Relative time such as "3時間後" / "2 days ago". Falls back to an absolute
// local date when the gap is a week or more.
export function formatRelativeTime(ms, now, lang = "ja") {
  if (!ms) return "";
  const diff = ms - now;
  const absDiff = Math.abs(diff);
  const ahead = diff > 0;
  if (absDiff < HOUR) {
    return fmt(lang, ahead ? "fmt.in_minutes" : "fmt.ago_minutes", { n: Math.floor(absDiff / MINUTE) });
  }
  if (absDiff < DAY) {
    return fmt(lang, ahead ? "fmt.in_hours" : "fmt.ago_hours", { n: Math.floor(absDiff / HOUR) });
  }
  if (absDiff < WEEK) {
    const n = Math.floor(absDiff / DAY);
    // English needs the singular: "in 1 day", not "in 1 days"
    const suffix = n === 1 ? "_one" : "";
    return fmt(lang, `${ahead ? "fmt.in_days" : "fmt.ago_days"}${suffix}`, { n });
  }
  return formatLocalDateTime(ms);
}

export function formatLocalDateTime(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// <input type="datetime-local"> value -> epoch ms (local time), or null.
export function fromLocalDatetime(str) {
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(str).trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] || "0"].map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi, s, 0);
  // Reject dates that rolled over (for example 2026-02-31).
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

// epoch ms -> <input type="datetime-local"> value (local time).
export function toLocalDatetimeInput(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Dashboard labels follow the configured thresholds instead of being fixed
// in the markup.
export function multiHoldingLabel(lang, threshold) {
  return fmt(lang, "fmt.multi_label", { n: threshold });
}

export function multiHoldingHeading(lang, threshold) {
  return fmt(lang, "fmt.multi_heading", { n: threshold });
}

export function expiringHeading(lang, days) {
  return fmt(lang, "fmt.expiring_heading", { n: days });
}

// "3日前に期限切れ" / "expires in 5 days"
export function expiryPhrase(lang, card) {
  if (card.expired) {
    return card.daysOver === 0
      ? t(lang, "fmt.expired_today")
      : fmt(lang, "fmt.expired_days", { n: card.daysOver });
  }
  return card.daysLeft === 0
    ? t(lang, "fmt.valid_today")
    : fmt(lang, "fmt.valid_days", { n: card.daysLeft });
}

export function inconsistencyLabel(lang, kind) {
  return t(lang, `notice.${kind}`, kind);
}
