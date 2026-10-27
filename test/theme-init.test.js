// js/theme-init.js decides the theme before the first paint. Run it in a fake
// window with a chosen saved value and OS setting, and read the attributes back.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const SRC = read("js/theme-init.js");

function element() {
  const attrs = {};
  return { attrs, setAttribute: (k, v) => { attrs[k] = v; } };
}

// prefers: "light" | "dark" | "none" (no OS preference) | "nomatch" (no matchMedia)
// bodyLater: <body> is not there yet; the observer callback inserts it afterwards
function run({ saved = null, prefers = "none", storageThrows = false, bodyLater = true } = {}) {
  const html = element();
  const body = element();
  const document = { documentElement: html, body: bodyLater ? null : body };
  let callback = null;
  let disconnected = false;
  const window = {
    document,
    localStorage: { getItem: () => { if (storageThrows) throw new Error("blocked"); return saved; } },
    MutationObserver: class {
      constructor(cb) { callback = cb; }
      observe(target, options) { assert.equal(target, html); assert.deepEqual({ ...options }, { childList: true }); }
      disconnect() { disconnected = true; }
    }
  };
  if (prefers !== "nomatch") {
    window.matchMedia = (q) => ({ matches: q === `(prefers-color-scheme: ${prefers})` });
  }
  vm.runInNewContext(SRC, { window });
  if (bodyLater) {
    assert.ok(callback, "<body> を待つ observer がない");
    document.body = body;
    callback([]);
    assert.ok(disconnected, "<body> に付けたあと observer を外していない");
  }
  return { html: html.attrs["data-theme"], body: body.attrs["data-theme"] };
}

test("保存値がなければ OS の設定に従う（OSがダークのときだけダーク）", () => {
  assert.equal(run({ prefers: "dark" }).html, "dark");
  assert.equal(run({ prefers: "light" }).html, "light");
  assert.equal(run({ prefers: "none" }).html, "light");
  assert.equal(run({ prefers: "nomatch" }).html, "light");
});

test("保存値は OS の設定より優先する", () => {
  assert.equal(run({ saved: "light", prefers: "dark" }).html, "light");
  assert.equal(run({ saved: "dark", prefers: "light" }).html, "dark");
});

test("想定外の保存値は無視して OS の設定に従う", () => {
  assert.equal(run({ saved: "blue", prefers: "dark" }).html, "dark");
  assert.equal(run({ saved: "blue", prefers: "light" }).html, "light");
});

test("localStorage が使えなくても落ちず、OS の設定に従う", () => {
  assert.equal(run({ storageThrows: true, prefers: "dark" }).html, "dark");
});

test("<body> にも同じ値を付ける（CSSは body[data-theme] で配色を切り替える）", () => {
  assert.deepEqual(run({ saved: "light", prefers: "dark" }), { html: "light", body: "light" });
  assert.deepEqual(run({ prefers: "dark" }), { html: "dark", body: "dark" });
  assert.deepEqual(run({ saved: "light", bodyLater: false }), { html: "light", body: "light" });
});

test("index.html の <head> で、stylesheet のあとに同期で読み込む", () => {
  const html = read("index.html");
  const head = html.slice(0, html.indexOf("</head>"));
  assert.ok(head.includes('<script src="./js/theme-init.js"></script>'), "<head> に theme-init.js がない（defer・async・module も付けない）");
  assert.ok(head.indexOf("css/style.css") < head.indexOf("js/theme-init.js"));
});

test("保存キーとロジック側の引き継ぎ", () => {
  assert.ok(SRC.includes('getItem("theme")'));
  assert.ok(read("js/logic.js").includes('localStorage.setItem("theme", state.theme)'));
  assert.ok(read("js/logic.js").includes('document.documentElement.getAttribute("data-theme")'));
});
