import test from "node:test";
import assert from "node:assert/strict";
import {
  GENESIS, HASH_RE, stableStringify, canonicalForm, entryHash, sealEntry,
  chainHeadOf, verifyChain, describeResult, REASON_LABELS
} from "../js/audit-chain.js";

const TS = 1_700_000_000_000;

function draft(n, over = {}) {
  return {
    ts: TS + n * 1000,
    actor: "local-admin",
    action: "key.create",
    entityId: `11111111-1111-4111-8111-00000000000${n}`,
    diff: { name: `鍵${n}` },
    ...over
  };
}

// Builds a sealed chain the way the database does: one entry at a time,
// each sealed against the previous one, with seq assigned in order.
function buildChain(count) {
  const out = [];
  let prev = null;
  for (let i = 1; i <= count; i++) {
    const entry = { ...sealEntry(draft(i), prev), seq: i };
    out.push(entry);
    prev = entry;
  }
  return out;
}

test("安定したJSONはキーの順序に依存しない", () => {
  assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
  assert.equal(stableStringify({ a: { d: 1, c: [3, { f: 1, e: 2 }] } }),
    '{"a":{"c":[3,{"e":2,"f":1}],"d":1}}');
  assert.equal(stableStringify(undefined), "null");
  assert.equal(stableStringify(null), "null");
  assert.equal(stableStringify("日本語"), '"日本語"');
});

test("エクスポートとインポートを通してもハッシュが変わらない", () => {
  const chain = buildChain(3);
  const roundTrip = JSON.parse(JSON.stringify(chain));
  for (let i = 0; i < chain.length; i++) {
    assert.equal(entryHash(roundTrip[i], roundTrip[i].prevHash), chain[i].hash);
  }
  assert.equal(verifyChain(roundTrip).ok, true);
});

test("最初のエントリーは創世ハッシュにつながる", () => {
  const first = sealEntry(draft(1), null);
  assert.equal(first.prevHash, GENESIS);
  assert.match(first.hash, HASH_RE);
  assert.equal(first.hash, entryHash(first, GENESIS));
  // 連番はハッシュの対象外（IndexedDBが後から振るため）
  assert.equal(entryHash({ ...first, seq: 99 }, GENESIS), first.hash);
});

test("正しい連鎖は検証を通る", () => {
  const chain = buildChain(5);
  const r = verifyChain(chain);
  assert.equal(r.ok, true, JSON.stringify(r.breaks));
  assert.equal(r.checked, 5);
  assert.equal(r.unchained, 0);
  assert.deepEqual(r.head, { seq: 5, hash: chain[4].hash });
});

test("内容を書き換えると、その1件を指して検出する", () => {
  const chain = buildChain(4);
  chain[1] = { ...chain[1], actor: "someone-else" };
  const r = verifyChain(chain);
  assert.equal(r.ok, false);
  assert.deepEqual(r.breaks.map((b) => [b.seq, b.reason]), [[2, "hash-mismatch"]]);
  // 以降のエントリーは、書き換えられた側に残っている古いハッシュを指して
  // いるので連鎖自体は続く。壊れた位置が1点に絞れる
  assert.equal(r.checked, 4);
});

test("ハッシュごと作り直して1件を差し替えると、次のエントリーで切れる", () => {
  const chain = buildChain(4);
  const forged = sealEntry({ ...draft(2), actor: "someone-else" }, chain[0]);
  chain[1] = { ...forged, seq: 2 };
  const r = verifyChain(chain);
  assert.equal(r.ok, false);
  assert.deepEqual(r.breaks.map((b) => [b.seq, b.reason]), [[3, "prev-mismatch"]]);
});

test("途中を削除すると検出する", () => {
  const chain = buildChain(4);
  chain.splice(1, 1);
  const r = verifyChain(chain);
  assert.equal(r.ok, false);
  assert.equal(r.breaks[0].reason, "prev-mismatch");
  assert.equal(r.breaks[0].seq, 3);
});

test("偽のエントリーを挿入すると検出する", () => {
  const chain = buildChain(3);
  const fake = { ...sealEntry(draft(9), null), seq: 2.5 };
  chain.splice(2, 0, fake);
  const r = verifyChain(chain);
  assert.equal(r.ok, false);
  assert.ok(r.breaks.some((b) => b.reason === "prev-mismatch"));
});

test("並べ替えても検出する", () => {
  const chain = buildChain(3);
  const swapped = [chain[0], chain[2], chain[1]];
  // seqを入れ替えて並べ直しても、順序はseqで決まるので内容の不一致が出る
  const r = verifyChain(swapped.map((e, i) => ({ ...e, seq: i + 1 })));
  assert.equal(r.ok, false);
});

test("末尾を削ると、記録してある末尾との比較で検出する", () => {
  const chain = buildChain(4);
  const head = chainHeadOf(chain);
  const truncated = chain.slice(0, 3);
  // 末尾の記録がなければ、残った部分は整合して見える
  assert.equal(verifyChain(truncated).ok, true);
  // 記録してある末尾と突き合わせると食い違う
  const r = verifyChain(truncated, head);
  assert.equal(r.ok, false);
  assert.equal(r.headMatches, false);
  assert.ok(r.breaks.some((b) => b.reason === "head-mismatch"));
});

test("古い形式（ハッシュなし）のログは対象外として数える", () => {
  const legacy = [
    { seq: 1, ts: TS, actor: "old", action: "key.create", entityId: "x", diff: {} },
    { seq: 2, ts: TS + 1, actor: "old", action: "key.update", entityId: "x", diff: {} }
  ];
  const sealedStart = sealEntry(draft(3), null);
  const mixed = [...legacy, { ...sealedStart, seq: 3 }];
  const r = verifyChain(mixed);
  assert.equal(r.ok, true);
  assert.equal(r.unchained, 2);
  assert.equal(r.checked, 1);
});

test("連鎖が始まったあとのハッシュなしは異常として扱う", () => {
  const chain = buildChain(3);
  delete chain[1].hash;
  delete chain[1].prevHash;
  const r = verifyChain(chain);
  assert.equal(r.ok, false);
  assert.ok(r.breaks.some((b) => b.reason === "missing-hash"));
});

test("結果の説明文が状況に応じて変わる", () => {
  assert.match(describeResult(verifyChain([])), /監査ログがありません/);
  assert.match(describeResult(verifyChain(buildChain(2))), /2件を検証しました。改ざんは検出されませんでした/);
  const broken = buildChain(3);
  broken[0] = { ...broken[0], action: "loan.create" };
  assert.match(describeResult(verifyChain(broken)), /seq 1 で問題を検出/);
  for (const key of Object.keys(REASON_LABELS)) {
    assert.ok(REASON_LABELS[key].length > 0);
  }
});

test("同じ内容でも前のハッシュが違えば別のハッシュになる", () => {
  const a = sealEntry(draft(1), null);
  const b = sealEntry(draft(1), { hash: "f".repeat(64) });
  assert.notEqual(a.hash, b.hash);
  assert.equal(canonicalForm(draft(1), GENESIS).includes(GENESIS), true);
});
