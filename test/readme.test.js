// README checks: the numbers in the document are recomputed here, and the
// directory tree is compared with the files that actually exist.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";
import { detectMultiHolding, overdueHours } from "../js/anomaly.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(join(ROOT, "README.md"), "utf8");

function section(heading) {
  const i = readme.indexOf(heading);
  assert.notEqual(i, -1, `${heading} がREADMEにない`);
  const next = readme.indexOf("\n## ", i + heading.length);
  return readme.slice(i, next === -1 ? undefined : next);
}

function tableRows(block) {
  return block.split("\n")
    .filter((l) => l.trim().startsWith("|"))
    .map((l) => l.trim().slice(1, -1).split("|").map((c) => c.trim()))
    .filter((cells) => !cells.every((c) => /^-+$/.test(c)));
}

test("YAMLメタデータの構造が保たれている", () => {
  const head = readme.slice(0, readme.indexOf("-->"));
  for (const key of ["id: day087", 'slug: physical-key-ledger', 'title: "Physical Key Ledger"',
    'repo_url: "https://github.com/ipusiron/physical-key-ledger"',
    'demo_url: "https://ipusiron.github.io/physical-key-ledger/"', "hub: true"]) {
    assert.ok(head.includes(key), `YAMLに ${key} がない`);
  }
  // ブロック形式（キーの次の行が "  - "）を維持する
  for (const key of ["category_ja:", "category_en:", "tags:"]) {
    const i = head.indexOf(key);
    assert.notEqual(i, -1, `${key} がない`);
    const nextLine = head.slice(i + key.length).split("\n")[1] || "";
    assert.ok(nextLine.startsWith("  - "), `${key} がブロック形式でない: ${nextLine}`);
  }
});

test("シリーズ標準の見出しが順番どおりにある", () => {
  const order = ["## 🌐 デモページ", "## 📸 スクリーンショット", "## 🧪 テスト",
    "## 💻 動作環境", "## 📄 ライセンス", "## 🛠️ このツールについて"];
  let at = -1;
  for (const h of order) {
    const i = readme.indexOf(h);
    assert.notEqual(i, -1, `${h} がない`);
    assert.ok(i > at, `${h} の位置が前後している`);
    at = i;
  }
  assert.ok(readme.includes("**Day087 - 生成AIで作るセキュリティツール100**"));
  assert.ok(readme.includes("https://akademeia.info/?page_id=42163"));
});

test("参照している画像がすべて実在し、assets直下の画像はすべて参照されている", () => {
  const refs = [...readme.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 4, `画像の参照が ${refs.length} 件しかない`);
  for (const r of refs) {
    assert.ok(existsSync(join(ROOT, r)), `${r} が存在しない`);
  }
  const files = readdirSync(join(ROOT, "assets")).filter((f) => /\.(png|jpe?g|svg|webp)$/i.test(f));
  for (const f of files) {
    assert.ok(refs.includes(`assets/${f}`), `assets/${f} がREADMEから参照されていない`);
  }
});

test("画像のキャプションが1枚ごとに付いている", () => {
  const lines = readme.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^>!\[/.test(lines[i])) {
      assert.ok(/^>\*.+\*$/.test(lines[i + 1] || ""), `${lines[i]} の次の行にキャプションがない`);
    }
  }
});

test("ディレクトリー構造が実ファイルと一致し、全行に説明がある", () => {
  const block = section("## 📁 ディレクトリー構造");
  const fence = block.split("```")[1];
  assert.ok(fence, "ツリーのコードブロックがない");
  const lines = fence.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
  assert.equal(lines[0].trim(), "physical-key-ledger/");

  const named = [];
  for (const line of lines.slice(1)) {
    assert.ok(line.includes("# "), `説明のない行がある: ${line}`);
    const name = line.slice(0, line.indexOf("#")).replace(/[│├└─\s]/g, "");
    assert.ok(name, `名前を読み取れない行がある: ${line}`);
    named.push(name);
  }

  // 実ファイルをすべて載せている。gitが追わないもの（.gitignoreにある
  // 作業用のディレクトリー）はツリーに書かない
  const skip = new Set([".git", "node_modules", ".claude", ".vscode", ".idea", "dist"]);
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        found.push(entry + "/");
        walk(full);
      } else {
        found.push(entry);
      }
    }
  };
  walk(ROOT);
  for (const f of found) {
    assert.ok(named.includes(f), `${f} がツリーに載っていない`);
  }
  for (const n of named) {
    assert.ok(found.includes(n), `ツリーの ${n} は実在しない`);
  }
  assert.equal(relative(ROOT, ROOT), "");
  assert.ok(sep.length > 0);
});

test("多重保持の表の件数を計算し直す", () => {
  const loans = [
    { loanId: "L-1", keyUuid: "k1", borrower: "A", loanedAt: 1, dueAt: null, returnedAt: null },
    { loanId: "L-2", keyUuid: "k2", borrower: "A", loanedAt: 1, dueAt: null, returnedAt: null },
    { loanId: "L-3", keyUuid: "k3", borrower: "A", loanedAt: 1, dueAt: null, returnedAt: null },
    { loanId: "L-4", keyUuid: "k4", borrower: "B", loanedAt: 1, dueAt: null, returnedAt: null }
  ];
  const block = section("## 🎯 ユースケース");
  const rows = tableRows(block).filter((cells) => /^\d+$/.test(cells[0]));
  assert.equal(rows.length, 4, "しきい値の表が4行ない");
  for (const [thresholdText, countText] of rows) {
    const threshold = Number(thresholdText);
    const expected = detectMultiHolding(loans, threshold).length;
    assert.equal(Number(countText), expected,
      `しきい値 ${threshold} の件数が README では ${countText}、計算では ${expected}`);
  }
  // 本文に書いた「しきい値4で0件、3で1件、1で2件」も同じ計算に合う
  assert.equal(detectMultiHolding(loans, 4).length, 0);
  assert.equal(detectMultiHolding(loans, 3).length, 1);
  assert.equal(detectMultiHolding(loans, 1).length, 2);
  assert.ok(block.includes("しきい値4で0件、3で1件、1で2件"));
});

test("スクリーンショットの説明にある超過時間を計算し直す", () => {
  const now = 1_700_000_000_000;
  const loan = { dueAt: now - 26 * 3_600_000, returnedAt: null };
  assert.equal(overdueHours(loan, now), 26);
  assert.ok(readme.includes("期限を26時間超過"), "キャプションの超過時間が変わっている");
});

test("テスト一覧の表が test/ の中身と一致する", () => {
  const block = section("## 🧪 テスト");
  const listed = tableRows(block)
    .map((cells) => cells[0])
    .filter((c) => c.startsWith("`test/"))
    .map((c) => c.replace(/`/g, ""));
  const actual = readdirSync(join(ROOT, "test")).filter((f) => f.endsWith(".test.js"))
    .map((f) => `test/${f}`);
  assert.deepEqual(listed.sort(), actual.sort());
});

test("表記の規則を守っている", () => {
  const banned = [
    ["ヶ月", "カ月"], ["か月", "カ月"], ["サーバ(?!ー)", "サーバー"], ["ブラウザ(?!ー)", "ブラウザー"],
    ["ユーザ(?!ー)", "ユーザー"], ["フォルダ(?!ー)", "フォルダー"], ["パラメータ(?!ー)", "パラメーター"],
    ["エディタ(?!ー)", "エディター"], ["全て", "すべて"], ["分かる", "わかる"], ["既に", "すでに"],
    ["インターフェース", "インターフェイス"], ["アノマリ(?!ー)", "アノマリー"]
  ];
  for (const [bad, good] of banned) {
    const re = new RegExp(bad);
    const hit = readme.split("\n").find((l) => re.test(l));
    assert.ok(!hit, `「${bad}」は「${good}」に直す: ${hit}`);
  }
});

test("日本語と英数字の間に半角スペースを入れていない", () => {
  const lines = readme.split("\n");
  let inCode = false;
  const ja = "[\\u3040-\\u30ff\\u3400-\\u9fff\\uff00-\\uff9f]";
  const re1 = new RegExp(`${ja} [0-9A-Za-z]`);
  const re2 = new RegExp(`[0-9A-Za-z] ${ja}`);
  lines.forEach((line, i) => {
    if (line.trim().startsWith("```")) { inCode = !inCode; return; }
    if (inCode) return;
    // 画像・リンク・インラインコード・表の区切りは対象外
    const stripped = line.replace(/`[^`]*`/g, "`x`").replace(/\[[^\]]*\]\([^)]*\)/g, "[x](y)");
    assert.ok(!re1.test(stripped) && !re2.test(stripped),
      `README.md:${i + 1} 日本語と英数字の間に空白がある: ${line.trim().slice(0, 60)}`);
  });
});

// ---- English README -------------------------------------------------
const readmeEn = readFileSync(join(ROOT, "README.en.md"), "utf8");

function headings(text) {
  const out = [];
  let inCode = false;
  for (const line of text.split("\n")) {
    if (line.trim().startsWith("```")) { inCode = !inCode; continue; }
    if (!inCode && /^#{1,3} /.test(line)) out.push(line);
  }
  return out;
}

test("日英のREADMEが互いにリンクしている", () => {
  assert.equal(readmeEn.split("\n")[0], "English · [日本語](README.md)");
  assert.ok(readme.includes("[English](README.en.md) · 日本語"));
  // YAMLメタデータは日本語版だけに置く（hackinglab.online が読むのは README.md）
  assert.ok(!readmeEn.includes("slug: physical-key-ledger"));
});

test("英語版は日本語版と同じ見出しの数・順・階層を持つ", () => {
  const hja = headings(readme);
  const hen = headings(readmeEn);
  assert.equal(hen.length, hja.length, `見出しの数が違う（ja ${hja.length} / en ${hen.length}）`);
  hja.forEach((h, i) => {
    const level = (s) => s.match(/^#+/)[0].length;
    assert.equal(level(hen[i]), level(h), `${i + 1}番目の見出しの階層が違う: ${h} / ${hen[i]}`);
  });
});

test("英語版の画像がすべて実在し、assets/en の画像はすべて参照されている", () => {
  const refs = [...readmeEn.matchAll(/!\[[^\]]*\]\((assets\/en\/[^)]+)\)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 4, `画像の参照が ${refs.length} 件しかない`);
  for (const r of refs) assert.ok(existsSync(join(ROOT, r)), `${r} が存在しない`);
  const files = readdirSync(join(ROOT, "assets", "en")).filter((f) => /\.png$/i.test(f));
  for (const f of files) {
    assert.ok(refs.includes(`assets/en/${f}`), `assets/en/${f} が参照されていない`);
  }
});

test("英語版の多重保持の表も計算し直す", () => {
  const loans = [
    { loanId: "L-1", keyUuid: "k1", borrower: "A", loanedAt: 1, dueAt: null, returnedAt: null },
    { loanId: "L-2", keyUuid: "k2", borrower: "A", loanedAt: 1, dueAt: null, returnedAt: null },
    { loanId: "L-3", keyUuid: "k3", borrower: "A", loanedAt: 1, dueAt: null, returnedAt: null },
    { loanId: "L-4", keyUuid: "k4", borrower: "B", loanedAt: 1, dueAt: null, returnedAt: null }
  ];
  const i = readmeEn.indexOf("| Threshold | Reported | Who |");
  assert.notEqual(i, -1, "しきい値の表が英語版にない");
  const block = readmeEn.slice(i, readmeEn.indexOf("\n\n", i));
  const rows = tableRows(block).filter((cells) => /^\d+$/.test(cells[0]));
  assert.equal(rows.length, 4);
  for (const [thresholdText, countText] of rows) {
    assert.equal(Number(countText), detectMultiHolding(loans, Number(thresholdText)).length,
      `しきい値 ${thresholdText} の件数が英語版で合わない`);
  }
  assert.ok(readmeEn.includes("Overdue by 26 hours") || readmeEn.includes("26 hours overdue"),
    "キャプションの超過時間が英語版にない");
});

test("英語版に日本語が残っていない（1行目とコードブロックを除く）", () => {
  const ja = /[぀-ヿ㐀-鿿]/;
  const lines = readmeEn.split("\n");
  let inCode = false;
  lines.forEach((line, i) => {
    if (line.trim().startsWith("```")) { inCode = !inCode; return; }
    if (inCode || i === 0) return;
    assert.ok(!ja.test(line), `README.en.md:${i + 1} に日本語が残っている: ${line.trim().slice(0, 50)}`);
  });
});

test("英語版のテスト一覧も test/ の中身と一致する", () => {
  const i = readmeEn.indexOf("| Test | What it checks |");
  assert.notEqual(i, -1);
  const block = readmeEn.slice(i, readmeEn.indexOf("\n\n", i));
  const listed = tableRows(block).map((c) => c[0]).filter((c) => c.startsWith("`test/"))
    .map((c) => c.replace(/`/g, ""));
  const actual = readdirSync(join(ROOT, "test")).filter((f) => f.endsWith(".test.js"))
    .map((f) => `test/${f}`);
  assert.deepEqual(listed.sort(), actual.sort());
});
