// Source-format checks: catch minified or truncated files before they ship.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Line endings differ between the working tree (CRLF on Windows) and git
// (LF, core.autocrlf=input), so measure without the carriage return.
function lines(rel) {
  return readFileSync(join(ROOT, rel), "utf8").split("\n").map((l) => l.replace(/\r$/, ""));
}

function maxLen(rel) {
  return lines(rel).reduce((m, l) => Math.max(m, l.length), 0);
}

const JS_FILES = readdirSync(join(ROOT, "js")).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`);
const TEST_FILES = readdirSync(join(ROOT, "test")).filter((f) => f.endsWith(".js")).map((f) => `test/${f}`);

// Minimum line counts: a file that shrinks below this was probably minified
// or written over by mistake.
const MIN_LINES = {
  "index.html": 300,
  "css/style.css": 400,
  "js/db.js": 150,
  "js/logic.js": 150,
  "js/ui.js": 400,
  "js/display.js": 100,
  "js/anomaly.js": 100,
  "js/validate.js": 100
};

test("JSとテストの最長行は160文字以下", () => {
  for (const f of [...JS_FILES, ...TEST_FILES]) {
    assert.ok(maxLen(f) <= 160, `${f} の最長行が ${maxLen(f)} 文字`);
  }
});

test("CSSの最長行は160文字以下", () => {
  assert.ok(maxLen("css/style.css") <= 160, `css/style.css の最長行が ${maxLen("css/style.css")} 文字`);
});

test("index.html の最長行は250文字以下", () => {
  assert.ok(maxLen("index.html") <= 250, `index.html の最長行が ${maxLen("index.html")} 文字`);
});

test("主要ファイルが1行に詰め込まれていない", () => {
  for (const [f, min] of Object.entries(MIN_LINES)) {
    const n = lines(f).length;
    assert.ok(n >= min, `${f} が ${n} 行しかない（最低 ${min} 行）`);
  }
});

test("ソースに見えない文字が混ざっていない", () => {
  // Ranges are written as numbers on purpose: an editor that turns an escape
  // sequence into the real character would otherwise hide the very thing we
  // are looking for.
  const RANGES = [
    [0x0000, 0x0008], [0x000b, 0x000c], [0x000e, 0x001f],
    [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2069],
    [0x00ad, 0x00ad], [0xfeff, 0xfeff]
  ];
  const isBad = (cp) => RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
  for (const f of [...JS_FILES, ...TEST_FILES, "css/style.css", "index.html"]) {
    lines(f).forEach((line, i) => {
      for (const ch of line) {
        assert.ok(!isBad(ch.codePointAt(0)),
          `${f}:${i + 1} に制御文字・不可視文字がある（U+${ch.codePointAt(0).toString(16).toUpperCase()}）`);
      }
    });
  }
});
