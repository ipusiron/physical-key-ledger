// db.js - IndexedDB thin wrapper + schema
// Exports: openDB, dbApi {keys, loans, audit, settings}
// Stores: keys (by uuid), loans (by loanId), audit (auto seq, ts index), meta (settings)
//
// Every write that changes the ledger goes through one readwrite transaction
// so that a failure in the middle cannot leave a key marked as loaned without
// a matching loan record.

export const DB_NAME = "physical-key-ledger";
export const DB_VERSION = 3;

// Key of the chain head stored in "meta". See audit-chain.js.
export const CHAIN_HEAD_KEY = "auditChainHead";

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = req.result;
      const oldVersion = e.oldVersion;
      const upgradeTx = e.currentTarget.transaction;

      // keys store
      if (!db.objectStoreNames.contains("keys")) {
        const keysStore = db.createObjectStore("keys", { keyPath: "uuid" });
        keysStore.createIndex("by_id", "id", { unique: true });
        keysStore.createIndex("by_status", "status");
        keysStore.createIndex("by_name", "name");
        keysStore.createIndex("by_category", "category");
        keysStore.createIndex("by_cardNumber", "cardNumber", { unique: false });
        keysStore.createIndex("by_validUntil", "validUntil");
      } else if (oldVersion < 2) {
        // Upgrade from v1 to v2: add the indices introduced with card support
        const keysStore = upgradeTx.objectStore("keys");
        if (!keysStore.indexNames.contains("by_category")) {
          keysStore.createIndex("by_category", "category");
        }
        if (!keysStore.indexNames.contains("by_cardNumber")) {
          keysStore.createIndex("by_cardNumber", "cardNumber", { unique: false });
        }
        if (!keysStore.indexNames.contains("by_validUntil")) {
          keysStore.createIndex("by_validUntil", "validUntil");
        }
      }

      // loans store
      if (!db.objectStoreNames.contains("loans")) {
        const s = db.createObjectStore("loans", { keyPath: "loanId" });
        s.createIndex("by_keyUuid", "keyUuid");
        s.createIndex("by_borrower", "borrower");
        s.createIndex("by_active", "returnedAt");
        s.createIndex("by_dueAt", "dueAt");
      }

      // meta/settings store
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }

      // audit log store.
      // v1/v2 used the millisecond timestamp as the primary key, so two
      // entries written in the same millisecond overwrote each other.
      // v3 switches to an auto-incrementing sequence number and keeps ts
      // as an index.
      if (!db.objectStoreNames.contains("audit")) {
        createAuditStore(db);
      } else if (oldVersion < 3) {
        migrateAuditStore(db, upgradeTx);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(Object.assign(new Error("db-blocked"), { i18nKey: "err.db_blocked" }));
  });
}

function createAuditStore(db) {
  const s = db.createObjectStore("audit", { keyPath: "seq", autoIncrement: true });
  s.createIndex("by_ts", "ts");
  return s;
}

// Reads the old audit entries, rebuilds the store and writes them back in
// timestamp order. Entries that shared a millisecond were already lost before
// this migration runs; nothing here can bring them back.
function migrateAuditStore(db, upgradeTx) {
  const old = upgradeTx.objectStore("audit");
  const collected = [];
  old.openCursor().onsuccess = (ev) => {
    const c = ev.target.result;
    if (c) {
      collected.push(c.value);
      c.continue();
      return;
    }
    db.deleteObjectStore("audit");
    const s = createAuditStore(db);
    collected.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    for (const entry of collected) {
      const copy = { ...entry };
      delete copy.seq;
      s.add(copy);
    }
  };
}

// Helpers
function tx(db, mode, ...stores) {
  const t = db.transaction(stores, mode);
  const m = {};
  for (const name of stores) m[name] = t.objectStore(name);
  return { t, ...m };
}

function done(t, value) {
  return new Promise((res, rej) => {
    t.oncomplete = () => res(typeof value === "function" ? value() : value);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error("トランザクションが中止されました。"));
  });
}

function reqToPromise(r) {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function collect(store, out) {
  store.openCursor().onsuccess = (e) => {
    const c = e.target.result;
    if (c) { out.push(c.value); c.continue(); }
  };
}

// Appends one audit entry inside an existing transaction. The seal callback
// receives the previous entry (or null) and returns the entry to store, which
// is how the hash chain is built without a second transaction.
//
// The head of the chain (last seq and hash) is written to the meta store in
// the same transaction. Without it, cutting the newest entries off the log
// would leave a chain that still verifies.
export function appendAuditInTx(auditStore, metaStore, draft, seal) {
  auditStore.openCursor(null, "prev").onsuccess = (e) => {
    const c = e.target.result;
    const prev = c ? c.value : null;
    const entry = seal ? seal(draft, prev) : draft;
    const req = auditStore.add(entry);
    if (metaStore && entry.hash) {
      req.onsuccess = (ev) => {
        metaStore.put({ key: CHAIN_HEAD_KEY, value: { seq: ev.target.result, hash: entry.hash } });
      };
    }
  };
}

export const dbApi = {
  async getAllKeys(db) {
    const { t, keys } = tx(db, "readonly", "keys");
    const out = [];
    collect(keys, out);
    return done(t, () => out);
  },
  async getKeyByUuid(db, uuid) {
    const { keys } = tx(db, "readonly", "keys");
    return (await reqToPromise(keys.get(uuid))) || null;
  },
  async getKeyById(db, id) {
    const { keys } = tx(db, "readonly", "keys");
    return (await reqToPromise(keys.index("by_id").get(id))) || null;
  },

  async getAllLoans(db) {
    const { t, loans } = tx(db, "readonly", "loans");
    const out = [];
    collect(loans, out);
    return done(t, () => out);
  },
  async getActiveLoanByKey(db, keyUuid) {
    const { t, loans } = tx(db, "readonly", "loans");
    const out = [];
    loans.index("by_keyUuid").openCursor(IDBKeyRange.only(keyUuid)).onsuccess = (e) => {
      const c = e.target.result;
      if (c) {
        if (c.value.returnedAt == null) out.push(c.value);
        c.continue();
      }
    };
    return done(t, () => out[0] || null);
  },

  // --- atomic ledger operations ------------------------------------------
  // keys + loans + audit are written in one transaction: either all of it
  // lands or none of it does.

  async putKeyWithAudit(db, keyObj, auditDraft, seal) {
    const { t, keys, audit, meta } = tx(db, "readwrite", "keys", "audit", "meta");
    keys.put(keyObj);
    appendAuditInTx(audit, meta, auditDraft, seal);
    return done(t, true);
  },

  async deleteKeyWithAudit(db, uuid, auditDraft, seal) {
    const { t, keys, loans, audit, meta } = tx(db, "readwrite", "keys", "loans", "audit", "meta");
    let blocked = false;
    loans.index("by_keyUuid").openCursor(IDBKeyRange.only(uuid)).onsuccess = (e) => {
      const c = e.target.result;
      if (c) {
        if (c.value.returnedAt == null) { blocked = true; t.abort(); return; }
        c.continue();
        return;
      }
      keys.delete(uuid);
      appendAuditInTx(audit, meta, auditDraft, seal);
    };
    try {
      return await done(t, true);
    } catch (err) {
      if (blocked) throw Object.assign(new Error("delete-blocked"), { i18nKey: "err.delete_blocked" });
      throw err;
    }
  },

  async createLoanAtomic(db, { keyObj, loan, auditDraft }, seal) {
    const { t, keys, loans, audit, meta } = tx(db, "readwrite", "keys", "loans", "audit", "meta");
    keys.put(keyObj);
    loans.put(loan);
    appendAuditInTx(audit, meta, auditDraft, seal);
    return done(t, true);
  },

  async returnLoanAtomic(db, { keyObj, loan, auditDraft }, seal) {
    const { t, keys, loans, audit, meta } = tx(db, "readwrite", "keys", "loans", "audit", "meta");
    if (keyObj) keys.put(keyObj);
    loans.put(loan);
    appendAuditInTx(audit, meta, auditDraft, seal);
    return done(t, true);
  },

  async addAudit(db, auditDraft, seal) {
    const { t, audit, meta } = tx(db, "readwrite", "audit", "meta");
    appendAuditInTx(audit, meta, auditDraft, seal);
    return done(t, true);
  },

  async getAllAuditAsc(db, limit = 100000) {
    const { t, audit } = tx(db, "readonly", "audit");
    const out = [];
    audit.openCursor().onsuccess = (e) => {
      const c = e.target.result;
      if (c && out.length < limit) { out.push(c.value); c.continue(); }
    };
    return done(t, () => out);
  },
  async getAllAuditDesc(db, limit = 500) {
    const { t, audit } = tx(db, "readonly", "audit");
    const out = [];
    audit.openCursor(null, "prev").onsuccess = (e) => {
      const c = e.target.result;
      if (c && out.length < limit) { out.push(c.value); c.continue(); }
    };
    return done(t, () => out);
  },
  async getLastAudit(db) {
    const { t, audit } = tx(db, "readonly", "audit");
    let last = null;
    audit.openCursor(null, "prev").onsuccess = (e) => {
      const c = e.target.result;
      if (c) last = c.value;
    };
    return done(t, () => last);
  },

  // settings
  async getSetting(db, key) {
    const { meta } = tx(db, "readonly", "meta");
    const r = await reqToPromise(meta.get(key));
    return r ? r.value : null;
  },
  async setSetting(db, key, value) {
    const { t, meta } = tx(db, "readwrite", "meta");
    meta.put({ key, value });
    return done(t, true);
  },

  // import/export
  async exportAll(db) {
    const [keys, loans, audit] = await Promise.all([
      this.getAllKeys(db), this.getAllLoans(db), this.getAllAuditAsc(db)
    ]);
    return { keys, loans, audit };
  },

  // The caller validates the dataset first (js/validate.js). Clearing and
  // writing happen in the same transaction, so a failure leaves the previous
  // ledger untouched.
  async importAllReplace(db, dataset, auditDraft, seal) {
    const { t, keys, loans, audit, meta } = tx(db, "readwrite", "keys", "loans", "audit", "meta");
    keys.clear();
    loans.clear();
    audit.clear();
    meta.delete(CHAIN_HEAD_KEY);
    for (const k of dataset.keys || []) keys.put(k);
    for (const l of dataset.loans || []) loans.put(l);
    for (const a of dataset.audit || []) {
      const copy = { ...a };
      delete copy.seq;
      audit.add(copy);
    }
    appendAuditInTx(audit, meta, auditDraft, seal);
    return done(t, true);
  }
};
