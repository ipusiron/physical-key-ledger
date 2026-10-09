// Colour contrast of the theme variables, checked in both themes.
// The values come from css/style.css, so a palette change that breaks
// readability fails here instead of in a screenshot.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(ROOT, "css", "style.css"), "utf8");

// Finds the rule whose selector starts a line, so that ".btn {" does not
// match "body[data-theme=\"light\"] .btn {".
function blockOf(selector) {
  const i = css.indexOf("\n" + selector);
  assert.notEqual(i, -1, `${selector} がCSSにない`);
  const open = css.indexOf("{", i);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

// A selector can appear in more than one rule (one for the background, one
// for the variables), so merge every block that uses it.
function varsOf(selector) {
  const out = {};
  let from = 0;
  for (;;) {
    const i = css.indexOf("\n" + selector, from);
    if (i === -1) break;
    const open = css.indexOf("{", i);
    const close = css.indexOf("}", open);
    for (const m of css.slice(open + 1, close).matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
      out[m[1]] = m[2];
    }
    from = close;
  }
  assert.ok(Object.keys(out).length > 0, `${selector} にCSS変数がない`);
  return out;
}

function toRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// :root holds the defaults used before the script sets a theme.
const DEFAULTS = varsOf(":root {");
const DARK = varsOf('body[data-theme="dark"] {');
const LIGHT = varsOf('body[data-theme="light"] {');

const PAIRS = [["text", "card"], ["text", "bg"], ["muted", "card"], ["muted", "bg"],
  ["accent", "card"], ["accent", "bg"], ["warn", "card"], ["warn", "bg"],
  ["ok", "card"], ["ok", "bg"]];

test("既定の配色はダークと同じ（JSが動く前も読める）", () => {
  for (const name of ["bg", "card", "muted", "text", "accent", "warn", "ok", "border"]) {
    assert.ok(DEFAULTS[name], `:root に --${name} がない`);
    assert.equal(DEFAULTS[name].toLowerCase(), DARK[name].toLowerCase(), `--${name} が食い違う`);
  }
});

for (const [label, vars] of [["ダーク", DARK], ["ライト", LIGHT], ["既定", DEFAULTS]]) {
  test(`${label}テーマの文字と背景は4.5:1以上`, () => {
    for (const [fg, bg] of PAIRS) {
      const r = ratio(vars[fg], vars[bg]);
      assert.ok(r >= 4.5,
        `${label}: --${fg} (${vars[fg]}) on --${bg} (${vars[bg]}) = ${r.toFixed(2)}:1`);
    }
  });
}

test("計算そのものの確認（既知の値）", () => {
  assert.equal(Math.round(ratio("#000000", "#ffffff") * 100) / 100, 21);
  assert.equal(Math.round(ratio("#ffffff", "#ffffff") * 100) / 100, 1);
  // WCAG の例: #777777 on #ffffff は 4.48:1 で4.5に届かない
  assert.ok(ratio("#777777", "#ffffff") < 4.5);
});

test("タップ領域と入力欄の寸法が規約を満たす", () => {
  const btn = blockOf(".btn {");
  assert.ok(/min-height:\s*44px/.test(btn), ".btn に min-height: 44px がない");
  const input = blockOf(".input {");
  assert.ok(/min-height:\s*44px/.test(input), ".input に min-height: 44px がない");
  const size = /font-size:\s*(\d+)px/.exec(input);
  assert.ok(size && Number(size[1]) >= 16, `.input の font-size が ${size && size[1]}px（16px以上にする）`);
  assert.ok(/\.btn-sm\s*{[^}]*min-height:\s*44px/.test(css), ".btn-sm に min-height: 44px がない");
});
