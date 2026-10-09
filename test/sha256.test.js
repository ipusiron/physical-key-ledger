import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { sha256Hex, sha256Bytes, toHex, utf8Bytes } from "../js/sha256.js";

const nodeHex = (buf) => createHash("sha256").update(buf).digest("hex");

test("NISTのテストベクターと一致する", () => {
  assert.equal(sha256Hex(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  assert.equal(
    sha256Hex("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmno" +
      "ijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"),
    "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1");
});

test("1,000,000個の a でも一致する", () => {
  assert.equal(sha256Hex("a".repeat(1_000_000)),
    "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
});

test("日本語・絵文字・結合文字をUTF-8として扱う", () => {
  for (const s of ["研究室入口", "鍵 🔑 ICカード", "café", "café", "\u{1f600}\u{1f511}",
    "借主: T.Yamada／emp-12345"]) {
    assert.equal(sha256Hex(s), nodeHex(Buffer.from(s, "utf8")), `食い違い: ${s}`);
  }
});

test("ブロック境界の長さで一致する", () => {
  for (const n of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000]) {
    const s = "x".repeat(n);
    assert.equal(sha256Hex(s), nodeHex(Buffer.from(s, "utf8")), `長さ ${n} で食い違い`);
  }
});

test("ランダムなバイト列でもnode:cryptoと一致する", () => {
  for (let i = 0; i < 30; i++) {
    const buf = randomBytes(1 + Math.floor(Math.random() * 300));
    assert.equal(toHex(sha256Bytes(new Uint8Array(buf))), nodeHex(buf));
  }
});

test("UTF-8への変換が正しい", () => {
  assert.deepEqual([...utf8Bytes("A")], [0x41]);
  assert.deepEqual([...utf8Bytes("¢")], [0xc2, 0xa2]);
  assert.deepEqual([...utf8Bytes("あ")], [0xe3, 0x81, 0x82]);
  assert.deepEqual([...utf8Bytes("\u{1f511}")], [0xf0, 0x9f, 0x94, 0x91]);
});

test("1ビット違えば結果が変わる", () => {
  assert.notEqual(sha256Hex("KEY-001"), sha256Hex("KEY-002"));
  assert.notEqual(sha256Hex("a"), sha256Hex("A"));
});
