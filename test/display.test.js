import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES, STATUSES, TYPE_OPTIONS, typeOptionsFor,
  translateCategory, translateStatus, translateType,
  escapeHtml, formatRelativeTime, formatLocalDateTime,
  fromLocalDatetime, toLocalDatetimeInput,
  multiHoldingLabel, multiHoldingHeading, expiringHeading, expiryPhrase,
  INCONSISTENCY_LABELS
} from "../js/display.js";

test("カテゴリーと状態の一覧が仕様どおり", () => {
  assert.deepEqual(CATEGORIES, ["physical-key", "ic-card", "card-key"]);
  assert.deepEqual(STATUSES, ["stored", "loaned", "retired"]);
});

test("種別の選択肢はカテゴリーごとに切り替わる", () => {
  assert.deepEqual(TYPE_OPTIONS["physical-key"].map((o) => o.value), ["master", "original", "spare"]);
  assert.deepEqual(TYPE_OPTIONS["ic-card"].map((o) => o.value),
    ["employee", "visitor", "contractor", "temporary", "other"]);
  assert.deepEqual(TYPE_OPTIONS["card-key"].map((o) => o.value),
    ["room-key", "access-card", "parking-card", "locker-key", "other"]);
  // 未知のカテゴリーは物理鍵の選択肢に落とす
  assert.deepEqual(typeOptionsFor("unknown"), TYPE_OPTIONS["physical-key"]);
});

test("ラベル変換は既知の値を訳し、未知の値はそのまま返す", () => {
  assert.equal(translateStatus("stored"), "保管中");
  assert.equal(translateStatus("loaned"), "貸出中");
  assert.equal(translateStatus("retired"), "廃止");
  assert.equal(translateStatus("zzz"), "zzz");
  assert.equal(translateCategory("ic-card"), "💳 ICカード");
  assert.equal(translateCategory("zzz"), "zzz");
  assert.equal(translateType("master"), "マスターキー");
  assert.equal(translateType("room-key"), "客室キー");
  assert.equal(translateType("zzz"), "zzz");
});

test("escapeHtml は属性文脈で危険な文字をすべて逃がす", () => {
  assert.equal(escapeHtml('"><img src=x onerror=alert(1)>'),
    "&quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
  assert.equal(escapeHtml("a&b"), "a&amp;b");
  assert.equal(escapeHtml("it's"), "it&#39;s");
  assert.equal(escapeHtml(null), "null");
  assert.equal(escapeHtml(123), "123");
  // 逃がした文字列には生の < > " ' & が残らない
  assert.match(escapeHtml(`&<>"'`), /^&amp;&lt;&gt;&quot;&#39;$/);
});

test("相対時間は境界で単位が切り替わる", () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeTime(0, now), "");
  assert.equal(formatRelativeTime(now + 59_000, now), "0分後");
  assert.equal(formatRelativeTime(now + 60_000, now), "1分後");
  assert.equal(formatRelativeTime(now - 90_000, now), "1分前");
  assert.equal(formatRelativeTime(now + 3_599_999, now), "59分後");
  assert.equal(formatRelativeTime(now + 3_600_000, now), "1時間後");
  assert.equal(formatRelativeTime(now - 7_200_000, now), "2時間前");
  assert.equal(formatRelativeTime(now + 86_399_999, now), "23時間後");
  assert.equal(formatRelativeTime(now + 86_400_000, now), "1日後");
  assert.equal(formatRelativeTime(now - 259_200_000, now), "3日前");
  // 1週間以上離れたら絶対表記に落とす
  const far = now + 604_800_000;
  assert.equal(formatRelativeTime(far, now), formatLocalDateTime(far));
});

test("datetime-local の値は往復しても変わらない", () => {
  for (const s of ["2026-10-09T13:45", "2000-01-01T00:00", "2038-12-31T23:59"]) {
    assert.equal(toLocalDatetimeInput(fromLocalDatetime(s)), s);
  }
  assert.equal(fromLocalDatetime(""), null);
  assert.equal(fromLocalDatetime(null), null);
  assert.equal(fromLocalDatetime("2026-13-45T99:99"), null);
  assert.equal(fromLocalDatetime("きょう"), null);
  assert.equal(toLocalDatetimeInput(0), "");
  // 秒つきも読めるが、分までに丸めて書き戻す
  assert.equal(toLocalDatetimeInput(fromLocalDatetime("2026-10-09T13:45:30")), "2026-10-09T13:45");
});

test("しきい値のラベルは設定値から組み立てる", () => {
  assert.equal(multiHoldingLabel(4), "多重貸出(4本以上)");
  assert.equal(multiHoldingLabel(2), "多重貸出(2本以上)");
  assert.equal(multiHoldingHeading(2), "多重貸出（同一借主が2本以上保持）");
});

test("カードの期限の文言", () => {
  assert.equal(expiringHeading(7), "カードの有効期限（7日以内・切れ）");
  assert.equal(expiringHeading(0), "カードの有効期限（0日以内・切れ）");
  assert.equal(expiryPhrase({ expired: true, daysOver: 3 }), "3日前に期限切れ");
  assert.equal(expiryPhrase({ expired: true, daysOver: 0 }), "本日期限切れ");
  assert.equal(expiryPhrase({ expired: false, daysLeft: 0 }), "本日まで有効");
  assert.equal(expiryPhrase({ expired: false, daysLeft: 5 }), "あと5日で期限切れ");
});

test("食い違いのラベルが両方そろっている", () => {
  assert.deepEqual(Object.keys(INCONSISTENCY_LABELS).sort(),
    ["loaned-without-record", "record-without-loaned"]);
  for (const v of Object.values(INCONSISTENCY_LABELS)) assert.ok(v.length > 0);
});
