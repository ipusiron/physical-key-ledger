// Static checks on index.html. These are the mistakes that are easy to make
// again by hand: an inline handler that a CSP blocks, a meta header that the
// browser ignores, or a script pulled from a CDN.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

function meta(name) {
  const re = new RegExp(`<meta[^>]+(?:name|http-equiv)="${name}"[^>]*>`, "i");
  const m = re.exec(html);
  return m ? m[0] : null;
}

test("CSPのmetaがあり、必要なディレクティブを含む", () => {
  const csp = meta("Content-Security-Policy");
  assert.ok(csp, "Content-Security-Policy のmetaがない");
  for (const d of ["default-src 'self'", "script-src 'self'", "style-src 'self'",
    "base-uri 'none'", "form-action 'none'", "object-src 'none'"]) {
    assert.ok(csp.includes(d), `CSPに ${d} がない`);
  }
  // 画像はcanvasのdata URLとBlobを使う
  assert.ok(/img-src [^;"]*data:/.test(csp), "img-src に data: がない");
});

test("metaでは効かないヘッダーを書かない", () => {
  // frame-ancestors も X-Frame-Options も meta では無視され、
  // コンソールにエラーだけを出す
  assert.equal(meta("X-Frame-Options"), null);
  assert.equal(meta("X-Content-Type-Options"), null);
  assert.ok(!/frame-ancestors/.test(meta("Content-Security-Policy") || ""),
    "metaのCSPに frame-ancestors を書かない");
});

test("referrer と favicon の指定がある", () => {
  const ref = meta("referrer");
  assert.ok(ref && ref.includes("no-referrer"), "referrer=no-referrer がない");
  assert.ok(/<link[^>]+rel="icon"/.test(html), "favicon の指定がない（Edgeが404を取りに行く）");
});

test("インラインのイベントハンドラーとstyle属性がない（CSPで動かなくなる）", () => {
  const handlers = html.match(/\son[a-z]+\s*=/gi) || [];
  assert.deepEqual(handlers, [], `インラインハンドラーが残っている: ${handlers.join(", ")}`);
  const styles = html.match(/\sstyle="/g) || [];
  assert.deepEqual(styles, [], "style属性が残っている");
});

test("スクリプトは自分のオリジンだけから読む", () => {
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.length > 0);
  for (const src of srcs) {
    assert.ok(src.startsWith("./"), `外部オリジンのスクリプト: ${src}`);
  }
  assert.ok(srcs.includes("./vendor/qrcode.min.js"), "QRCode.js は vendor/ から読む");
  assert.ok(srcs.includes("./js/ui.js"), "ui.js を読み込んでいない");
  // ui.js が import するので、db.js と logic.js を重ねて読まない
  assert.ok(!srcs.includes("./js/db.js") && !srcs.includes("./js/logic.js"));
  assert.ok(/<script src="\.\/js\/ui\.js" type="module">/.test(html), "ui.js は module で読む");
});

test("noscript と lang がある", () => {
  assert.ok(/<html lang="ja">/.test(html));
  assert.ok(/<noscript>/.test(html), "JavaScript無効時の案内がない");
});

test("検索欄とセレクトに名前が付いている", () => {
  for (const id of ["search", "filter-category", "filter-status"]) {
    const re = new RegExp(`id="${id}"[^>]*`, "s");
    const tag = re.exec(html);
    assert.ok(tag, `${id} がない`);
  }
  // aria-label は要素をまたぐので、まとめて数える
  const labels = html.match(/aria-label="/g) || [];
  assert.ok(labels.length >= 5, `aria-label が ${labels.length} 件しかない`);
  const lives = html.match(/aria-live="polite"/g) || [];
  assert.ok(lives.length >= 5, `aria-live が ${lives.length} 件しかない`);
});

test("主要な要素のidが残っている", () => {
  const ids = [
    "kpi-total", "kpi-loaned", "kpi-overdue", "kpi-multi", "kpi-multi-label",
    "heading-multi", "list-overdue", "list-multi", "tbody-keys", "search",
    "filter-category", "filter-status", "btn-new-key", "dlg-key", "form-key",
    "dlg-loan", "form-loan", "dlg-return", "form-return", "dlg-audit",
    "audit-box", "dlg-settings", "form-settings", "dlg-help", "card-fields",
    "key-category", "key-type", "qr", "qr-info", "mobile-menu",
    "kpi-expiring", "kpi-expiring-label", "heading-expiring", "list-expiring",
    "list-notice", "btn-chain-verify", "chain-result"
  ];
  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`), `id="${id}" がない`);
  }
});

test("ダイアログの閉じるボタンはdata属性で結ぶ", () => {
  const closers = html.match(/data-close-dialog/g) || [];
  assert.ok(closers.length >= 4, `data-close-dialog が ${closers.length} 件しかない`);
});

test("検索エンジンから隠す指定をしていない", () => {
  assert.equal(meta("robots"), null, "robots の noindex は外す（公開ツールのため）");
});
