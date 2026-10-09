// validate.js - pure validation of imported data and form input (no DOM)
// Import replaces the whole ledger, so nothing is written until the dataset
// passes every check here.

import { CATEGORIES, STATUSES, TYPE_OPTIONS } from "./display.js";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_TEXT = 200;
export const MAX_NOTES = 1000;
export const MAX_ERRORS = 12;

const KNOWN_TYPES = new Set(Object.values(TYPE_OPTIONS).flat().map((o) => o.value));

export function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isText(v, max = MAX_TEXT) {
  return typeof v === "string" && v.length <= max;
}

function isFilledText(v, max = MAX_TEXT) {
  return isText(v, max) && v.trim().length > 0;
}

function isEpoch(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 4102444800000;
}

function isEpochOrNull(v) {
  return v == null || isEpoch(v);
}

// Validates a dataset produced by the export feature.
// Returns { ok, errors, counts }. Nothing is modified.
export function validateDataset(data) {
  const errors = [];
  const push = (msg) => { if (errors.length < MAX_ERRORS) errors.push(msg); };

  if (!isPlainObject(data)) {
    return {
      ok: false,
      errors: ["台帳データの形式ではありません（keys・loans・auditを持つオブジェクトが必要です）。"],
      counts: { keys: 0, loans: 0, audit: 0 }
    };
  }
  if (!Array.isArray(data.keys)) push("keys が配列ではありません。");
  if (!Array.isArray(data.loans)) push("loans が配列ではありません。");
  if (data.audit != null && !Array.isArray(data.audit)) push("audit が配列ではありません。");
  if (errors.length) {
    return { ok: false, errors, counts: { keys: 0, loans: 0, audit: 0 } };
  }

  const keys = data.keys;
  const loans = data.loans;
  const audit = data.audit || [];

  const uuids = new Set();
  const displayIds = new Set();
  keys.forEach((k, i) => {
    const at = `keys[${i}]`;
    if (!isPlainObject(k)) { push(`${at} がオブジェクトではありません。`); return; }
    if (!isUuid(k.uuid)) push(`${at}.uuid がUUID形式ではありません。`);
    else if (uuids.has(k.uuid)) push(`${at}.uuid が重複しています。`);
    else uuids.add(k.uuid);
    if (!isFilledText(k.id)) push(`${at}.id が空か、長すぎます。`);
    else if (displayIds.has(k.id)) push(`${at}.id「${k.id}」が重複しています（表示IDは一意である必要があります）。`);
    else displayIds.add(k.id);
    if (!isFilledText(k.name)) push(`${at}.name が空か、長すぎます。`);
    if (k.category != null && !CATEGORIES.includes(k.category)) push(`${at}.category が不正です。`);
    if (!STATUSES.includes(k.status)) push(`${at}.status が不正です。`);
    if (k.type != null && !KNOWN_TYPES.has(k.type)) push(`${at}.type が不正です。`);
    if (k.location != null && !isText(k.location)) push(`${at}.location が不正です。`);
    if (k.notes != null && !isText(k.notes, MAX_NOTES)) push(`${at}.notes が不正です。`);
    if (k.cardNumber != null && !isText(k.cardNumber)) push(`${at}.cardNumber が不正です。`);
    if (k.accessLevel != null && !isText(k.accessLevel)) push(`${at}.accessLevel が不正です。`);
    if (!isEpochOrNull(k.validFrom)) push(`${at}.validFrom が不正です。`);
    if (!isEpochOrNull(k.validUntil)) push(`${at}.validUntil が不正です。`);
    if (!isEpochOrNull(k.createdAt)) push(`${at}.createdAt が不正です。`);
    if (!isEpochOrNull(k.updatedAt)) push(`${at}.updatedAt が不正です。`);
  });

  const loanIds = new Set();
  loans.forEach((L, i) => {
    const at = `loans[${i}]`;
    if (!isPlainObject(L)) { push(`${at} がオブジェクトではありません。`); return; }
    if (!isFilledText(L.loanId)) push(`${at}.loanId が空か、長すぎます。`);
    else if (loanIds.has(L.loanId)) push(`${at}.loanId が重複しています。`);
    else loanIds.add(L.loanId);
    if (!isUuid(L.keyUuid)) push(`${at}.keyUuid がUUID形式ではありません。`);
    else if (!uuids.has(L.keyUuid)) push(`${at}.keyUuid に対応する鍵がありません。`);
    if (!isFilledText(L.borrower)) push(`${at}.borrower が空か、長すぎます。`);
    if (!isEpoch(L.loanedAt)) push(`${at}.loanedAt が不正です。`);
    if (!isEpochOrNull(L.dueAt)) push(`${at}.dueAt が不正です。`);
    if (!isEpochOrNull(L.returnedAt)) push(`${at}.returnedAt が不正です。`);
    if (L.outNotes != null && !isText(L.outNotes, MAX_NOTES)) push(`${at}.outNotes が不正です。`);
    if (L.inNotes != null && !isText(L.inNotes, MAX_NOTES)) push(`${at}.inNotes が不正です。`);
  });

  audit.forEach((a, i) => {
    const at = `audit[${i}]`;
    if (!isPlainObject(a)) { push(`${at} がオブジェクトではありません。`); return; }
    if (!isEpoch(a.ts)) push(`${at}.ts が不正です。`);
    if (!isFilledText(a.action)) push(`${at}.action が不正です。`);
    if (a.actor != null && !isText(a.actor)) push(`${at}.actor が不正です。`);
    if (a.entityId != null && !isText(a.entityId, MAX_NOTES)) push(`${at}.entityId が不正です。`);
    if (a.seq != null && !(Number.isInteger(a.seq) && a.seq >= 1)) push(`${at}.seq が不正です。`);
    if (a.hash != null && !/^[0-9a-f]{64}$/.test(String(a.hash))) push(`${at}.hash が不正です。`);
    if (a.prevHash != null && !/^[0-9a-f]{64}$/.test(String(a.prevHash))) push(`${at}.prevHash が不正です。`);
  });

  return {
    ok: errors.length === 0,
    errors,
    counts: { keys: keys.length, loans: loans.length, audit: audit.length }
  };
}

// Validates what the key form produces before it reaches the database.
export function validateKeyInput(obj, existingKeys = [], isNew = true) {
  const errors = [];
  if (!isUuid(obj.uuid)) errors.push("内部IDが不正です。");
  if (!isFilledText(obj.id)) errors.push("表示IDを入力してください（200文字以内）。");
  if (!isFilledText(obj.name)) errors.push("名称を入力してください（200文字以内）。");
  if (!CATEGORIES.includes(obj.category)) errors.push("カテゴリーが不正です。");
  if (!STATUSES.includes(obj.status)) errors.push("状態が不正です。");
  if (obj.type && !KNOWN_TYPES.has(obj.type)) errors.push("種別が不正です。");
  if (obj.validFrom != null && obj.validUntil != null && obj.validFrom > obj.validUntil) {
    errors.push("有効期限の開始が終了より後になっています。");
  }
  const clash = existingKeys.find((k) => k.id === obj.id && k.uuid !== obj.uuid);
  if (clash) errors.push(`表示ID「${obj.id}」はすでに使われています。`);
  if (isNew && existingKeys.some((k) => k.uuid === obj.uuid)) errors.push("内部IDが重複しています。");
  return { ok: errors.length === 0, errors };
}

export function validateLoanInput({ borrower, dueAt }, key) {
  const errors = [];
  if (!key) errors.push("鍵が存在しません。");
  else if (key.status === "loaned") errors.push("この鍵はすでに貸出中です。");
  else if (key.status !== "stored") errors.push("保管中の鍵だけを貸し出せます（廃止した鍵は貸し出せません）。");
  if (!isFilledText(borrower)) errors.push("借主識別子を入力してください（200文字以内）。");
  if (!isEpochOrNull(dueAt)) errors.push("返却期限が不正です。");
  return { ok: errors.length === 0, errors };
}
