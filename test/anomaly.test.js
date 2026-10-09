import test from "node:test";
import assert from "node:assert/strict";
import {
  borrowerKey, activeLoans, overdueHours, detectOverdue, detectMultiHolding,
  detectExpiredCards, detectLongMasterLoan, detectNoDueDate, detectInconsistent,
  kpi, DEFAULTS
} from "../js/anomaly.js";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const HOUR = 3_600_000;

const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;

function key(n, over = {}) {
  return {
    uuid: U(n), id: `KEY-00${n}`, name: `鍵${n}`, category: "physical-key",
    type: "original", status: "stored", location: "", notes: "",
    createdAt: NOW - 10 * DAY, updatedAt: NOW - 10 * DAY, ...over
  };
}

function loan(n, over = {}) {
  return {
    loanId: `L-${n}`, keyUuid: U(n), borrower: `emp-${n}`,
    loanedAt: NOW - DAY, dueAt: NOW + DAY, returnedAt: null,
    outNotes: null, inNotes: null, ...over
  };
}

test("借主キーは空白・全半角・大文字小文字をそろえる", () => {
  assert.equal(borrowerKey("T.Yamada"), "t.yamada");
  assert.equal(borrowerKey(" T.Yamada "), "t.yamada");
  assert.equal(borrowerKey("Ｔ．Ｙａｍａｄａ"), "t.yamada"); // 全角英字はNFKCで半角へ
  assert.equal(borrowerKey("emp 12345"), "emp 12345");
  assert.equal(borrowerKey(null), "");
});

test("返却済みの貸出は現用から外れる", () => {
  const loans = [loan(1), loan(2, { returnedAt: NOW - HOUR })];
  assert.equal(activeLoans(loans).length, 1);
  assert.equal(activeLoans(loans)[0].loanId, "L-1");
  assert.deepEqual(activeLoans(null), []);
});

test("期限超過は未返却かつ期限を過ぎたものだけ", () => {
  const loans = [
    loan(1, { dueAt: NOW - 24 * HOUR }),
    loan(2, { dueAt: NOW + HOUR }),
    loan(3, { dueAt: null }),
    loan(4, { dueAt: NOW - 48 * HOUR, returnedAt: NOW - HOUR })
  ];
  const od = detectOverdue(loans, NOW);
  assert.deepEqual(od.map((L) => L.loanId), ["L-1"]);
  assert.equal(overdueHours(od[0], NOW), 24);
  assert.equal(overdueHours(loan(9, { dueAt: null }), NOW), 0);
});

test("期限超過は古い順に並ぶ", () => {
  const loans = [loan(1, { dueAt: NOW - HOUR }), loan(2, { dueAt: NOW - 5 * HOUR })];
  assert.deepEqual(detectOverdue(loans, NOW).map((L) => L.loanId), ["L-2", "L-1"]);
});

test("多重保持はしきい値以上のときだけ出る", () => {
  const loans = [1, 2, 3].map((n) => loan(n, { borrower: "emp-1" }));
  assert.deepEqual(detectMultiHolding(loans, 4), []);
  const four = [1, 2, 3, 4].map((n) => loan(n, { borrower: "emp-1" }));
  const r = detectMultiHolding(four, 4);
  assert.equal(r.length, 1);
  assert.equal(r[0].count, 4);
  assert.equal(r[0].keyUuids.length, 4);
  assert.deepEqual(detectMultiHolding(four, 2).map((x) => x.count), [4]);
});

test("表記の違う同じ借主は1人として数える", () => {
  const loans = [
    loan(1, { borrower: "T.Yamada" }),
    loan(2, { borrower: " t.yamada" }),
    loan(3, { borrower: "T.Yamada " })
  ];
  const r = detectMultiHolding(loans, 3);
  assert.equal(r.length, 1);
  assert.equal(r[0].count, 3);
  assert.deepEqual(r[0].spellings, [" t.yamada", "T.Yamada", "T.Yamada "]);
});

test("多重保持は本数の多い順に並ぶ", () => {
  const loans = [
    loan(1, { borrower: "a" }), loan(2, { borrower: "a" }),
    loan(3, { borrower: "b" }), loan(4, { borrower: "b" }), loan(5, { borrower: "b" })
  ];
  assert.deepEqual(detectMultiHolding(loans, 2).map((x) => x.count), [3, 2]);
});

test("期限切れカードは廃止を除き、貸出中かどうかも返す", () => {
  const keys = [
    key(1, { category: "ic-card", type: "visitor", validUntil: NOW - DAY, status: "loaned" }),
    key(2, { category: "card-key", type: "room-key", validUntil: NOW + 3 * DAY }),
    key(3, { category: "ic-card", type: "employee", validUntil: NOW - DAY, status: "retired" }),
    key(4, { category: "ic-card", type: "employee", validUntil: NOW + 30 * DAY }),
    key(5, { category: "physical-key", validUntil: NOW - DAY }),
    key(6, { category: "ic-card", type: "employee" })
  ];
  const loans = [loan(1, { borrower: "T.Yamada" })];
  const r = detectExpiredCards(keys, loans, NOW, 7);
  assert.deepEqual(r.map((x) => x.id), ["KEY-001", "KEY-002"]);
  assert.equal(r[0].expired, true);
  assert.equal(r[0].loaned, true);
  assert.equal(r[0].borrower, "T.Yamada");
  assert.equal(r[1].expired, false);
  assert.equal(r[1].daysLeft, 3);
  assert.equal(r[1].daysOver, 0);
  // 3日と少し過ぎている場合は「3日」と数える（切り上げない）
  const late = detectExpiredCards(
    [key(7, { category: "ic-card", type: "visitor", validUntil: NOW - 3 * DAY - HOUR })],
    [], NOW, 7);
  assert.equal(late[0].daysOver, 3);
  assert.equal(late[0].daysLeft, 0);
  assert.equal(r[1].loaned, false);
});

test("マスターキーの長期貸出だけを拾う", () => {
  const keys = [key(1, { type: "master", status: "loaned" }), key(2, { type: "original", status: "loaned" })];
  const loans = [
    loan(1, { loanedAt: NOW - 10 * DAY }),
    loan(2, { loanedAt: NOW - 30 * DAY })
  ];
  const r = detectLongMasterLoan(keys, loans, NOW, 7);
  assert.deepEqual(r.map((x) => x.id), ["KEY-001"]);
  assert.equal(r[0].days, 10);
  assert.deepEqual(detectLongMasterLoan(keys, loans, NOW, 30), []);
});

test("返却期限のない貸出を拾う", () => {
  const loans = [loan(1, { dueAt: null }), loan(2)];
  assert.deepEqual(detectNoDueDate(loans).map((L) => L.loanId), ["L-1"]);
});

test("状態と貸出記録の食い違いを拾う", () => {
  const keys = [key(1, { status: "loaned" }), key(2, { status: "stored" })];
  const loans = [loan(2)];
  const r = detectInconsistent(keys, loans);
  assert.deepEqual(r.map((x) => [x.id, x.kind]), [
    ["KEY-001", "loaned-without-record"],
    ["KEY-002", "record-without-loaned"]
  ]);
  assert.deepEqual(detectInconsistent([key(1, { status: "loaned" })], [loan(1)]), []);
});

test("KPIは鍵と貸出から計算する", () => {
  const keys = [
    key(1, { status: "loaned" }), key(2), key(3, { status: "retired" }),
    key(4, { category: "ic-card", type: "visitor", validUntil: NOW - DAY })
  ];
  const loans = [loan(1, { dueAt: NOW - HOUR })];
  const v = kpi(keys, loans, { multiThreshold: 4 }, NOW);
  assert.deepEqual(v, { total: 4, loaned: 1, overdue: 1, multi: 0, expiring: 1 });
  assert.equal(kpi([], [], {}, NOW).total, 0);
  assert.equal(DEFAULTS.multiThreshold, 4);
});
