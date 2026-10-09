// validate.js - pure validation of imported data and form input (no DOM)
// Import replaces the whole ledger, so nothing is written until the dataset
// passes every check here.

import { CATEGORIES, STATUSES, ALL_TYPES } from "./display.js";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_TEXT = 200;
export const MAX_NOTES = 1000;
export const MAX_ERRORS = 12;

const KNOWN_TYPES = new Set(ALL_TYPES);

// Validation results are reported as { key, vars } so that the screen can
// show them in either language.
const fieldErr = (at, field) => ({ key: "err.dataset_field_invalid", vars: { at, field } });
const emptyErr = (at, field) => ({ key: "err.dataset_field_empty", vars: { at, field } });
const dupErr = (at, field) => ({ key: "err.dataset_duplicate", vars: { at, field } });

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
      errors: [{ key: "err.dataset_not_object" }],
      counts: { keys: 0, loans: 0, audit: 0 }
    };
  }
  if (!Array.isArray(data.keys)) push({ key: "err.dataset_not_array", vars: { name: "keys" } });
  if (!Array.isArray(data.loans)) push({ key: "err.dataset_not_array", vars: { name: "loans" } });
  if (data.audit != null && !Array.isArray(data.audit)) push({ key: "err.dataset_not_array", vars: { name: "audit" } });
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
    if (!isPlainObject(k)) { push({ key: "err.dataset_item_not_object", vars: { at } }); return; }
    if (!isUuid(k.uuid)) push(fieldErr(at, "uuid"));
    else if (uuids.has(k.uuid)) push(dupErr(at, "uuid"));
    else uuids.add(k.uuid);
    if (!isFilledText(k.id)) push(emptyErr(at, "id"));
    else if (displayIds.has(k.id)) push({ key: "err.dataset_id_duplicate", vars: { at, id: k.id } });
    else displayIds.add(k.id);
    if (!isFilledText(k.name)) push(emptyErr(at, "name"));
    if (k.category != null && !CATEGORIES.includes(k.category)) push(fieldErr(at, "category"));
    if (!STATUSES.includes(k.status)) push(fieldErr(at, "status"));
    if (k.type != null && !KNOWN_TYPES.has(k.type)) push(fieldErr(at, "type"));
    if (k.location != null && !isText(k.location)) push(fieldErr(at, "location"));
    if (k.notes != null && !isText(k.notes, MAX_NOTES)) push(fieldErr(at, "notes"));
    if (k.cardNumber != null && !isText(k.cardNumber)) push(fieldErr(at, "cardNumber"));
    if (k.accessLevel != null && !isText(k.accessLevel)) push(fieldErr(at, "accessLevel"));
    if (!isEpochOrNull(k.validFrom)) push(fieldErr(at, "validFrom"));
    if (!isEpochOrNull(k.validUntil)) push(fieldErr(at, "validUntil"));
    if (!isEpochOrNull(k.createdAt)) push(fieldErr(at, "createdAt"));
    if (!isEpochOrNull(k.updatedAt)) push(fieldErr(at, "updatedAt"));
  });

  const loanIds = new Set();
  loans.forEach((L, i) => {
    const at = `loans[${i}]`;
    if (!isPlainObject(L)) { push(`${at} がオブジェクトではありません。`); return; }
    if (!isFilledText(L.loanId)) push(emptyErr(at, "loanId"));
    else if (loanIds.has(L.loanId)) push(dupErr(at, "loanId"));
    else loanIds.add(L.loanId);
    if (!isUuid(L.keyUuid)) push(fieldErr(at, "keyUuid"));
    else if (!uuids.has(L.keyUuid)) push({ key: "err.dataset_key_missing", vars: { at } });
    if (!isFilledText(L.borrower)) push(emptyErr(at, "borrower"));
    if (!isEpoch(L.loanedAt)) push(fieldErr(at, "loanedAt"));
    if (!isEpochOrNull(L.dueAt)) push(fieldErr(at, "dueAt"));
    if (!isEpochOrNull(L.returnedAt)) push(fieldErr(at, "returnedAt"));
    if (L.outNotes != null && !isText(L.outNotes, MAX_NOTES)) push(fieldErr(at, "outNotes"));
    if (L.inNotes != null && !isText(L.inNotes, MAX_NOTES)) push(fieldErr(at, "inNotes"));
  });

  audit.forEach((a, i) => {
    const at = `audit[${i}]`;
    if (!isPlainObject(a)) { push(`${at} がオブジェクトではありません。`); return; }
    if (!isEpoch(a.ts)) push(fieldErr(at, "ts"));
    if (!isFilledText(a.action)) push(fieldErr(at, "action"));
    if (a.actor != null && !isText(a.actor)) push(fieldErr(at, "actor"));
    if (a.entityId != null && !isText(a.entityId, MAX_NOTES)) push(fieldErr(at, "entityId"));
    if (a.seq != null && !(Number.isInteger(a.seq) && a.seq >= 1)) push(fieldErr(at, "seq"));
    if (a.hash != null && !/^[0-9a-f]{64}$/.test(String(a.hash))) push(fieldErr(at, "hash"));
    if (a.prevHash != null && !/^[0-9a-f]{64}$/.test(String(a.prevHash))) push(fieldErr(at, "prevHash"));
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
  if (!isUuid(obj.uuid)) errors.push({ key: "err.uuid_invalid" });
  if (!isFilledText(obj.id)) errors.push({ key: "err.id_required" });
  if (!isFilledText(obj.name)) errors.push({ key: "err.name_required" });
  if (!CATEGORIES.includes(obj.category)) errors.push({ key: "err.category_invalid" });
  if (!STATUSES.includes(obj.status)) errors.push({ key: "err.status_invalid" });
  if (obj.type && !KNOWN_TYPES.has(obj.type)) errors.push({ key: "err.type_invalid" });
  if (obj.validFrom != null && obj.validUntil != null && obj.validFrom > obj.validUntil) {
    errors.push({ key: "err.valid_range" });
  }
  const clash = existingKeys.find((k) => k.id === obj.id && k.uuid !== obj.uuid);
  if (clash) errors.push({ key: "err.id_taken", vars: { id: obj.id } });
  if (isNew && existingKeys.some((k) => k.uuid === obj.uuid)) errors.push({ key: "err.uuid_duplicate" });
  return { ok: errors.length === 0, errors };
}

export function validateLoanInput({ borrower, dueAt }, key) {
  const errors = [];
  if (!key) errors.push({ key: "err.key_missing" });
  else if (key.status === "loaned") errors.push({ key: "err.already_loaned" });
  else if (key.status !== "stored") errors.push({ key: "err.not_stored" });
  if (!isFilledText(borrower)) errors.push({ key: "err.borrower_required" });
  if (!isEpochOrNull(dueAt)) errors.push({ key: "err.due_invalid" });
  return { ok: errors.length === 0, errors };
}
