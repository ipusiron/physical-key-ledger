// logic.js - stateful domain layer. Pure calculations live in
// display.js / anomaly.js / validate.js so that they can be tested with node.
import { openDB, dbApi, CHAIN_HEAD_KEY } from "./db.js";
import { sealEntry, verifyChain } from "./audit-chain.js";
import * as anomaly from "./anomaly.js";
import { validateDataset, validateKeyInput, validateLoanInput, isUuid } from "./validate.js";

// Every audit entry is sealed into the hash chain before it is stored.
const sealAudit = sealEntry;

export const state = {
  db: null,
  cache: {
    keys: [],
    loans: []
  },
  settings: {
    profileName: "local-admin",
    multiThreshold: 4
  },
  theme: "dark" // "light" or "dark"
};

export async function initLogic() {
  state.db = await openDB();
  const name = await dbApi.getSetting(state.db, "profileName");
  const mt = await dbApi.getSetting(state.db, "multiThreshold");
  if (name) state.settings.profileName = name;
  if (mt) state.settings.multiThreshold = Number(mt) || 4;

  // Theme lives in localStorage so that it applies before the database opens.
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem("theme");
  } catch {
    savedTheme = null;
  }
  if (savedTheme === "light" || savedTheme === "dark") {
    state.theme = savedTheme;
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    state.theme = prefersDark ? "dark" : "light";
  }

  await refreshCache();
}

export async function refreshCache() {
  const [keys, loans] = await Promise.all([
    dbApi.getAllKeys(state.db),
    dbApi.getAllLoans(state.db)
  ]);
  state.cache.keys = keys;
  state.cache.loans = loans;
}

export function nowMs() { return Date.now(); }

export function genUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older browsers: same shape, still from a CSPRNG.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function genLoanId(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const rnd = [...crypto.getRandomValues(new Uint8Array(2))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return `L-${day}-${time}-${rnd}`;
}

function auditDraft(action, entityId, diff) {
  return {
    ts: nowMs(),
    actor: state.settings.profileName,
    action,
    entityId,
    diff
  };
}

function fail(errors) {
  throw new Error(errors.join("\n"));
}

// CRUD & flows
export async function upsertKey(keyObj, isNew) {
  const check = validateKeyInput(keyObj, state.cache.keys, isNew);
  if (!check.ok) fail(check.errors);

  const record = { ...keyObj };
  record.updatedAt = nowMs();
  if (isNew) {
    record.createdAt = record.updatedAt;
  } else {
    const prev = state.cache.keys.find((k) => k.uuid === record.uuid);
    record.createdAt = prev?.createdAt ?? record.updatedAt;
  }

  await dbApi.putKeyWithAudit(
    state.db,
    record,
    auditDraft(isNew ? "key.create" : "key.update", record.uuid, record),
    sealAudit
  );
  await refreshCache();
}

export async function deleteKey(uuid) {
  if (!isUuid(uuid)) fail(["内部IDが不正です。"]);
  await dbApi.deleteKeyWithAudit(state.db, uuid, auditDraft("key.delete", uuid, {}), sealAudit);
  await refreshCache();
}

export async function createLoan({ keyUuid, borrower, dueAt, outNotes }) {
  const key = state.cache.keys.find((k) => k.uuid === keyUuid);
  const check = validateLoanInput({ borrower, dueAt }, key);
  if (!check.ok) fail(check.errors);

  const loan = {
    loanId: genLoanId(),
    keyUuid,
    borrower: borrower.trim(),
    loanedAt: nowMs(),
    dueAt: dueAt || null,
    returnedAt: null,
    outNotes: outNotes || null,
    inNotes: null
  };
  const keyObj = { ...key, status: "loaned", updatedAt: nowMs() };

  await dbApi.createLoanAtomic(
    state.db,
    { keyObj, loan, auditDraft: auditDraft("loan.create", loan.loanId, loan) },
    sealAudit
  );
  await refreshCache();
}

export async function returnLoanByKeyUuid(keyUuid, inNotes) {
  const active = await dbApi.getActiveLoanByKey(state.db, keyUuid);
  if (!active) fail(["この鍵の貸出レコードが見つかりません。"]);

  const loan = { ...active, returnedAt: nowMs(), inNotes: inNotes || null };
  const prevKey = state.cache.keys.find((k) => k.uuid === keyUuid);
  const keyObj = prevKey ? { ...prevKey, status: "stored", updatedAt: nowMs() } : null;

  await dbApi.returnLoanAtomic(
    state.db,
    {
      keyObj,
      loan,
      auditDraft: auditDraft("loan.return", loan.loanId, {
        returnedAt: loan.returnedAt, inNotes: loan.inNotes
      })
    },
    sealAudit
  );
  await refreshCache();
}

// Anomaly detection and KPIs (thin wrappers over the pure module)
export function detectOverdue(now = nowMs()) {
  return anomaly.detectOverdue(state.cache.loans, now);
}
export function detectMultiHolding() {
  return anomaly.detectMultiHolding(state.cache.loans, state.settings.multiThreshold);
}
export function detectExpiredCards(now = nowMs()) {
  return anomaly.detectExpiredCards(state.cache.keys, state.cache.loans, now);
}
export function detectLongMasterLoan(now = nowMs()) {
  return anomaly.detectLongMasterLoan(state.cache.keys, state.cache.loans, now);
}
export function detectInconsistent() {
  return anomaly.detectInconsistent(state.cache.keys, state.cache.loans);
}
export function kpi(now = nowMs()) {
  return anomaly.kpi(state.cache.keys, state.cache.loans, state.settings, now);
}

// Export / Import
export function buildExportName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `pkledger-export-${day}-${time}.json`;
}

export async function exportJson() {
  const all = await dbApi.exportAll(state.db);
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = buildExportName();
  a.click();
  URL.revokeObjectURL(a.href);
}

// Nothing is deleted until the whole dataset passes validation.
export async function importJsonFile(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSONとして読めませんでした。ファイルを確認してください。");
  }
  const check = validateDataset(data);
  if (!check.ok) {
    throw new Error(`台帳データとして読めないため、既存のデータは変更していません。\n${check.errors.join("\n")}`);
  }
  await dbApi.importAllReplace(
    state.db,
    data,
    auditDraft("import", "all", { counts: check.counts }),
    sealAudit
  );
  await refreshCache();
  return check.counts;
}

// audit
export async function getAuditLog(limit = 500) {
  return dbApi.getAllAuditDesc(state.db, limit);
}
export async function getAuditLogAsc(limit = 100000) {
  return dbApi.getAllAuditAsc(state.db, limit);
}

// Recomputes the whole chain and compares it with the head kept in settings.
export async function verifyAuditChain() {
  const [entries, head] = await Promise.all([
    dbApi.getAllAuditAsc(state.db),
    dbApi.getSetting(state.db, CHAIN_HEAD_KEY)
  ]);
  return verifyChain(entries, head);
}

// settings
export async function saveSettings({ profileName, multiThreshold }) {
  state.settings.profileName = (profileName || "local-admin").slice(0, 200);
  const n = Number(multiThreshold);
  state.settings.multiThreshold = Number.isInteger(n) && n >= 2 ? n : 4;
  await dbApi.setSetting(state.db, "profileName", state.settings.profileName);
  await dbApi.setSetting(state.db, "multiThreshold", state.settings.multiThreshold);
}

// theme
export function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("theme", state.theme);
  } catch {
    // Private mode or blocked storage: the theme simply does not persist.
  }
  applyTheme();
}

export function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  document.body.setAttribute("data-theme", state.theme);
}
