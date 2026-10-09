// anomaly.js - pure anomaly detection and KPI calculation (no DOM, no IndexedDB)
// Every function takes the data and "now" explicitly so that results are
// reproducible and testable outside the browser.

const HOUR = 3600000;
const DAY = 86400000;

export const DEFAULTS = {
  multiThreshold: 4,
  expiringSoonDays: 7,
  masterLoanDays: 7
};

// Borrower names are free text. Use this key for grouping so that
// "T.Yamada", "t.yamada " and "T.Yamada" count as one person.
// The original spelling is kept for display.
export function borrowerKey(name) {
  return String(name ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function activeLoans(loans) {
  return (loans || []).filter((L) => L && L.returnedAt == null);
}

export function overdueHours(loan, now) {
  if (!loan || !loan.dueAt) return 0;
  return Math.floor((now - loan.dueAt) / HOUR);
}

// Loans past their due date that have not been returned.
export function detectOverdue(loans, now) {
  return activeLoans(loans)
    .filter((L) => L.dueAt && now > L.dueAt)
    .sort((a, b) => a.dueAt - b.dueAt);
}

// Borrowers holding "threshold" or more keys at the same time.
export function detectMultiHolding(loans, threshold = DEFAULTS.multiThreshold) {
  const map = new Map();
  for (const L of activeLoans(loans)) {
    const key = borrowerKey(L.borrower);
    if (!map.has(key)) map.set(key, { borrower: L.borrower, count: 0, keyUuids: [], spellings: new Set() });
    const entry = map.get(key);
    entry.count += 1;
    entry.keyUuids.push(L.keyUuid);
    entry.spellings.add(String(L.borrower ?? ""));
  }
  const out = [];
  for (const entry of map.values()) {
    if (entry.count >= threshold) {
      out.push({
        borrower: entry.borrower,
        count: entry.count,
        keyUuids: entry.keyUuids,
        spellings: [...entry.spellings].sort()
      });
    }
  }
  return out.sort((a, b) => b.count - a.count);
}

export function isCard(key) {
  return key && (key.category === "ic-card" || key.category === "card-key");
}

// IC cards and card keys whose validUntil has passed (or is close), excluding
// retired ones. "loaned" marks the cards that are still in someone's hands.
export function detectExpiredCards(keys, loans, now, soonDays = DEFAULTS.expiringSoonDays) {
  const active = new Map();
  for (const L of activeLoans(loans)) active.set(L.keyUuid, L);
  const out = [];
  for (const k of keys || []) {
    if (!isCard(k) || k.status === "retired" || !k.validUntil) continue;
    const remainMs = k.validUntil - now;
    if (remainMs > soonDays * DAY) continue;
    out.push({
      uuid: k.uuid,
      id: k.id,
      name: k.name,
      validUntil: k.validUntil,
      expired: remainMs < 0,
      daysLeft: Math.floor(remainMs / DAY),
      loaned: active.has(k.uuid),
      borrower: active.get(k.uuid)?.borrower || ""
    });
  }
  return out.sort((a, b) => a.validUntil - b.validUntil);
}

// Master keys kept out for longer than the configured number of days.
export function detectLongMasterLoan(keys, loans, now, days = DEFAULTS.masterLoanDays) {
  const byUuid = new Map((keys || []).map((k) => [k.uuid, k]));
  const out = [];
  for (const L of activeLoans(loans)) {
    const k = byUuid.get(L.keyUuid);
    if (!k || k.type !== "master") continue;
    const elapsed = now - L.loanedAt;
    if (elapsed < days * DAY) continue;
    out.push({
      loanId: L.loanId,
      keyUuid: L.keyUuid,
      id: k.id,
      name: k.name,
      borrower: L.borrower,
      days: Math.floor(elapsed / DAY)
    });
  }
  return out.sort((a, b) => b.days - a.days);
}

// Loans registered without a due date: nothing will ever flag them as overdue.
export function detectNoDueDate(loans) {
  return activeLoans(loans).filter((L) => !L.dueAt);
}

export function kpi(keys, loans, settings = {}, now = Date.now()) {
  const threshold = Number(settings.multiThreshold) || DEFAULTS.multiThreshold;
  const list = keys || [];
  return {
    total: list.length,
    loaned: list.filter((k) => k.status === "loaned").length,
    overdue: detectOverdue(loans, now).length,
    multi: detectMultiHolding(loans, threshold).length,
    expiring: detectExpiredCards(list, loans, now, Number(settings.expiringSoonDays) || DEFAULTS.expiringSoonDays).length
  };
}

// Keys whose status says "loaned" but have no active loan record, and the
// reverse. These mean the ledger lost track of a key.
export function detectInconsistent(keys, loans) {
  const active = new Set(activeLoans(loans).map((L) => L.keyUuid));
  const out = [];
  for (const k of keys || []) {
    if (k.status === "loaned" && !active.has(k.uuid)) {
      out.push({ uuid: k.uuid, id: k.id, kind: "loaned-without-record" });
    } else if (k.status !== "loaned" && active.has(k.uuid)) {
      out.push({ uuid: k.uuid, id: k.id, kind: "record-without-loaned" });
    }
  }
  return out;
}
