// display.js - pure display helpers (no DOM, no IndexedDB)
// Imported by ui.js for rendering and by test/ for verification.

export const CATEGORIES = ["physical-key", "ic-card", "card-key"];
export const STATUSES = ["stored", "loaned", "retired"];

// Category-specific type options (value is stored, label is shown)
export const TYPE_OPTIONS = {
  "physical-key": [
    { value: "master", label: "マスターキー" },
    { value: "original", label: "純正キー" },
    { value: "spare", label: "スペアキー" }
  ],
  "ic-card": [
    { value: "employee", label: "社員証" },
    { value: "visitor", label: "訪問者カード" },
    { value: "contractor", label: "業者カード" },
    { value: "temporary", label: "一時カード" },
    { value: "other", label: "その他" }
  ],
  "card-key": [
    { value: "room-key", label: "客室キー" },
    { value: "access-card", label: "入館証" },
    { value: "parking-card", label: "駐車場カード" },
    { value: "locker-key", label: "ロッカーキー" },
    { value: "other", label: "その他" }
  ]
};

const STATUS_LABELS = { stored: "保管中", loaned: "貸出中", retired: "廃止" };

const CATEGORY_LABELS = {
  "physical-key": "🔑 物理鍵",
  "ic-card": "💳 ICカード",
  "card-key": "🎫 カードキー"
};

const TYPE_LABELS = (() => {
  const map = {};
  for (const list of Object.values(TYPE_OPTIONS)) {
    for (const opt of list) map[opt.value] = opt.label;
  }
  return map;
})();

export function translateStatus(status) {
  return STATUS_LABELS[status] || status;
}

export function translateCategory(category) {
  return CATEGORY_LABELS[category] || category;
}

export function translateType(type) {
  return TYPE_LABELS[type] || type;
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

// Relative time such as "3時間後" / "2日前". Falls back to an absolute
// local date when the gap is a week or more.
export function formatRelativeTime(ms, now) {
  if (!ms) return "";
  const diff = ms - now;
  const absDiff = Math.abs(diff);
  if (absDiff < HOUR) {
    const minutes = Math.floor(absDiff / MINUTE);
    return diff > 0 ? `${minutes}分後` : `${minutes}分前`;
  }
  if (absDiff < DAY) {
    const hours = Math.floor(absDiff / HOUR);
    return diff > 0 ? `${hours}時間後` : `${hours}時間前`;
  }
  if (absDiff < WEEK) {
    const days = Math.floor(absDiff / DAY);
    return diff > 0 ? `${days}日後` : `${days}日前`;
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

// Dashboard labels follow the configured threshold instead of a fixed "4".
export function multiHoldingLabel(threshold) {
  return `多重貸出(${threshold}本以上)`;
}

export function multiHoldingHeading(threshold) {
  return `多重貸出（同一借主が${threshold}本以上保持）`;
}
