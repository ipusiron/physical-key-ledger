import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES, STATUSES, TYPE_OPTIONS, typeOptionsFor,
  translateCategory, translateStatus, translateType,
  escapeHtml, formatRelativeTime, formatLocalDateTime,
  fromLocalDatetime, toLocalDatetimeInput,
  multiHoldingLabel, multiHoldingHeading, expiringHeading, expiryPhrase,
  inconsistencyLabel
} from "../js/display.js";

test("カテゴリーと状態の一覧が仕様どおり", () => {
  assert.deepEqual(CATEGORIES, ["physical-key", "ic-card", "card-key"]);
  assert.deepEqual(STATUSES, ["stored", "loaned", "retired"]);
});

test("種別の選択肢はカテゴリーごとに切り替わる", () => {
  assert.deepEqual(TYPE_OPTIONS["physical-key"], ["master", "original", "spare"]);
  assert.deepEqual(TYPE_OPTIONS["ic-card"],
    ["employee", "visitor", "contractor", "temporary", "other"]);
  assert.deepEqual(TYPE_OPTIONS["card-key"],
    ["room-key", "access-card", "parking-card", "locker-key", "other"]);
  // 未知のカテゴリーは物理鍵の選択肢に落とす
  assert.deepEqual(typeOptionsFor("unknown"), TYPE_OPTIONS["physical-key"]);
});

test("ラベル変換は言語ごとに訳し、未知の値はそのまま返す", () => {
  assert.equal(translateStatus("ja", "stored"), "保管中");
  assert.equal(translateStatus("ja", "loaned"), "貸出中");
  assert.equal(translateStatus("ja", "retired"), "廃止");
  assert.equal(translateStatus("ja", "zzz"), "zzz");
  assert.equal(translateStatus("en", "stored"), "In storage");
  assert.equal(translateCategory("ja", "ic-card"), "💳 ICカード");
  assert.equal(translateCategory("en", "ic-card"), "💳 IC card");
  assert.equal(translateCategory("ja", "zzz"), "zzz");
  assert.equal(translateType("ja", "master"), "マスターキー");
  assert.equal(translateType("en", "master"), "Master key");
  assert.equal(translateType("ja", "room-key"), "客室キー");
  assert.equal(translateType("en", "zzz"), "zzz");
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
  assert.equal(formatRelativeTime(0, now, "ja"), "");
  assert.equal(formatRelativeTime(now + 59_000, now, "ja"), "0分後");
  assert.equal(formatRelativeTime(now + 60_000, now, "ja"), "1分後");
  assert.equal(formatRelativeTime(now - 90_000, now, "ja"), "1分前");
  assert.equal(formatRelativeTime(now + 3_599_999, now, "ja"), "59分後");
  assert.equal(formatRelativeTime(now + 3_600_000, now, "ja"), "1時間後");
  assert.equal(formatRelativeTime(now - 7_200_000, now, "ja"), "2時間前");
  assert.equal(formatRelativeTime(now + 86_399_999, now, "ja"), "23時間後");
  assert.equal(formatRelativeTime(now + 86_400_000, now, "ja"), "1日後");
  assert.equal(formatRelativeTime(now - 259_200_000, now, "ja"), "3日前");
  // 1週間以上離れたら絶対表記に落とす（言語によらない）
  const far = now + 604_800_000;
  assert.equal(formatRelativeTime(far, now, "ja"), formatLocalDateTime(far));
  assert.equal(formatRelativeTime(far, now, "en"), formatLocalDateTime(far));
});

test("相対時間の英語表記", () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeTime(now + 60_000, now, "en"), "in 1 min");
  assert.equal(formatRelativeTime(now - 90_000, now, "en"), "1 min ago");
  assert.equal(formatRelativeTime(now + 3_600_000, now, "en"), "in 1 h");
  assert.equal(formatRelativeTime(now - 7_200_000, now, "en"), "2 h ago");
  assert.equal(formatRelativeTime(now + 86_400_000, now, "en"), "in 1 day");
  assert.equal(formatRelativeTime(now + 2 * 86_400_000, now, "en"), "in 2 days");
  assert.equal(formatRelativeTime(now - 86_400_000, now, "en"), "1 day ago");
  assert.equal(formatRelativeTime(now - 259_200_000, now, "en"), "3 days ago");
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
  assert.equal(multiHoldingLabel("ja", 4), "多重貸出(4本以上)");
  assert.equal(multiHoldingLabel("ja", 2), "多重貸出(2本以上)");
  assert.equal(multiHoldingHeading("ja", 2), "多重貸出（同一借主が2本以上保持）");
  assert.equal(multiHoldingLabel("en", 4), "Multi-holding (4+ keys)");
  assert.equal(multiHoldingHeading("en", 2), "Multi-holding (one borrower with 2 or more keys)");
});

test("カードの期限の文言", () => {
  assert.equal(expiringHeading("ja", 7), "カードの有効期限（7日以内・切れ）");
  assert.equal(expiringHeading("ja", 0), "カードの有効期限（0日以内・切れ）");
  assert.equal(expiryPhrase("ja", { expired: true, daysOver: 3 }), "3日前に期限切れ");
  assert.equal(expiryPhrase("ja", { expired: true, daysOver: 0 }), "本日期限切れ");
  assert.equal(expiryPhrase("ja", { expired: false, daysLeft: 0 }), "本日まで有効");
  assert.equal(expiryPhrase("ja", { expired: false, daysLeft: 5 }), "あと5日で期限切れ");
  assert.equal(expiryPhrase("en", { expired: true, daysOver: 3 }), "expired 3 days ago");
  assert.equal(expiryPhrase("en", { expired: false, daysLeft: 5 }), "expires in 5 days");
});

test("食い違いのラベルが両方そろっている", () => {
  for (const lang of ["ja", "en"]) {
    for (const kind of ["loaned-without-record", "record-without-loaned"]) {
      const label = inconsistencyLabel(lang, kind);
      assert.ok(label.length > 0 && label !== kind, `${lang}/${kind} の文言がない`);
    }
  }
});
