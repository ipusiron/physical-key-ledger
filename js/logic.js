// logic.js - domain logic (MVP)
import { openDB, dbApi } from "./db.js";

export const state = {
  db: null,
  cache: {
    keys: [],
    loans: [],
  },
  settings: {
    profileName: "local-admin",
    multiThreshold: 4, // 同一借主の同時保持が4本以上で警告（>3）
  },
  theme: "dark", // "light" or "dark"
};

export async function initLogic() {
  state.db = await openDB();
  // load settings
  const name = await dbApi.getSetting(state.db, "profileName");
  const mt = await dbApi.getSetting(state.db, "multiThreshold");
  if (name) state.settings.profileName = name;
  if (mt) state.settings.multiThreshold = mt;

  // load theme from localStorage (not IndexedDB)
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    state.theme = savedTheme;
  } else {
    // Detect system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    state.theme = prefersDark ? "dark" : "light";
  }

  await refreshCache();
}

export async function refreshCache() {
  const [keys, loans] = await Promise.all([
    dbApi.getAllKeys(state.db),
    dbApi.getAllLoans(state.db),
  ]);
  state.cache.keys = keys;
  state.cache.loans = loans;
}

export function nowMs() { return Date.now(); }
export function toISO(ms) {
  if (!ms) return "";
  try { return new Date(ms).toISOString(); } catch { return ""; }
}
export function fromLocalDatetime(str) {
  // input type="datetime-local" → local time string; convert to ms
  if (!str) return null;
  const d = new Date(str);
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}
export function toLocalDatetimeInput(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function genUuid() {
  // simple uuid v4-ish
  return ([1e7]+-1e3+-4e3+-8e3+-1e11)
    .replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}
export function genLoanId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const iso = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `L-${iso}-${Math.random().toString(36).slice(2, 6)}`;
}

// CRUD & flows
export async function upsertKey(keyObj, isNew) {
  keyObj.updatedAt = nowMs();
  if (isNew) keyObj.createdAt = keyObj.updatedAt;
  await dbApi.putKey(state.db, keyObj);
  await dbApi.addAudit(state.db, {
    ts: nowMs(),
    actor: state.settings.profileName,
    action: isNew ? "key.create" : "key.update",
    entityId: keyObj.uuid,
    diff: keyObj, // MVP: snapshot-ish
  });
  await refreshCache();
}

export async function deleteKey(uuid) {
  // prevent delete if active loan exists
  const active = (await dbApi.getActiveLoanByKey(state.db, uuid));
  if (active) throw new Error("貸出中のため削除できません。先に回収してください。");

  await dbApi.deleteKey(state.db, uuid);
  await dbApi.addAudit(state.db, {
    ts: nowMs(),
    actor: state.settings.profileName,
    action: "key.delete",
    entityId: uuid,
    diff: {},
  });
  await refreshCache();
}

export async function createLoan({ keyUuid, borrower, dueAt, outNotes }) {
  // check key exists & status
  const key = state.cache.keys.find(k => k.uuid === keyUuid);
  if (!key) throw new Error("鍵が存在しません。");
  if (key.status === "loaned") throw new Error("この鍵は既に貸出中です。");

  const loan = {
    loanId: genLoanId(),
    keyUuid,
    borrower,
    loanedAt: nowMs(),
    dueAt: dueAt || null,
    returnedAt: null,
    outNotes: outNotes || null,
    inNotes: null,
  };

  key.status = "loaned";
  await dbApi.putKey(state.db, key);
  await dbApi.putLoan(state.db, loan);
  await dbApi.addAudit(state.db, {
    ts: nowMs(),
    actor: state.settings.profileName,
    action: "loan.create",
    entityId: loan.loanId,
    diff: loan,
  });
  await refreshCache();
}

export async function returnLoanByKeyUuid(keyUuid, inNotes) {
  // find active loan
  const active = await dbApi.getActiveLoanByKey(state.db, keyUuid);
  if (!active) throw new Error("この鍵の貸出レコードが見つかりません。");

  active.returnedAt = nowMs();
  active.inNotes = inNotes || null;
  await dbApi.putLoan(state.db, active);

  const key = state.cache.keys.find(k => k.uuid === keyUuid);
  if (key) {
    key.status = "stored";
    await dbApi.putKey(state.db, key);
  }

  await dbApi.addAudit(state.db, {
    ts: nowMs(),
    actor: state.settings.profileName,
    action: "loan.return",
    entityId: active.loanId,
    diff: { returnedAt: active.returnedAt, inNotes: active.inNotes },
  });
  await refreshCache();
}

// Anomaly detection
export function detectOverdue() {
  const now = nowMs();
  const list = [];
  for (const L of state.cache.loans) {
    if (L.returnedAt == null && L.dueAt && now > L.dueAt) {
      list.push(L);
    }
  }
  return list;
}
export function detectMultiHolding() {
  const map = new Map();
  for (const L of state.cache.loans) {
    if (L.returnedAt == null) {
      if (!map.has(L.borrower)) map.set(L.borrower, 0);
      map.set(L.borrower, map.get(L.borrower) + 1);
    }
  }
  const out = [];
  for (const [borrower, count] of map.entries()) {
    if (count >= state.settings.multiThreshold) out.push({ borrower, count });
  }
  return out;
}

// KPIs
export function kpi() {
  const total = state.cache.keys.length;
  const loaned = state.cache.keys.filter(k => k.status === "loaned").length;
  const overdue = detectOverdue().length;
  const multi = detectMultiHolding().length;
  return { total, loaned, overdue, multi };
}

// Export / Import
export async function exportJson() {
  const all = await dbApi.exportAll(state.db);
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const ts = new Date();
  const pad = (n) => String(n).padStart(2,"0");
  const name = `pkledger-export-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`;
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importJsonFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  await dbApi.importAllReplace(state.db, data);
  await dbApi.addAudit(state.db, {
    ts: nowMs(),
    actor: state.settings.profileName,
    action: "import",
    entityId: "all",
    diff: { counts: {
      keys: (data.keys||[]).length,
      loans: (data.loans||[]).length,
      audit: (data.audit||[]).length
    }},
  });
  await refreshCache();
}

// audit
export async function getAuditLog(limit=500) {
  return dbApi.getAllAuditDesc(state.db, limit);
}

// settings
export async function saveSettings({ profileName, multiThreshold }) {
  state.settings.profileName = profileName || "local-admin";
  state.settings.multiThreshold = Number(multiThreshold) || 4;
  await dbApi.setSetting(state.db, "profileName", state.settings.profileName);
  await dbApi.setSetting(state.db, "multiThreshold", state.settings.multiThreshold);
}

// theme
export function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", state.theme);
  applyTheme();
}

export function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  document.body.setAttribute("data-theme", state.theme);
}
