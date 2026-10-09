import test from "node:test";
import assert from "node:assert/strict";
import { isUuid, validateDataset, validateKeyInput, validateLoanInput, MAX_TEXT } from "../js/validate.js";

const NOW = 1_700_000_000_000;
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function goodKey(over = {}) {
  return {
    uuid: UUID_A, id: "KEY-001", name: "研究室入口", category: "physical-key",
    type: "master", status: "stored", location: "2F", notes: "",
    createdAt: NOW, updatedAt: NOW, ...over
  };
}

function goodLoan(over = {}) {
  return {
    loanId: "L-20261009-120000-abcd", keyUuid: UUID_A, borrower: "emp-12345",
    loanedAt: NOW, dueAt: NOW + 86400000, returnedAt: null,
    outNotes: null, inNotes: null, ...over
  };
}

function goodSet(over = {}) {
  return { keys: [goodKey()], loans: [goodLoan()], audit: [], ...over };
}

test("UUIDの形だけを通す", () => {
  assert.equal(isUuid(UUID_A), true);
  assert.equal(isUuid("11111111-1111-4111-8111-11111111111"), false);
  assert.equal(isUuid('"><img src=x onerror=alert(1)>'), false);
  assert.equal(isUuid(""), false);
  assert.equal(isUuid(null), false);
  assert.equal(isUuid(123), false);
});

test("正しい台帳データは通る", () => {
  const r = validateDataset(goodSet());
  assert.equal(r.ok, true, r.errors.join(" / "));
  assert.deepEqual(r.counts, { keys: 1, loans: 1, audit: 0 });
});

test("配列や空オブジェクトは台帳データとして拒否する", () => {
  for (const bad of [[], null, 0, "", "[]", [goodKey()]]) {
    const r = validateDataset(bad);
    assert.equal(r.ok, false, `${JSON.stringify(bad)} を通してはいけない`);
  }
  // 空の {} は keys / loans が無いので拒否
  assert.equal(validateDataset({}).ok, false);
  // 中身が空でも形が合っていれば通る（全削除のインポートは明示的な操作）
  assert.equal(validateDataset({ keys: [], loans: [], audit: [] }).ok, true);
});

test("uuidがUUID形式でない鍵は拒否する（インポート経由のXSSを止める）", () => {
  const r = validateDataset(goodSet({ keys: [goodKey({ uuid: '"><img src=x onerror=alert(1)>' })] }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.vars && e.vars.field === "uuid"));
});

test("表示IDの重複は拒否する（by_id は一意インデックス）", () => {
  const r = validateDataset(goodSet({
    keys: [goodKey(), goodKey({ uuid: UUID_B })],
    loans: []
  }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.key.includes("duplicate")));
});

test("鍵の必須項目と値の範囲を検査する", () => {
  const cases = [
    [{ id: "" }, "id"],
    [{ name: "   " }, "name"],
    [{ status: "unknown" }, "status"],
    [{ category: "door" }, "category"],
    [{ type: "skeleton" }, "type"],
    [{ validUntil: "2026-10-09" }, "validUntil"],
    [{ notes: "あ".repeat(1001) }, "notes"],
    [{ id: "x".repeat(MAX_TEXT + 1) }, "id"]
  ];
  for (const [over, field] of cases) {
    const r = validateDataset(goodSet({ keys: [goodKey(over)], loans: [] }));
    assert.equal(r.ok, false, `${field} を通してはいけない`);
    assert.ok(r.errors.some((e) => e.vars && e.vars.field === field),
      `${field} のエラーが出ていない: ${JSON.stringify(r.errors)}`);
  }
});

test("貸出は実在する鍵を指していなければならない", () => {
  const r = validateDataset(goodSet({ loans: [goodLoan({ keyUuid: UUID_B })] }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.key === "err.dataset_key_missing"));
});

test("貸出IDの重複と日時の型を検査する", () => {
  assert.equal(validateDataset(goodSet({ loans: [goodLoan(), goodLoan()] })).ok, false);
  assert.equal(validateDataset(goodSet({ loans: [goodLoan({ loanedAt: null })] })).ok, false);
  assert.equal(validateDataset(goodSet({ loans: [goodLoan({ dueAt: "明日" })] })).ok, false);
  assert.equal(validateDataset(goodSet({ loans: [goodLoan({ returnedAt: NOW })] })).ok, true);
});

test("監査ログの形も検査する", () => {
  const entry = { ts: NOW, actor: "local-admin", action: "key.create", entityId: UUID_A, diff: {} };
  assert.equal(validateDataset(goodSet({ audit: [entry] })).ok, true);
  assert.equal(validateDataset(goodSet({ audit: [{ ...entry, ts: "いま" }] })).ok, false);
  assert.equal(validateDataset(goodSet({ audit: [{ ...entry, action: "" }] })).ok, false);
  assert.equal(validateDataset(goodSet({ audit: [{ ...entry, seq: 0 }] })).ok, false);
  assert.equal(validateDataset(goodSet({ audit: [{ ...entry, hash: "zz" }] })).ok, false);
  assert.equal(validateDataset(goodSet({ audit: "all" })).ok, false);
});

test("エラーはすべて辞書のキーで返る", () => {
  const r = validateDataset({ keys: [goodKey({ uuid: "bad" })], loans: [], audit: [] });
  assert.equal(r.ok, false);
  for (const e of r.errors) {
    assert.ok(typeof e.key === "string" && e.key.startsWith("err."), JSON.stringify(e));
  }
});

test("エラーの件数は上限で打ち切る", () => {
  const keys = Array.from({ length: 30 }, () => goodKey({ uuid: "bad", id: "", name: "" }));
  const r = validateDataset({ keys, loans: [], audit: [] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length <= 12);
});

test("鍵フォームの入力検査", () => {
  const existing = [goodKey({ uuid: UUID_B, id: "KEY-002" })];
  assert.equal(validateKeyInput(goodKey(), existing, true).ok, true);
  assert.equal(validateKeyInput(goodKey({ id: "KEY-002" }), existing, true).ok, false);
  assert.equal(validateKeyInput(goodKey({ name: "" }), existing, true).ok, false);
  assert.equal(validateKeyInput(goodKey({ uuid: "nope" }), existing, true).ok, false);
  const span = validateKeyInput(goodKey({ validFrom: NOW + 1000, validUntil: NOW }), existing, true);
  assert.equal(span.ok, false);
  assert.ok(span.errors.some((e) => e.key === "err.valid_range"));
  // 既存の鍵を編集するときは自分の表示IDと衝突しない
  assert.equal(validateKeyInput(goodKey({ uuid: UUID_B, id: "KEY-002" }), existing, false).ok, true);
});

test("貸出フォームの入力検査（廃止した鍵は貸し出せない）", () => {
  const stored = goodKey();
  assert.equal(validateLoanInput({ borrower: "emp-1", dueAt: null }, stored).ok, true);
  assert.equal(validateLoanInput({ borrower: "", dueAt: null }, stored).ok, false);
  const retired = validateLoanInput({ borrower: "emp-1", dueAt: null }, goodKey({ status: "retired" }));
  assert.equal(retired.ok, false);
  assert.ok(retired.errors.some((e) => e.key === "err.not_stored"));
  const loaned = validateLoanInput({ borrower: "emp-1", dueAt: null }, goodKey({ status: "loaned" }));
  assert.equal(loaned.ok, false);
  assert.ok(loaned.errors.some((e) => e.key === "err.already_loaned"));
  assert.equal(validateLoanInput({ borrower: "emp-1", dueAt: null }, null).ok, false);
});
