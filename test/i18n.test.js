import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MESSAGES, LANGS } from "../js/messages.js";
import { pickLang, t, fmt, otherLang, isLang, dictionaryReport, DEFAULT_LANG } from "../js/i18n.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

test("辞書は日英で同じキーを持ち、空の値がない", () => {
  const r = dictionaryReport();
  assert.deepEqual(r.langs, ["ja", "en"]);
  assert.deepEqual(r.missingInA, []);
  assert.deepEqual(r.missingInB, []);
  assert.deepEqual(r.empty, []);
  assert.ok(r.keys > 150, `キーが ${r.keys} 件しかない`);
});

test("HTMLを含む文言はタグの数がそろっている", () => {
  assert.deepEqual(dictionaryReport().tagMismatch, []);
});

test("HTMLが参照するキーはすべて辞書にある", () => {
  const used = new Set();
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
  for (const m of html.matchAll(/data-i18n-html="([^"]+)"/g)) used.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of m[1].split(",")) used.add(pair.split(":")[1].trim());
  }
  assert.ok(used.size >= 60, `参照しているキーが ${used.size} 件しかない`);
  for (const key of used) {
    for (const lang of LANGS) {
      assert.ok(MESSAGES[lang][key] != null, `${lang} に ${key} がない`);
    }
  }
});

test("JSが参照するキーはすべて辞書にある", () => {
  const files = readdirSync(join(ROOT, "js")).filter((f) => f.endsWith(".js"));
  const used = new Set();
  for (const f of files) {
    const src = readFileSync(join(ROOT, "js", f), "utf8");
    for (const m of src.matchAll(/\b(?:t|fmt)\(lang,\s*"([^"]+)"/g)) used.add(m[1]);
    for (const m of src.matchAll(/key:\s*"(err\.[^"]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size >= 30, `参照しているキーが ${used.size} 件しかない`);
  for (const key of used) {
    for (const lang of LANGS) {
      assert.ok(MESSAGES[lang][key] != null, `${lang} に ${key} がない`);
    }
  }
});

test("置き換えの差し込みが両言語でそろっている", () => {
  const holders = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join(",");
  for (const key of Object.keys(MESSAGES.ja)) {
    assert.equal(holders(MESSAGES.en[key]), holders(MESSAGES.ja[key]),
      `${key} の差し込みが食い違う`);
  }
});

test("言語の選び方", () => {
  assert.equal(pickLang({ urlLang: "en", savedLang: "ja", browserLang: "ja" }), "en");
  assert.equal(pickLang({ urlLang: "zz", savedLang: "en", browserLang: "ja-JP" }), "en");
  assert.equal(pickLang({ savedLang: "ja", browserLang: "en-US" }), "ja");
  assert.equal(pickLang({ browserLang: "ja-JP" }), "ja");
  assert.equal(pickLang({ browserLang: "en-US" }), "en");
  assert.equal(pickLang({ browserLang: "fr-FR" }), "en");
  assert.equal(pickLang({}), DEFAULT_LANG);
  assert.equal(isLang("ja"), true);
  assert.equal(isLang("de"), false);
  assert.equal(otherLang("ja"), "en");
  assert.equal(otherLang("en"), "ja");
});

test("翻訳と差し込み", () => {
  assert.equal(t("ja", "common.save"), "保存");
  assert.equal(t("en", "common.save"), "Save");
  // 未知のキーは渡した代替、なければキーそのもの
  assert.equal(t("ja", "no.such.key", "代替"), "代替");
  assert.equal(t("ja", "no.such.key"), "no.such.key");
  // 未知の言語は日本語に落ちる
  assert.equal(t("de", "common.save"), "保存");
  assert.equal(fmt("ja", "chain.where", { seq: 12 }), "seq 12");
  assert.equal(fmt("en", "fmt.expired_days", { n: 3 }), "expired 3 days ago");
  // 値を渡し忘れたら空にする（"{undefined}" を出さない）
  assert.equal(fmt("ja", "chain.where", {}), "seq ");
});

test("英語の辞書に日本語の文字が残っていない", () => {
  const ja = /[぀-ヿ㐀-鿿]/;
  for (const [key, value] of Object.entries(MESSAGES.en)) {
    // 言語切り替えのラベルだけは相手の言語で表示する
    if (key === "header.lang") continue;
    assert.ok(!ja.test(value), `en の ${key} に日本語が残っている: ${value.slice(0, 40)}`);
  }
});

test("日本語の辞書に英語だけの文が混ざっていない", () => {
  const ja = /[぀-ヿ㐀-鿿]/;
  // 記号と差し込みだけの文言は、訳しようがないので対象外
  const allowed = new Set(["app.title", "header.lang", "fmt.key_label"]);
  for (const [key, value] of Object.entries(MESSAGES.ja)) {
    if (allowed.has(key)) continue;
    const text = value.replace(/<[^>]+>/g, "").replace(/[A-Za-z0-9\s.,:;/()"'{}#=+-]/g, "");
    assert.ok(text.length === 0 || ja.test(value), `ja の ${key} が日本語でない`);
  }
});
