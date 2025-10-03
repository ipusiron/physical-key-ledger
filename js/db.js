// db.js - IndexedDB thin wrapper + schema
// Exports: openDB, db API {keys, loans, audit, settings}
// Stores: keys (by uuid), loans (by loanId), audit (ts desc index), meta (settings)

export const DB_NAME = "physical-key-ledger";
export const DB_VERSION = 2;

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = req.result;
      const oldVersion = e.oldVersion;

      // keys store
      let keysStore;
      if (!db.objectStoreNames.contains("keys")) {
        keysStore = db.createObjectStore("keys", { keyPath: "uuid" });
        keysStore.createIndex("by_id", "id", { unique: true });
        keysStore.createIndex("by_status", "status");
        keysStore.createIndex("by_name", "name");
        keysStore.createIndex("by_category", "category");
        keysStore.createIndex("by_cardNumber", "cardNumber", { unique: false });
        keysStore.createIndex("by_validUntil", "validUntil");
      } else if (oldVersion < 2) {
        // Upgrade from v1 to v2: add new indices
        keysStore = e.currentTarget.transaction.objectStore("keys");
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
        // For overdue scan, we need dueAt index
        s.createIndex("by_dueAt", "dueAt");
      }

      // audit log store
      if (!db.objectStoreNames.contains("audit")) {
        const s = db.createObjectStore("audit", { keyPath: "ts" });
        s.createIndex("by_ts_desc", "ts");
      }

      // meta/settings store
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Helpers
function tx(db, mode, ...stores) {
  const t = db.transaction(stores, mode);
  const m = {};
  for (const name of stores) m[name] = t.objectStore(name);
  return { t, ...m };
}

export const dbApi = {
  async getAllKeys(db) {
    return new Promise((res, rej) => {
      const { t, keys } = tx(db, "readonly", "keys");
      const out = [];
      keys.openCursor().onsuccess = (e) => {
        const c = e.target.result;
        if (c) { out.push(c.value); c.continue(); } else res(out);
      };
      t.onerror = () => rej(t.error);
    });
  },
  async getKeyByUuid(db, uuid) {
    return new Promise((res, rej) => {
      const { t, keys } = tx(db, "readonly", "keys");
      const r = keys.get(uuid);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  },
  async getKeyById(db, id) {
    return new Promise((res, rej) => {
      const { t, keys } = tx(db, "readonly", "keys");
      const idx = keys.index("by_id").get(id);
      idx.onsuccess = () => res(idx.result || null);
      idx.onerror = () => rej(idx.error);
    });
  },
  async putKey(db, keyObj) {
    return new Promise((res, rej) => {
      const { t, keys } = tx(db, "readwrite", "keys");
      keys.put(keyObj);
      t.oncomplete = () => res(true);
      t.onerror = () => rej(t.error);
    });
  },
  async deleteKey(db, uuid) {
    return new Promise((res, rej) => {
      const { t, keys } = tx(db, "readwrite", "keys");
      keys.delete(uuid);
      t.oncomplete = () => res(true);
      t.onerror = () => rej(t.error);
    });
  },

  async getAllLoans(db) {
    return new Promise((res, rej) => {
      const { t, loans } = tx(db, "readonly", "loans");
      const out = [];
      loans.openCursor().onsuccess = (e) => {
        const c = e.target.result;
        if (c) { out.push(c.value); c.continue(); } else res(out);
      };
      t.onerror = () => rej(t.error);
    });
  },
  async getActiveLoanByKey(db, keyUuid) {
    // active: returnedAt == null
    return new Promise((res, rej) => {
      const { t, loans } = tx(db, "readonly", "loans");
      const idx = loans.index("by_keyUuid");
      const out = [];
      idx.openCursor(IDBKeyRange.only(keyUuid)).onsuccess = (e) => {
        const c = e.target.result;
        if (c) {
          if (c.value.returnedAt == null) out.push(c.value);
          c.continue();
        } else res(out[0] || null);
      };
      t.onerror = () => rej(t.error);
    });
  },
  async putLoan(db, loanObj) {
    return new Promise((res, rej) => {
      const { t, loans } = tx(db, "readwrite", "loans");
      loans.put(loanObj);
      t.oncomplete = () => res(true);
      t.onerror = () => rej(t.error);
    });
  },
  async getLoansByBorrowerActive(db) {
    // return Map<borrower, activeLoans[]>
    const map = new Map();
    const loans = await this.getAllLoans(db);
    for (const L of loans) {
      if (L.returnedAt == null) {
        if (!map.has(L.borrower)) map.set(L.borrower, []);
        map.get(L.borrower).push(L);
      }
    }
    return map;
  },

  async addAudit(db, entry) {
    return new Promise((res, rej) => {
      const { t, audit } = tx(db, "readwrite", "audit");
      audit.put(entry);
      t.oncomplete = () => res(true);
      t.onerror = () => rej(t.error);
    });
  },
  async getAllAuditDesc(db, limit = 500) {
    return new Promise((res, rej) => {
      const { t, audit } = tx(db, "readonly", "audit");
      const out = [];
      audit.openCursor(null, "prev").onsuccess = (e) => {
        const c = e.target.result;
        if (c && out.length < limit) { out.push(c.value); c.continue(); }
        else res(out);
      };
      t.onerror = () => rej(t.error);
    });
  },

  // settings
  async getSetting(db, key) {
    return new Promise((res, rej) => {
      const { t, meta } = tx(db, "readonly", "meta");
      const r = meta.get(key);
      r.onsuccess = () => res(r.result ? r.result.value : null);
      r.onerror = () => rej(r.error);
    });
  },
  async setSetting(db, key, value) {
    return new Promise((res, rej) => {
      const { t, meta } = tx(db, "readwrite", "meta");
      meta.put({ key, value });
      t.oncomplete = () => res(true);
      t.onerror = () => rej(t.error);
    });
  },

  // import/export
  async exportAll(db) {
    const [keys, loans, audit] = await Promise.all([
      this.getAllKeys(db), this.getAllLoans(db), this.getAllAuditDesc(db, 100000),
    ]);
    return { keys, loans, audit };
  },
  async importAllReplace(db, dataset) {
    return new Promise((res, rej) => {
      const t = db.transaction(["keys", "loans", "audit"], "readwrite");
      const sk = t.objectStore("keys");
      const sl = t.objectStore("loans");
      const sa = t.objectStore("audit");

      // clear and put
      sk.clear(); sl.clear(); sa.clear();

      (dataset.keys || []).forEach((k) => sk.put(k));
      (dataset.loans || []).forEach((l) => sl.put(l));
      (dataset.audit || []).forEach((a) => sa.put(a));

      t.oncomplete = () => res(true);
      t.onerror = () => rej(t.error);
    });
  },
};
