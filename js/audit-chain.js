// audit-chain.js - tamper-evident audit log (pure, no DOM, no IndexedDB)
//
// Each entry stores the hash of the entry before it, and its own hash is
// computed over its contents including that previous hash. Changing,
// inserting, deleting or reordering an entry breaks every hash after it,
// so the change can be found afterwards.
//
// What this does NOT do: it cannot stop anyone with access to the database
// from rewriting it. It makes the rewrite visible. Cutting off the newest
// entries leaves a valid chain, which is why the head (last seq and hash)
// is kept separately in the settings store and compared during verification.

import { sha256Hex } from "./sha256.js";

export const GENESIS = "0".repeat(64);
export const HASH_RE = /^[0-9a-f]{64}$/;

// Fields that the hash covers. Anything outside this list (for example the
// seq assigned by IndexedDB) is not part of the digest.
const SEALED_FIELDS = ["ts", "actor", "action", "entityId", "diff"];

// JSON with the keys in a fixed order, so that the same content always
// produces the same string after an export/import round trip.
export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

export function canonicalForm(entry, prevHash) {
  const picked = {};
  for (const f of SEALED_FIELDS) picked[f] = entry[f] ?? null;
  picked.prevHash = prevHash;
  return stableStringify(picked);
}

export function entryHash(entry, prevHash) {
  return sha256Hex(canonicalForm(entry, prevHash));
}

// Returns the entry to store: the draft plus prevHash and hash.
export function sealEntry(draft, prevEntry) {
  const prevHash = prevEntry && HASH_RE.test(String(prevEntry.hash || ""))
    ? prevEntry.hash
    : GENESIS;
  const entry = { ...draft, prevHash };
  entry.hash = entryHash(entry, prevHash);
  return entry;
}

export function chainHeadOf(entries) {
  const sealed = (entries || []).filter((e) => HASH_RE.test(String(e.hash || "")));
  if (sealed.length === 0) return null;
  const last = sealed[sealed.length - 1];
  return { seq: last.seq ?? null, hash: last.hash };
}

/**
 * Walks the log in seq order and recomputes every hash.
 *
 * Entries written before the chain existed (imported or migrated from an
 * older database) carry no hash. They are counted as "unchained" and the
 * chain is verified from the first sealed entry onwards.
 *
 * head: the { seq, hash } kept in the settings store, if any. A mismatch
 * means entries were removed from the end.
 */
export function verifyChain(entries, head = null) {
  const list = [...(entries || [])].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const result = {
    total: list.length,
    unchained: 0,
    checked: 0,
    ok: true,
    breaks: [],
    head: chainHeadOf(list),
    headMatches: null
  };

  let prevHash = GENESIS;
  let started = false;
  let lastSeq = -Infinity;

  for (const entry of list) {
    const seq = entry.seq ?? null;
    if (seq !== null) {
      if (seq <= lastSeq) {
        result.breaks.push({ seq, reason: "seq-out-of-order" });
      }
      lastSeq = seq;
    }

    const hasHash = HASH_RE.test(String(entry.hash || ""));
    if (!started && !hasHash) {
      result.unchained += 1;
      continue;
    }
    if (!hasHash) {
      result.breaks.push({ seq, reason: "missing-hash" });
      continue;
    }
    started = true;

    const expectedPrev = entry.prevHash ?? GENESIS;
    if (expectedPrev !== prevHash) {
      result.breaks.push({ seq, reason: "prev-mismatch", expected: prevHash, actual: expectedPrev });
    }
    const recomputed = entryHash(entry, expectedPrev);
    if (recomputed !== entry.hash) {
      result.breaks.push({ seq, reason: "hash-mismatch", expected: recomputed, actual: entry.hash });
    }
    prevHash = entry.hash;
    result.checked += 1;
  }

  if (head && HASH_RE.test(String(head.hash || ""))) {
    const current = result.head;
    result.headMatches = Boolean(current && current.hash === head.hash
      && (head.seq == null || current.seq === head.seq));
    if (!result.headMatches) {
      result.breaks.push({ seq: head.seq ?? null, reason: "head-mismatch" });
    }
  }

  result.ok = result.breaks.length === 0;
  return result;
}

export const REASON_LABELS = {
  "hash-mismatch": "内容が書き換えられている（再計算したハッシュが合わない）",
  "prev-mismatch": "前のエントリーとのつながりが切れている（削除か挿入）",
  "missing-hash": "ハッシュのないエントリーが途中に混ざっている",
  "seq-out-of-order": "連番の順序が壊れている",
  "head-mismatch": "最後のエントリーが削られている（記録してある末尾と一致しない）"
};

// One line for the screen and the report.
export function describeResult(r) {
  if (r.total === 0) return "監査ログがありません。";
  if (r.checked === 0) {
    return `${r.total}件すべてが連鎖の対象外です（このバージョンより前に記録されたログ）。`;
  }
  const base = `${r.checked}件を検証しました`;
  const skipped = r.unchained > 0 ? `（古い形式の${r.unchained}件は対象外）` : "";
  if (r.ok) return `${base}${skipped}。改ざんは検出されませんでした。`;
  const first = r.breaks[0];
  const where = first.seq == null ? "位置不明" : `seq ${first.seq}`;
  return `${base}${skipped}。${where} で問題を検出しました: ${REASON_LABELS[first.reason] || first.reason}`;
}
