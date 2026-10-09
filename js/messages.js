// messages.js - Japanese and English text for the whole screen.
// The HTML carries the Japanese version as the fallback for when scripts do
// not run; everything shown with scripts enabled comes from here.
//
// Keys ending in "_html" hold markup and are written with innerHTML. They
// only ever contain text from this file, never anything a user typed.

export const MESSAGES = {
  ja: {
    "app.title": "Physical Key Ledger",
    "app.tagline": "物理鍵・ICカード・カードキーの貸出・返却を可視化し、紛失リスクを低減する管理台帳",
    "app.noscript": "このツールはJavaScriptで台帳を読み書きします。JavaScriptを有効にしてから開いてください。"
      + "データはブラウザー内（IndexedDB）にのみ保存され、外部へは送信しません。",
    "app.footer_html": '🔗 GitHubリポジトリーはこちら（ <a href="https://github.com/ipusiron/physical-key-ledger"'
      + ' target="_blank" rel="noopener">ipusiron/physical-key-ledger</a> ）',

    "header.help": "ヘルプ",
    "header.theme": "テーマ切替",
    "header.theme_mobile": "テーマ切替",
    "header.export": "エクスポート(JSON)",
    "header.export_title": "台帳をJSONで書き出す",
    "header.import": "インポート(JSON 全置換)",
    "header.import_title": "JSONを読み込んで台帳を全置換する",
    "header.audit": "監査ログ",
    "header.settings": "設定",
    "header.menu": "メニュー",
    "header.lang": "English",
    "header.lang_aria": "表示言語を切り替える",

    "dash.title": "ダッシュボード",
    "dash.total": "総鍵数",
    "dash.loaned": "貸出中",
    "dash.overdue": "期限超過",
    "dash.expiring": "期限切れ・間近のカード",
    "dash.overdue_heading": "期限超過（返却期限を過ぎて未返却）",
    "dash.notice_heading": "そのほかの注意",
    "dash.none": "なし",

    "keys.title": "鍵一覧",
    "keys.search_placeholder": "検索（ID/名称/場所/借主）",
    "keys.search_aria": "鍵の検索（ID・名称・保管場所・借主）",
    "keys.filter_category_all": "すべてのカテゴリー",
    "keys.filter_category_aria": "カテゴリーで絞り込む",
    "keys.filter_status_all": "すべての状態",
    "keys.filter_status_aria": "状態で絞り込む",
    "keys.new": "新規登録",
    "keys.table_aria": "鍵一覧",
    "keys.col_id": "ID",
    "keys.col_category": "カテゴリー",
    "keys.col_name": "名称",
    "keys.col_type": "種別",
    "keys.col_status": "状態",
    "keys.col_location": "保管場所",
    "keys.col_borrower": "貸出先",
    "keys.col_due": "返却期限",
    "keys.col_actions": "操作",
    "keys.empty": "該当する鍵がありません",
    "keys.edit": "編集",
    "keys.loan": "貸出",
    "keys.return": "回収",

    "cat.physical-key": "🔑 物理鍵",
    "cat.ic-card": "💳 ICカード",
    "cat.card-key": "🎫 カードキー",
    "status.stored": "保管中",
    "status.loaned": "貸出中",
    "status.retired": "廃止",
    "type.master": "マスターキー",
    "type.original": "純正キー",
    "type.spare": "スペアキー",
    "type.employee": "社員証",
    "type.visitor": "訪問者カード",
    "type.contractor": "業者カード",
    "type.temporary": "一時カード",
    "type.room-key": "客室キー",
    "type.access-card": "入館証",
    "type.parking-card": "駐車場カード",
    "type.locker-key": "ロッカーキー",
    "type.other": "その他",

    "key.modal_title": "鍵の登録/編集",
    "key.new_title": "鍵の新規登録",
    "key.edit_title": "鍵の編集",
    "key.id": "表示ID（物理タグ/カード番号）",
    "key.name": "名称",
    "key.name_placeholder": "研究室入口",
    "key.category": "カテゴリー",
    "key.type": "種別",
    "key.status": "状態",
    "key.location": "保管場所",
    "key.location_placeholder": "2F廊下キャビネット",
    "key.card_number": "カード番号（任意）",
    "key.access_level": "アクセスレベル（任意）",
    "key.valid_from": "有効期限（開始）",
    "key.valid_until": "有効期限（終了）",
    "key.datetime_placeholder": "クリックして日時を選択",
    "key.notes": "メモ",
    "key.notes_placeholder": "夜間は貸出不可",
    "key.qr_title": "QRコード（印刷用）",
    "key.qr_by_id": "IDで生成",
    "key.qr_by_uuid": "UUIDで生成",
    "key.qr_download": "PNG保存",
    "key.delete": "この鍵を削除",
    "key.delete_confirm": "この鍵を削除します。よろしいですか？（貸出中は削除不可）",

    "loan.title": "貸出登録",
    "loan.key_id": "鍵ID",
    "loan.borrower": "借主識別子",
    "loan.borrower_placeholder": "emp-12345 or T.Yamada",
    "loan.due": "返却期限",
    "loan.due_hint": "カレンダーから日時を選択できます",
    "loan.notes": "メモ（貸出）",
    "loan.notes_placeholder": "日中点検",
    "loan.submit": "登録",

    "return.title": "回収登録",
    "return.borrower": "借主（参考）",
    "return.notes": "返却メモ",
    "return.notes_placeholder": "破損なし",
    "return.submit": "回収",

    "audit.title": "監査ログ（最新が上）",
    "audit.note": "各エントリーは直前のエントリーのハッシュを含めて封じています（SHA-256）。"
      + "書き換え・削除・挿入・並べ替えは「整合性を検証」で検出できます。",
    "audit.verify": "整合性を検証",
    "audit.download": "JSONLダウンロード",
    "audit.empty": "(ログなし)",

    "settings.title": "設定",
    "settings.profile": "プロフィール名（ログのactor）",
    "settings.multi": "多重貸出しきい値（何本以上で警告するか）",
    "settings.expiring": "カードの有効期限を知らせる日数",
    "settings.master": "マスターキーの長期貸出とみなす日数",

    "common.cancel": "キャンセル",
    "common.save": "保存",
    "common.close": "閉じる",
    "common.required_mark": "必須",

    "err.uuid_invalid": "内部IDが不正です。",
    "err.id_required": "表示IDを入力してください（200文字以内）。",
    "err.name_required": "名称を入力してください（200文字以内）。",
    "err.category_invalid": "カテゴリーが不正です。",
    "err.status_invalid": "状態が不正です。",
    "err.type_invalid": "種別が不正です。",
    "err.valid_range": "有効期限の開始が終了より後になっています。",
    "err.id_taken": "表示ID「{id}」はすでに使われています。",
    "err.uuid_duplicate": "内部IDが重複しています。",
    "err.key_missing": "鍵が存在しません。",
    "err.already_loaned": "この鍵はすでに貸出中です。",
    "err.not_stored": "保管中の鍵だけを貸し出せます（廃止した鍵は貸し出せません）。",
    "err.borrower_required": "借主識別子を入力してください（200文字以内）。",
    "err.due_invalid": "返却期限が不正です。",
    "err.no_active_loan": "この鍵の貸出レコードが見つかりません。",
    "err.delete_blocked": "貸出中のため削除できません。先に回収してください。",
    "err.db_blocked": "ほかのタブが古いバージョンで開いています。ほかのタブを閉じてから再読み込みしてください。",
    "err.import_header": "台帳データとして読めないため、既存のデータは変更していません。",
    "err.dataset_not_object": "台帳データの形式ではありません（keys・loans・auditを持つオブジェクトが必要です）。",
    "err.dataset_not_array": "{name} が配列ではありません。",
    "err.dataset_item_not_object": "{at} がオブジェクトではありません。",
    "err.dataset_field_invalid": "{at}.{field} が不正です。",
    "err.dataset_field_empty": "{at}.{field} が空か、長すぎます。",
    "err.dataset_duplicate": "{at}.{field} が重複しています。",
    "err.dataset_id_duplicate": "{at}.id「{id}」が重複しています（表示IDは一意である必要があります）。",
    "err.dataset_key_missing": "{at}.keyUuid に対応する鍵がありません。",

    "fmt.multi_label": "多重貸出({n}本以上)",
    "fmt.multi_heading": "多重貸出（同一借主が{n}本以上保持）",
    "fmt.expiring_heading": "カードの有効期限（{n}日以内・切れ）",
    "fmt.expired_today": "本日期限切れ",
    "fmt.expired_days": "{n}日前に期限切れ",
    "fmt.valid_today": "本日まで有効",
    "fmt.valid_days": "あと{n}日で期限切れ",
    "fmt.in_minutes": "{n}分後",
    "fmt.ago_minutes": "{n}分前",
    "fmt.in_hours": "{n}時間後",
    "fmt.ago_hours": "{n}時間前",
    "fmt.in_days": "{n}日後",
    "fmt.in_days_one": "{n}日後",
    "fmt.ago_days": "{n}日前",
    "fmt.ago_days_one": "{n}日前",
    "fmt.overdue_item": "返却期限を {hours} 時間超過（{borrower} / {id}）",
    "fmt.multi_item": "同一借主が {count} 本の鍵を保持（{borrower} / しきい値 {threshold}）",
    "fmt.multi_spellings": "／表記ゆれ: {list}",
    "fmt.expiring_item": "{id} {name}: {phrase}",
    "fmt.expiring_held": "／貸出中: {borrower}",
    "fmt.master_item": "マスターキー {id}「{name}」が {days} 日間貸出中（{borrower}）",
    "fmt.no_due_item": "返却期限が未設定の貸出（{borrower} / {id}）",
    "fmt.inconsistent_item": "{id}: {reason}",
    "fmt.qr_info": "📱 QRコード内容: {url}",
    "fmt.key_label": "{id}（{short}）",

    "notice.loaned-without-record": "状態は貸出中だが、貸出の記録がない",
    "notice.record-without-loaned": "貸出の記録があるが、状態が貸出中になっていない",

    "chain.empty": "監査ログがありません。",
    "chain.all_unchained": "{total}件すべてが連鎖の対象外です（このバージョンより前に記録されたログ）。",
    "chain.all_unchained_one": "{total}件すべてが連鎖の対象外です（このバージョンより前に記録されたログ）。",
    "chain.ok": "{checked}件を検証しました{skipped}。改ざんは検出されませんでした。",
    "chain.ok_one": "{checked}件を検証しました{skipped}。改ざんは検出されませんでした。",
    "chain.ng": "{checked}件を検証しました{skipped}。{where} で問題を検出しました: {reason}",
    "chain.skipped": "（古い形式の{n}件は対象外）",
    "chain.where": "seq {seq}",
    "chain.where_unknown": "位置不明",
    "chain.more": "ほか {n} 件",
    "chain.item": "{where}: {reason}",
    "chain.reason.hash-mismatch": "内容が書き換えられている（再計算したハッシュが合わない）",
    "chain.reason.prev-mismatch": "前のエントリーとのつながりが切れている（削除か挿入）",
    "chain.reason.missing-hash": "ハッシュのないエントリーが途中に混ざっている",
    "chain.reason.seq-out-of-order": "連番の順序が壊れている",
    "chain.reason.head-mismatch": "最後のエントリーが削られている（記録してある末尾と一致しない）",
    "chain.failed": "整合性の検証に失敗しました",

    "alert.import_confirm": "JSONデータで全置換します。よろしいですか？",
    "alert.import_done": "インポート完了（鍵 {keys} 件 / 貸出 {loans} 件 / 監査ログ {audit} 件）",
    "alert.import_failed": "インポート失敗",
    "alert.import_not_json": "JSONとして読めませんでした。ファイルを確認してください。",
    "alert.not_on_device_id": "鍵ID「{id}」はこの端末の台帳にありません。",
    "alert.not_on_device_uuid": "鍵UUID「{id}」はこの端末の台帳にありません。",
    "alert.not_on_device_hint": "台帳データは端末ごとに保存されるため、登録した端末・ブラウザーで開いてください。",

    "help.title": "📖 ヘルプ - Physical Key Ledger の使い方",
    "help.basic_html": `<h4>🔰 基本的な使い方</h4>
<ol>
  <li><strong>鍵を登録する</strong><br>
    「新規登録」ボタンから、カテゴリー（物理鍵/ICカード/カードキー）を選択し、情報を入力します。<br>
    IDは物理タグ番号（例: KEY-001）として管理します。<br>
    <span class="required">*</span>マークは必須入力項目です。</li>
  <li><strong>ICカード・カードキーの場合</strong><br>
    カテゴリー選択後、カード番号・アクセスレベル・有効期限などの追加フィールドが表示されます（任意）。<br>
    種別も自動的にカテゴリーに応じた選択肢に切り替わります。</li>
  <li><strong>鍵を貸し出す</strong><br>
    鍵一覧から「貸出」ボタンをクリックし、借主識別子と返却期限を入力します。<br>
    返却期限はカレンダーから選択できます（任意）。</li>
  <li><strong>鍵を回収する</strong><br>
    貸出中の鍵の「回収」ボタンをクリックし、返却メモを入力します。<br>
    状態が自動的に「保管中」に戻ります。</li>
  <li><strong>鍵を検索・フィルターする</strong><br>
    検索欄にID、名称、場所、借主を入力して絞り込めます。<br>
    カテゴリーフィルターで「物理鍵」「ICカード」「カードキー」を選択できます。<br>
    状態ドロップダウンで「保管中」「貸出中」「廃止」を選択できます。</li>
</ol>`,
    "help.lifecycle_html": `<h4>🔄 鍵のライフサイクル</h4>
<div class="lifecycle">
  <div class="lifecycle-step"><strong>1. 登録</strong><br>新しい鍵を台帳に追加（初期状態: 保管中）</div>
  <div class="lifecycle-arrow">↓</div>
  <div class="lifecycle-step"><strong>2. 貸出</strong><br>借主に貸し出し（状態: 保管中 → 貸出中）</div>
  <div class="lifecycle-arrow">↓</div>
  <div class="lifecycle-step"><strong>3. 回収</strong><br>返却を記録（状態: 貸出中 → 保管中）</div>
  <div class="lifecycle-arrow">↓</div>
  <div class="lifecycle-step"><strong>4. 廃止（任意）</strong><br>紛失や破損時に状態を「廃止」に変更</div>
</div>`,
    "help.cautions_html": `<h4>⚠️ 運用上の注意事項</h4>
<ul>
  <li><strong>データ保存場所</strong><br>
    すべてのデータはブラウザーのIndexedDBに保存されます。<br>
    異なるブラウザーや端末では共有されません。</li>
  <li><strong>バックアップの重要性</strong><br>
    定期的に「エクスポート(JSON)」でデータをバックアップしてください。<br>
    ブラウザーのキャッシュクリアでデータが消失する可能性があります。</li>
  <li><strong>貸出中の鍵は削除不可</strong><br>
    貸出中の鍵を削除するには、先に回収登録を行ってください。</li>
  <li><strong>インポートは全置換</strong><br>
    JSONインポートは既存データを完全に置き換えます。<br>
    検証に通らないデータは1件も取り込まないので、途中で壊れることはありません。</li>
  <li><strong>監査ログの改ざん</strong><br>
    画面からは編集・削除できず、連鎖するハッシュで書き換えを検出できます。<br>
    ただしデータベースを直接操作すれば書き換えは可能です。<br>
    定期的にエクスポートして外部に保管してください。</li>
</ul>`,
    "help.qr_html": `<h4>🏷️ QRコードの活用</h4>
<ul>
  <li><strong>QRコード生成</strong><br>
    鍵の編集画面で「IDで生成」または「UUIDで生成」ボタンをクリック。<br>
    生成されたQRコードの下に、埋め込まれたURL情報が表示されます。</li>
  <li><strong>印刷と貼付</strong><br>
    「PNG保存」ボタンでQRコード画像を保存し、物理タグやラベルに印刷して鍵に貼付。</li>
  <li><strong>スマホでスキャン</strong><br>
    スキャンすると、その鍵の詳細画面（編集モーダル）が開きます。<br>
    例: <code>#id=KEY-001</code> または <code>#key=uuid</code><br>
    台帳データは端末ごとにブラウザー内へ保存されるため、<br>
    詳細が開くのは台帳を登録した端末・ブラウザーだけです。</li>
  <li><strong>2種類のQRコード</strong><br>
    「IDで生成」: タグ番号で検索（例: KEY-001）<br>
    「UUIDで生成」: 内部IDで検索（タグ番号変更にも対応）</li>
</ul>`,
    "help.audit_html": `<h4>📊 監査ログ</h4>
<ul>
  <li>すべての操作履歴が自動記録されます</li>
  <li>鍵の登録・編集・削除、貸出・回収、インポートなど</li>
  <li>1件ごとに連番とハッシュが付き、「整合性を検証」で改ざんを検出できます</li>
  <li>JSON Lines形式でダウンロード可能</li>
</ul>`,
    "help.tips_html": `<h4>💡 Tips</h4>
<ul>
  <li><strong>カテゴリーと種別</strong><br>
    物理鍵: マスターキー/純正キー/スペアキー<br>
    ICカード: 社員証/訪問者カード/業者カード/一時カード/その他<br>
    カードキー: 客室キー/入館証/駐車場カード/ロッカーキー/その他</li>
  <li><strong>相対時間表示</strong><br>
    返却期限を「3時間後」「2日前」など相対的に表示</li>
  <li><strong>テーマ切替</strong><br>
    ヘッダー右上のボタン（🌙/☀️）でダーク/ライトモードを変更可能</li>
  <li><strong>設定のカスタマイズ</strong><br>
    プロフィール名・多重貸出しきい値・有効期限の通知日数を変更可能</li>
  <li><strong>カテゴリーフィルター</strong><br>
    鍵一覧でカテゴリー別に絞り込み可能</li>
</ul>`
  },

  en: {
    "app.title": "Physical Key Ledger",
    "app.tagline": "A ledger that shows who holds which physical key, IC card or card key, and when it is due back",
    "app.noscript": "This tool reads and writes the ledger with JavaScript. Please enable JavaScript. "
      + "Data stays in your browser (IndexedDB) and is never sent anywhere.",
    "app.footer_html": '🔗 GitHub repository: <a href="https://github.com/ipusiron/physical-key-ledger"'
      + ' target="_blank" rel="noopener">ipusiron/physical-key-ledger</a>',

    "header.help": "Help",
    "header.theme": "Toggle theme",
    "header.theme_mobile": "Toggle theme",
    "header.export": "Export",
    "header.export_title": "Export the whole ledger as JSON",
    "header.import": "Import",
    "header.import_title": "Import JSON and replace the whole ledger",
    "header.audit": "Audit log",
    "header.settings": "Settings",
    "header.menu": "Menu",
    "header.lang": "日本語",
    "header.lang_aria": "Switch language",

    "dash.title": "Dashboard",
    "dash.total": "Keys",
    "dash.loaned": "On loan",
    "dash.overdue": "Overdue",
    "dash.expiring": "Cards expiring or expired",
    "dash.overdue_heading": "Overdue (past the due date, not returned)",
    "dash.notice_heading": "Other things to look at",
    "dash.none": "None",

    "keys.title": "Keys",
    "keys.search_placeholder": "Search (ID / name / location / borrower)",
    "keys.search_aria": "Search keys by ID, name, location or borrower",
    "keys.filter_category_all": "All categories",
    "keys.filter_category_aria": "Filter by category",
    "keys.filter_status_all": "All states",
    "keys.filter_status_aria": "Filter by state",
    "keys.new": "Add key",
    "keys.table_aria": "Key list",
    "keys.col_id": "ID",
    "keys.col_category": "Category",
    "keys.col_name": "Name",
    "keys.col_type": "Type",
    "keys.col_status": "State",
    "keys.col_location": "Location",
    "keys.col_borrower": "Borrower",
    "keys.col_due": "Due",
    "keys.col_actions": "Actions",
    "keys.empty": "No keys match",
    "keys.edit": "Edit",
    "keys.loan": "Lend",
    "keys.return": "Return",

    "cat.physical-key": "🔑 Physical key",
    "cat.ic-card": "💳 IC card",
    "cat.card-key": "🎫 Card key",
    "status.stored": "In storage",
    "status.loaned": "On loan",
    "status.retired": "Retired",
    "type.master": "Master key",
    "type.original": "Original key",
    "type.spare": "Spare key",
    "type.employee": "Employee badge",
    "type.visitor": "Visitor card",
    "type.contractor": "Contractor card",
    "type.temporary": "Temporary card",
    "type.room-key": "Room key",
    "type.access-card": "Access card",
    "type.parking-card": "Parking card",
    "type.locker-key": "Locker key",
    "type.other": "Other",

    "key.modal_title": "Add / edit key",
    "key.new_title": "Add a key",
    "key.edit_title": "Edit key",
    "key.id": "Tag ID (physical tag / card number)",
    "key.name": "Name",
    "key.name_placeholder": "Lab entrance",
    "key.category": "Category",
    "key.type": "Type",
    "key.status": "State",
    "key.location": "Location",
    "key.location_placeholder": "Cabinet, 2nd floor corridor",
    "key.card_number": "Card number (optional)",
    "key.access_level": "Access level (optional)",
    "key.valid_from": "Valid from",
    "key.valid_until": "Valid until",
    "key.datetime_placeholder": "Click to pick a date and time",
    "key.notes": "Notes",
    "key.notes_placeholder": "Not lent out at night",
    "key.qr_title": "QR code (for printing)",
    "key.qr_by_id": "By tag ID",
    "key.qr_by_uuid": "By UUID",
    "key.qr_download": "Save PNG",
    "key.delete": "Delete this key",
    "key.delete_confirm": "Delete this key. Are you sure? (A key on loan cannot be deleted.)",

    "loan.title": "Lend a key",
    "loan.key_id": "Key ID",
    "loan.borrower": "Borrower",
    "loan.borrower_placeholder": "emp-12345 or T.Yamada",
    "loan.due": "Due",
    "loan.due_hint": "You can pick the date and time from the calendar",
    "loan.notes": "Notes (lending)",
    "loan.notes_placeholder": "Daytime inspection",
    "loan.submit": "Lend",

    "return.title": "Return a key",
    "return.borrower": "Borrower (for reference)",
    "return.notes": "Notes (return)",
    "return.notes_placeholder": "No damage",
    "return.submit": "Return",

    "audit.title": "Audit log (newest first)",
    "audit.note": "Each entry is sealed together with the hash of the entry before it (SHA-256). "
      + "Rewriting, deleting, inserting or reordering entries is detected by \"Verify integrity\".",
    "audit.verify": "Verify integrity",
    "audit.download": "Download JSONL",
    "audit.empty": "(no entries)",

    "settings.title": "Settings",
    "settings.profile": "Profile name (actor in the log)",
    "settings.multi": "Multi-holding threshold (keys held at once)",
    "settings.expiring": "Warn this many days before a card expires",
    "settings.master": "Days before a master-key loan counts as long",

    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.close": "Close",
    "common.required_mark": "required",

    "err.uuid_invalid": "The internal id is not valid.",
    "err.id_required": "Enter a tag ID (up to 200 characters).",
    "err.name_required": "Enter a name (up to 200 characters).",
    "err.category_invalid": "The category is not valid.",
    "err.status_invalid": "The state is not valid.",
    "err.type_invalid": "The type is not valid.",
    "err.valid_range": "The start of the validity period is after its end.",
    "err.id_taken": "The tag ID \"{id}\" is already in use.",
    "err.uuid_duplicate": "The internal id is already in use.",
    "err.key_missing": "That key does not exist.",
    "err.already_loaned": "This key is already on loan.",
    "err.not_stored": "Only a key in storage can be lent out (a retired key cannot).",
    "err.borrower_required": "Enter a borrower (up to 200 characters).",
    "err.due_invalid": "The due date is not valid.",
    "err.no_active_loan": "No open loan was found for this key.",
    "err.delete_blocked": "This key is on loan and cannot be deleted. Record the return first.",
    "err.db_blocked": "Another tab has an older version of the database open. Close it and reload.",
    "err.import_header": "The file could not be read as a ledger, so nothing was changed.",
    "err.dataset_not_object": "This is not ledger data (an object with keys, loans and audit is required).",
    "err.dataset_not_array": "{name} is not an array.",
    "err.dataset_item_not_object": "{at} is not an object.",
    "err.dataset_field_invalid": "{at}.{field} is not valid.",
    "err.dataset_field_empty": "{at}.{field} is empty or too long.",
    "err.dataset_duplicate": "{at}.{field} appears more than once.",
    "err.dataset_id_duplicate": "{at}.id \"{id}\" appears more than once (tag IDs must be unique).",
    "err.dataset_key_missing": "{at}.keyUuid does not match any key.",

    "fmt.multi_label": "Multi-holding ({n}+ keys)",
    "fmt.multi_heading": "Multi-holding (one borrower with {n} or more keys)",
    "fmt.expiring_heading": "Card validity (within {n} days, or expired)",
    "fmt.expired_today": "expires today",
    "fmt.expired_days": "expired {n} days ago",
    "fmt.valid_today": "valid until today",
    "fmt.valid_days": "expires in {n} days",
    "fmt.in_minutes": "in {n} min",
    "fmt.ago_minutes": "{n} min ago",
    "fmt.in_hours": "in {n} h",
    "fmt.ago_hours": "{n} h ago",
    "fmt.in_days": "in {n} days",
    "fmt.in_days_one": "in {n} day",
    "fmt.ago_days": "{n} days ago",
    "fmt.ago_days_one": "{n} day ago",
    "fmt.overdue_item": "Overdue by {hours} h ({borrower} / {id})",
    "fmt.multi_item": "One borrower holds {count} keys ({borrower} / threshold {threshold})",
    "fmt.multi_spellings": " / also written as: {list}",
    "fmt.expiring_item": "{id} {name}: {phrase}",
    "fmt.expiring_held": " / on loan to {borrower}",
    "fmt.master_item": "Master key {id} \"{name}\" has been out for {days} days ({borrower})",
    "fmt.no_due_item": "Loan with no due date ({borrower} / {id})",
    "fmt.inconsistent_item": "{id}: {reason}",
    "fmt.qr_info": "📱 QR code contents: {url}",
    "fmt.key_label": "{id} ({short})",

    "notice.loaned-without-record": "marked as on loan, but there is no loan record",
    "notice.record-without-loaned": "there is a loan record, but the key is not marked as on loan",

    "chain.empty": "The audit log is empty.",
    "chain.all_unchained": "All {total} entries are outside the chain (recorded before this version).",
    "chain.all_unchained_one": "{total} entry is outside the chain (recorded before this version).",
    "chain.ok": "Checked {checked} entries{skipped}. No tampering was found.",
    "chain.ok_one": "Checked {checked} entry{skipped}. No tampering was found.",
    "chain.ng": "Checked {checked} entries{skipped}. Found a problem at {where}: {reason}",
    "chain.skipped": " ({n} older entries were skipped)",
    "chain.where": "seq {seq}",
    "chain.where_unknown": "an unknown position",
    "chain.more": "and {n} more",
    "chain.item": "{where}: {reason}",
    "chain.reason.hash-mismatch": "the contents were changed (the recomputed hash does not match)",
    "chain.reason.prev-mismatch": "the link to the previous entry is broken (deletion or insertion)",
    "chain.reason.missing-hash": "an entry without a hash appears in the middle of the chain",
    "chain.reason.seq-out-of-order": "the sequence numbers are out of order",
    "chain.reason.head-mismatch": "the newest entries were cut off (the recorded head does not match)",
    "chain.failed": "Verification could not be completed",

    "alert.import_confirm": "This replaces the whole ledger with the JSON file. Continue?",
    "alert.import_done": "Import finished ({keys} keys / {loans} loans / {audit} log entries)",
    "alert.import_failed": "Import failed",
    "alert.import_not_json": "The file could not be read as JSON. Please check it.",
    "alert.not_on_device_id": "Key ID \"{id}\" is not in this device's ledger.",
    "alert.not_on_device_uuid": "Key UUID \"{id}\" is not in this device's ledger.",
    "alert.not_on_device_hint": "The ledger is stored per device, so open it on the device and browser where the key was registered.",

    "help.title": "📖 Help - how to use Physical Key Ledger",
    "help.basic_html": `<h4>🔰 Getting started</h4>
<ol>
  <li><strong>Register a key</strong><br>
    Press "Add key", pick a category (physical key / IC card / card key) and fill in the details.<br>
    The tag ID is the number printed on the physical tag (for example KEY-001).<br>
    Fields marked <span class="required">*</span> are required.</li>
  <li><strong>IC cards and card keys</strong><br>
    Choosing one of those categories opens extra fields: card number, access level and validity dates (all optional).<br>
    The type list changes to match the category.</li>
  <li><strong>Lend a key</strong><br>
    Press "Lend" in the key list, then enter the borrower and the due date.<br>
    The due date is optional and can be picked from the calendar.</li>
  <li><strong>Take a key back</strong><br>
    Press "Return" on a key that is out and add a note if you want.<br>
    The state goes back to "In storage" by itself.</li>
  <li><strong>Search and filter</strong><br>
    The search box matches the ID, name, location and borrower.<br>
    The category filter selects physical keys, IC cards or card keys.<br>
    The state filter selects keys in storage, on loan or retired.</li>
</ol>`,
    "help.lifecycle_html": `<h4>🔄 The life of a key</h4>
<div class="lifecycle">
  <div class="lifecycle-step"><strong>1. Register</strong><br>Add the key to the ledger (it starts in storage)</div>
  <div class="lifecycle-arrow">↓</div>
  <div class="lifecycle-step"><strong>2. Lend</strong><br>Hand it to a borrower (in storage → on loan)</div>
  <div class="lifecycle-arrow">↓</div>
  <div class="lifecycle-step"><strong>3. Return</strong><br>Record the return (on loan → in storage)</div>
  <div class="lifecycle-arrow">↓</div>
  <div class="lifecycle-step"><strong>4. Retire (optional)</strong><br>Mark a lost or broken key as retired</div>
</div>`,
    "help.cautions_html": `<h4>⚠️ Things to keep in mind</h4>
<ul>
  <li><strong>Where the data lives</strong><br>
    Everything is stored in your browser's IndexedDB.<br>
    It is not shared with another browser or another device.</li>
  <li><strong>Back it up</strong><br>
    Export the ledger as JSON from time to time.<br>
    Clearing the browser's site data deletes it.</li>
  <li><strong>A key on loan cannot be deleted</strong><br>
    Record the return first, then delete the key.</li>
  <li><strong>Import replaces everything</strong><br>
    Importing JSON replaces the whole ledger.<br>
    Data that fails validation is not imported at all, so a bad file cannot leave the ledger half-written.</li>
  <li><strong>Tampering with the audit log</strong><br>
    The log cannot be edited or deleted from the screen, and the hash chain shows when an entry was changed.<br>
    Someone with access to the database can still rewrite it,<br>
    so export the log regularly and keep it elsewhere.</li>
</ul>`,
    "help.qr_html": `<h4>🏷️ Using QR codes</h4>
<ul>
  <li><strong>Generate</strong><br>
    In the key editor, press "By tag ID" or "By UUID".<br>
    The URL behind the code is shown under it.</li>
  <li><strong>Print and attach</strong><br>
    "Save PNG" saves the image so you can print it on a tag or label.</li>
  <li><strong>Scan with a phone</strong><br>
    Scanning opens that key's detail view.<br>
    For example <code>#id=KEY-001</code> or <code>#key=uuid</code><br>
    The ledger is stored per browser,<br>
    so the detail view only opens on the device where the key was registered.</li>
  <li><strong>Two kinds of code</strong><br>
    "By tag ID": looks the key up by its printed number (KEY-001)<br>
    "By UUID": looks it up by the internal id, which survives a change of tag</li>
</ul>`,
    "help.audit_html": `<h4>📊 Audit log</h4>
<ul>
  <li>Every operation is recorded automatically</li>
  <li>Registering, editing and deleting keys, lending, returning, importing</li>
  <li>Each entry carries a sequence number and a hash; "Verify integrity" reports any tampering</li>
  <li>The log can be downloaded as JSON Lines</li>
</ul>`,
    "help.tips_html": `<h4>💡 Tips</h4>
<ul>
  <li><strong>Categories and types</strong><br>
    Physical key: master / original / spare<br>
    IC card: employee badge / visitor / contractor / temporary / other<br>
    Card key: room key / access card / parking card / locker key / other</li>
  <li><strong>Relative times</strong><br>
    Due dates are shown as "in 3 hours" or "2 days ago"</li>
  <li><strong>Theme</strong><br>
    The button at the top right (🌙/☀️) switches between dark and light</li>
  <li><strong>Settings</strong><br>
    The profile name, the multi-holding threshold and the expiry warning can all be changed</li>
  <li><strong>Category filter</strong><br>
    The key list can be narrowed down to one category</li>
</ul>`
  }
};

export const LANGS = Object.keys(MESSAGES);
