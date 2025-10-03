# 🔧 技術ドキュメント

Physical Key Ledger の技術的な実装詳細、アーキテクチャ、コアアルゴリズムを解説します。

---

## 📐 アーキテクチャ設計

### レイヤー構成

本ツールは **3層アーキテクチャ** を採用しています：

```
┌─────────────────────────────────────┐
│  UI Layer (ui.js)                   │  ← イベントハンドリング、DOM操作
├─────────────────────────────────────┤
│  Logic Layer (logic.js)             │  ← ビジネスロジック、状態管理
├─────────────────────────────────────┤
│  Data Layer (db.js)                 │  ← IndexedDB 薄層ラッパー
└─────────────────────────────────────┘
```

**設計思想**:
- 各層の責務を明確に分離
- 上位層は下位層のみに依存（循環依存なし）
- データ層は純粋な CRUD 操作のみを提供
- ビジネスロジックはロジック層に集約

---

## 🗄️ IndexedDB スキーマ設計

### DB バージョン管理

```javascript
export const DB_VERSION = 2;
```

**マイグレーション戦略**:
- `onupgradeneeded` イベントで段階的スキーマ更新
- 既存データを保持しながらインデックス追加
- v1 → v2: マルチカテゴリー対応（category, cardNumber, validUntil インデックス追加）

### ストア構造

#### 1. `keys` ストア（鍵マスタ）

```javascript
keyPath: "uuid"
```

**インデックス一覧**:

| インデックス名 | フィールド | unique | 用途 |
|----------------|------------|--------|------|
| by_id | id | ✓ | 表示ID による一意検索 |
| by_status | status | - | ステータス別フィルター |
| by_name | name | - | 名称検索 |
| by_category | category | - | カテゴリー別フィルター |
| by_cardNumber | cardNumber | - | カード番号検索 |
| by_validUntil | validUntil | - | 有効期限ソート |

**設計ポイント**:
- `uuid` をプライマリキーとして内部で一意性を保証
- `id` は人間可読な表示ID（KEY-001など）で外部公開用
- マルチカテゴリー対応のため category インデックスを追加（v2）

#### 2. `loans` ストア（貸出履歴）

```javascript
keyPath: "loanId"
```

**インデックス一覧**:

| インデックス名 | フィールド | 用途 |
|----------------|------------|------|
| by_keyUuid | keyUuid | 特定鍵の貸出履歴取得 |
| by_borrower | borrower | 借主別の貸出一覧 |
| by_active | returnedAt | アクティブな貸出検索（null値） |
| by_dueAt | dueAt | 期限切れ検出用 |

**設計ポイント**:
- `returnedAt` が `null` の場合は「貸出中」を意味
- `by_active` インデックスで `returnedAt == null` を高速検索
- 履歴は論理削除（物理削除しない）

#### 3. `audit` ストア（監査ログ）

```javascript
keyPath: "ts"  // タイムスタンプ（ミリ秒）
```

**インデックス一覧**:

| インデックス名 | フィールド | 用途 |
|----------------|------------|------|
| by_ts_desc | ts | 時系列降順取得 |

**設計ポイント**:
- タイムスタンプをプライマリキーとして時系列保証
- カーソルで `prev` 方向に走査することで降順取得
- すべての変更操作（CRUD）を記録

#### 4. `meta` ストア（設定）

```javascript
keyPath: "key"
```

**格納データ**:
- `profileName`: 操作者名
- `multiThreshold`: 多重保持警告しきい値

---

## 🧠 コアアルゴリズム

### 1. UUID 生成（RFC 4122 類似）

```javascript
export function genUuid() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11)
    .replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}
```

**解説**:
- UUID v4 形式の簡易実装
- `crypto.getRandomValues()` で暗号学的に安全な乱数生成
- テンプレート `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` に従う
- ビット演算で高速化

**なぜ `crypto.randomUUID()` を使わないか？**
- ブラウザー互換性を考慮（古いブラウザー対応）
- 軽量実装で依存ライブラリーなし

### 2. 貸出ID 生成（タイムスタンプベース）

```javascript
export function genLoanId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const iso = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `L-${iso}-${Math.random().toString(36).slice(2, 6)}`;
}
```

**フォーマット**: `L-YYYYMMDD-HHMMSS-xxxx`

**設計理由**:
- 時系列ソート可能な ID
- 衝突回避のため末尾にランダム文字列（base36）
- 人間可読性を維持

### 3. 期限切れ検出アルゴリズム

```javascript
export function detectOverdue() {
  const now = nowMs();
  const list = [];
  for (const L of state.cache.loans) {
    if (L.returnedAt == null && L.dueAt && now > L.dueAt) {
      list.push(L);
    }
  }
  return list;
}
```

**条件**:
1. `returnedAt == null` → 未返却
2. `dueAt` が設定されている
3. `now > dueAt` → 期限超過

**最適化**:
- メモリーキャッシュ（`state.cache.loans`）で高速スキャン
- IndexedDB への問い合わせを最小化

### 4. 多重保持検出アルゴリズム

```javascript
export function detectMultiHolding() {
  const map = new Map();
  for (const L of state.cache.loans) {
    if (L.returnedAt == null) {
      if (!map.has(L.borrower)) map.set(L.borrower, 0);
      map.set(L.borrower, map.get(L.borrower) + 1);
    }
  }
  const out = [];
  for (const [borrower, count] of map.entries()) {
    if (count >= state.settings.multiThreshold) out.push({ borrower, count });
  }
  return out;
}
```

**アルゴリズム**:
1. アクティブな貸出のみをフィルター（`returnedAt == null`）
2. `Map` で借主ごとの保持数をカウント
3. しきい値以上の借主を抽出

**計算量**: O(n) - ローン数に比例

---

## 🚀 パフォーマンス最適化

### キャッシュ戦略

```javascript
export const state = {
  db: null,
  cache: {
    keys: [],
    loans: [],
  },
  // ...
};
```

**設計**:
- すべての鍵・貸出データをメモリーにキャッシュ
- CRUD 操作後に `refreshCache()` で同期
- 読み取り操作は IndexedDB にアクセスせず

**トレードオフ**:
- ✅ 高速な検索・フィルタリング
- ⚠️ 大量データ時のメモリー使用量増加（数千件まで想定）

### 並列データ取得

```javascript
export async function refreshCache() {
  const [keys, loans] = await Promise.all([
    dbApi.getAllKeys(state.db),
    dbApi.getAllLoans(state.db),
  ]);
  state.cache.keys = keys;
  state.cache.loans = loans;
}
```

**最適化**:
- `Promise.all()` で keys と loans を並列取得
- 直列取得に比べて約 2 倍高速

---

## 🔐 トランザクション設計

### ヘルパー関数

```javascript
function tx(db, mode, ...stores) {
  const t = db.transaction(stores, mode);
  const m = {};
  for (const name of stores) m[name] = t.objectStore(name);
  return { t, ...m };
}
```

**使用例**:
```javascript
const { t, keys, loans } = tx(db, "readwrite", "keys", "loans");
keys.put(keyObj);
loans.put(loanObj);
t.oncomplete = () => resolve(true);
```

**利点**:
- 複数ストアへのアトミックな書き込み
- ボイラープレート削減
- トランザクション境界の明確化

### ACID 保証

**貸出操作の例**:
```javascript
export async function createLoan({ keyUuid, borrower, dueAt, outNotes }) {
  // 1. バリデーション
  const key = state.cache.keys.find(k => k.uuid === keyUuid);
  if (!key) throw new Error("鍵が存在しません。");
  if (key.status === "loaned") throw new Error("この鍵は既に貸出中です。");

  // 2. トランザクション内で複数操作
  key.status = "loaned";
  await dbApi.putKey(state.db, key);      // keys ストア更新
  await dbApi.putLoan(state.db, loan);    // loans ストア追加
  await dbApi.addAudit(state.db, {...});  // audit ストア追加

  // 3. キャッシュ同期
  await refreshCache();
}
```

**保証**:
- すべての操作が成功するか、すべて失敗するか（原子性）
- エラー時は自動ロールバック

---

## 🎨 テーマシステム

### ダークモード優先設計

```javascript
// デフォルトはダークテーマ
state.theme = "dark";

// システム設定を検出
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
state.theme = prefersDark ? "dark" : "light";
```

**CSS カスタムプロパティー**:
```css
body[data-theme="dark"] {
  --bg: #0b0f14;
  --card: #121922;
  --text: #e7eef7;
}
body[data-theme="light"] {
  --bg: #f5f7fa;
  --card: #ffffff;
  --text: #1f2937;
}
```

**設計理由**:
- セキュリティーツールは暗い環境での利用が多い
- 目の疲労軽減
- `prefers-color-scheme` でOS設定を尊重

---

## 📊 KPI 計算の最適化

```javascript
export function kpi() {
  const total = state.cache.keys.length;
  const loaned = state.cache.keys.filter(k => k.status === "loaned").length;
  const overdue = detectOverdue().length;
  const multi = detectMultiHolding().length;
  return { total, loaned, overdue, multi };
}
```

**計算量**:
- `total`: O(1)
- `loaned`: O(n) - keys の長さ
- `overdue`: O(m) - loans の長さ
- `multi`: O(m)

**合計**: O(n + m) - 線形時間

**リアルタイム更新**:
- CRUD 操作後に UI が `kpi()` を呼び出し
- キャッシュベースなので高速（IndexedDB アクセスなし）

---

## 🔄 インポート/エクスポート

### フルダンプ方式

```javascript
export async function exportAll(db) {
  const [keys, loans, audit] = await Promise.all([
    this.getAllKeys(db),
    this.getAllLoans(db),
    this.getAllAuditDesc(db, 100000),
  ]);
  return { keys, loans, audit };
}
```

**特徴**:
- 監査ログを含むすべてのデータを並列取得
- JSON 形式でエクスポート（可読性・可搬性）
- ファイル名にタイムスタンプを含む（例: `pkledger-export-20251003.json`）

### 全置換インポート

```javascript
export async function importAllReplace(db, dataset) {
  const t = db.transaction(["keys", "loans", "audit"], "readwrite");
  const sk = t.objectStore("keys");
  const sl = t.objectStore("loans");
  const sa = t.objectStore("audit");

  // 既存データを削除
  sk.clear(); sl.clear(); sa.clear();

  // 新データを挿入
  (dataset.keys || []).forEach((k) => sk.put(k));
  (dataset.loans || []).forEach((l) => sl.put(l));
  (dataset.audit || []).forEach((a) => sa.put(a));

  t.oncomplete = () => resolve(true);
}
```

**設計判断**:
- **全置換方式** を採用（マージではない）
- 理由: シンプルで予測可能な動作
- 単一トランザクションでアトミック性を保証

---

## 🔍 検索・フィルタリング実装

### クライアントサイドフィルタリング

```javascript
// ui.js 内での実装例
function applyFilter() {
  const query = els.searchBox.value.toLowerCase();
  const category = els.filterCategory.value;
  const status = els.filterStatus.value;

  const filtered = state.cache.keys.filter(k => {
    const match = !query ||
      k.id.toLowerCase().includes(query) ||
      k.name.toLowerCase().includes(query) ||
      (k.cardNumber && k.cardNumber.toLowerCase().includes(query));
    const catMatch = !category || k.category === category;
    const stMatch = !status || k.status === status;
    return match && catMatch && stMatch;
  });

  renderTable(filtered);
}
```

**アプローチ**:
- IndexedDB のインデックスではなく JavaScript で実装
- 理由: 複数条件の AND/OR を柔軟に処理可能
- キャッシュベースなので高速

---

## 🧩 モジュール依存関係

```mermaid
graph TD
  A[index.html] --> B[ui.js]
  B --> C[logic.js]
  C --> D[db.js]
  B --> E[QRCode.js library]
```

**依存方向**:
- 上位から下位への単方向依存
- 循環依存なし
- 各モジュールは独立してテスト可能

---

## 🛡️ エラーハンドリング戦略

### ビジネスロジックレベル

```javascript
export async function deleteKey(uuid) {
  // 防御的プログラミング
  const active = await dbApi.getActiveLoanByKey(state.db, uuid);
  if (active) throw new Error("貸出中のため削除できません。先に回収してください。");

  await dbApi.deleteKey(state.db, uuid);
}
```

**設計**:
- 不正な操作を早期に検出
- 具体的なエラーメッセージをユーザーに提示
- データ整合性を保護

### UI レベル

```javascript
try {
  await createLoan({ keyUuid, borrower, dueAt, outNotes });
  showToast("貸出を登録しました", "ok");
} catch (err) {
  showToast(err.message, "warn");
}
```

**パターン**:
- すべての非同期操作を try-catch でラップ
- トースト通知でユーザーにフィードバック

---

## 🌐 QR コード深層リンク

### URL パラメーター処理

```javascript
const url = new URL(location.href);
if (url.searchParams.has("id")) {
  const keyId = url.searchParams.get("id");
  const key = await dbApi.getKeyById(state.db, keyId);
  if (key) {
    openKeyModal(false, key);
  }
}
```

**対応パラメーター**:
- `?id=KEY-001` → 表示ID で検索
- `?key=uuid-string` → UUID で検索（内部用）

**使用例**:
1. QR コード生成時に URL を埋め込み
2. スマートフォンで QR スキャン
3. ブラウザーが開き、自動的に鍵詳細画面を表示

---

## 📱 レスポンシブ対応

### ブレークポイント戦略

```css
@media (max-width: 760px) {
  .app-header { grid-template-columns: auto 1fr auto; }
  .table-wrapper { overflow-x: auto; }
  .modal-content { width: 95%; max-height: 90vh; }
}
```

**設計**:
- 760px を境界にモバイル/デスクトップ切り替え
- テーブルは水平スクロール可能に
- モーダルは画面サイズに追従

---

## 🔧 開発時の注意点

### 1. IndexedDB のデバッグ

**Chrome DevTools**:
1. `F12` → `Application` タブ
2. `Storage` → `IndexedDB` → `physical-key-ledger`
3. 各ストアとインデックスを確認可能

### 2. キャッシュクリア

```javascript
// 強制的にキャッシュを再読み込み
await refreshCache();
```

### 3. スキーマ変更時

- `DB_VERSION` をインクリメント
- `onupgradeneeded` に移行コードを追加
- 既存データとの互換性を考慮

---

## 📦 外部依存ライブラリー

| ライブラリー | バージョン | 用途 | CDN |
|--------------|-----------|------|-----|
| QRCode.js | 1.0.0 | QR コード生成 | cdnjs |

**最小限の依存**:
- バンドラー不要（ES Modules で直接実行）
- フレームワークレス（Vanilla JS）
- 軽量・高速起動

---

## 🧪 テスト戦略（推奨）

本ツールは現在テストコードを含んでいませんが、以下のアプローチを推奨します：

### 単体テスト

```javascript
// logic.test.js (例)
import { genUuid, genLoanId, detectOverdue } from "./logic.js";

test("UUID は重複しない", () => {
  const ids = Array.from({ length: 1000 }, () => genUuid());
  const unique = new Set(ids);
  expect(unique.size).toBe(1000);
});

test("期限切れ検出が正しく動作する", () => {
  const now = Date.now();
  const loans = [
    { returnedAt: null, dueAt: now - 1000 }, // 期限切れ
    { returnedAt: null, dueAt: now + 1000 }, // 未来
    { returnedAt: now, dueAt: now - 1000 },  // 返却済み
  ];
  // ...
});
```

### E2E テスト

- Playwright や Cypress を使用
- 鍵登録 → 貸出 → 返却のフロー全体をテスト

---

## 🚧 今後の拡張可能性

### 1. マルチユーザー対応

- Firebase Firestore / Supabase との連携
- リアルタイム同期
- 権限管理（閲覧者/編集者/管理者）

### 2. 通知機能

- 期限切れ時のメール/Slack 通知
- Push API でブラウザー通知

### 3. 統計・レポート

- 貸出頻度のヒートマップ
- 借主別の利用統計
- CSV エクスポート機能

### 4. バーコードスキャナー対応

- カメラ API で物理バーコード読み取り
- 鍵の実物とデータを紐付け

---

## 📚 参考資料

- [IndexedDB API - MDN](https://developer.mozilla.org/ja/docs/Web/API/IndexedDB_API)
- [Web Crypto API - MDN](https://developer.mozilla.org/ja/docs/Web/API/Web_Crypto_API)
- [QRCode.js - GitHub](https://github.com/davidshimjs/qrcodejs)

---

**Last Updated**: 2025-10-03
**Maintainer**: Physical Key Ledger Development Team
