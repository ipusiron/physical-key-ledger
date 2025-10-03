// ui.js - bindings and rendering
import {
  initLogic, refreshCache, state, upsertKey, deleteKey,
  createLoan, returnLoanByKeyUuid, detectOverdue, detectMultiHolding, kpi,
  exportJson, importJsonFile, getAuditLog, saveSettings,
  genUuid, toLocalDatetimeInput, fromLocalDatetime,
  toggleTheme, applyTheme
} from "./logic.js";
import { dbApi } from "./db.js";

// Elements
const els = {
  kpiTotal: document.getElementById("kpi-total"),
  kpiLoaned: document.getElementById("kpi-loaned"),
  kpiOverdue: document.getElementById("kpi-overdue"),
  kpiMulti: document.getElementById("kpi-multi"),
  listOverdue: document.getElementById("list-overdue"),
  listMulti: document.getElementById("list-multi"),
  search: document.getElementById("search"),
  filterCategory: document.getElementById("filter-category"),
  filterStatus: document.getElementById("filter-status"),
  tbodyKeys: document.getElementById("tbody-keys"),
  btnNewKey: document.getElementById("btn-new-key"),
  btnHelp: document.getElementById("btn-help"),
  btnTheme: document.getElementById("btn-theme"),
  btnExport: document.getElementById("btn-export"),
  fileImport: document.getElementById("file-import"),
  btnAudit: document.getElementById("btn-audit"),
  btnSettings: document.getElementById("btn-settings"),
  btnMenu: document.getElementById("btn-menu"),
  mobileMenu: document.getElementById("mobile-menu"),
  btnHelpMobile: document.getElementById("btn-help-mobile"),
  btnThemeMobile: document.getElementById("btn-theme-mobile"),
  btnExportMobile: document.getElementById("btn-export-mobile"),
  fileImportMobile: document.getElementById("file-import-mobile"),
  btnAuditMobile: document.getElementById("btn-audit-mobile"),
  btnSettingsMobile: document.getElementById("btn-settings-mobile"),

  dlgKey: document.getElementById("dlg-key"),
  formKey: document.getElementById("form-key"),
  dlgKeyTitle: document.getElementById("dlg-key-title"),
  btnKeyDelete: document.getElementById("btn-key-delete"),
  btnKeySave: document.getElementById("btn-key-save"),
  qrBox: document.getElementById("qr"),
  btnQrId: document.getElementById("btn-qrid"),
  btnQrUuid: document.getElementById("btn-qruuid"),
  btnQrDownload: document.getElementById("btn-qr-download"),
  qrInfo: document.getElementById("qr-info"),

  dlgLoan: document.getElementById("dlg-loan"),
  formLoan: document.getElementById("form-loan"),
  dlgReturn: document.getElementById("dlg-return"),
  formReturn: document.getElementById("form-return"),

  dlgAudit: document.getElementById("dlg-audit"),
  auditBox: document.getElementById("audit-box"),
  btnAuditDownload: document.getElementById("btn-audit-download"),
  btnAuditClose: document.getElementById("btn-audit-close"),

  dlgSettings: document.getElementById("dlg-settings"),
  formSettings: document.getElementById("form-settings"),

  dlgHelp: document.getElementById("dlg-help"),
  btnHelpClose: document.getElementById("btn-help-close"),
};

let currentKeyUuid = null;
let isNewKey = true;
let qrInstance = null;

function renderKPIs() {
  const v = kpi();
  els.kpiTotal.textContent = v.total;
  els.kpiLoaned.textContent = v.loaned;
  els.kpiOverdue.textContent = v.overdue;
  els.kpiMulti.textContent = v.multi;
}
function renderAnomalies() {
  // overdue
  const overdue = detectOverdue();
  els.listOverdue.innerHTML = "";
  if (overdue.length === 0) {
    els.listOverdue.innerHTML = `<li>なし</li>`;
  } else {
    for (const L of overdue) {
      const key = state.cache.keys.find(k => k.uuid === L.keyUuid);
      const li = document.createElement("li");
      const hours = Math.floor((Date.now() - L.dueAt) / 36e5);
      li.textContent = `返却期限を ${hours} 時間超過（${L.borrower} / ${key?.id || L.keyUuid}）`;
      els.listOverdue.appendChild(li);
    }
  }
  // multi
  const multi = detectMultiHolding();
  els.listMulti.innerHTML = "";
  if (multi.length === 0) {
    els.listMulti.innerHTML = `<li>なし</li>`;
  } else {
    for (const m of multi) {
      const li = document.createElement("li");
      li.textContent = `同一借主が ${m.count} 本の鍵を保持（${m.borrower} / しきい値 ${state.settings.multiThreshold}）`;
      els.listMulti.appendChild(li);
    }
  }
}

function keyMatchesFilter(k, txt, category, status) {
  const activeLoan = state.cache.loans.find(L => L.keyUuid === k.uuid && L.returnedAt == null);
  const borrower = activeLoan?.borrower || "";
  if (category && (k.category || "physical-key") !== category) return false;
  if (status && k.status !== status) return false;
  if (!txt) return true;
  const hay = (k.id + " " + k.name + " " + (k.location||"") + " " + borrower).toLowerCase();
  return hay.includes(txt.toLowerCase());
}

function renderKeysTable() {
  const txt = els.search.value.trim();
  const category = els.filterCategory.value || "";
  const status = els.filterStatus.value || "";
  els.tbodyKeys.innerHTML = "";
  const keys = [...state.cache.keys].sort((a,b) => a.id.localeCompare(b.id));

  let matchCount = 0;
  for (const k of keys) {
    if (!keyMatchesFilter(k, txt, category, status)) continue;
    matchCount++;

    const tr = document.createElement("tr");
    const activeLoan = state.cache.loans.find(L => L.keyUuid === k.uuid && L.returnedAt == null);
    const borrower = activeLoan?.borrower || "";
    const dueAt = activeLoan?.dueAt ? formatRelativeTime(activeLoan.dueAt) : "";

    tr.innerHTML = `
      <td>${escapeHtml(k.id)}</td>
      <td>${escapeHtml(translateCategory(k.category || "physical-key"))}</td>
      <td>${escapeHtml(k.name)}</td>
      <td>${escapeHtml(translateType(k.type))}</td>
      <td>${escapeHtml(translateStatus(k.status))}</td>
      <td>${escapeHtml(k.location || "")}</td>
      <td>${escapeHtml(borrower)}</td>
      <td>${escapeHtml(dueAt)}</td>
      <td class="row">
        <button class="btn btn-tertiary btn-sm" data-act="edit" data-uuid="${k.uuid}">編集</button>
        ${
          k.status === "loaned"
          ? `<button class="btn btn-secondary btn-sm" data-act="return" data-uuid="${k.uuid}">回収</button>`
          : `<button class="btn primary btn-sm" data-act="loan" data-uuid="${k.uuid}">貸出</button>`
        }
      </td>
    `;
    els.tbodyKeys.appendChild(tr);
  }

  // Show empty state if no matches
  if (matchCount === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" class="empty-state">該当する鍵がありません</td>`;
    els.tbodyKeys.appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

function translateStatus(status) {
  const map = { stored: "保管中", loaned: "貸出中", retired: "廃止" };
  return map[status] || status;
}

function translateCategory(category) {
  const map = {
    "physical-key": "🔑 物理鍵",
    "ic-card": "💳 ICカード",
    "card-key": "🎫 カードキー"
  };
  return map[category] || category;
}

function translateType(type) {
  const map = {
    // Physical keys
    master: "マスターキー",
    original: "純正キー",
    spare: "スペアキー",
    // IC cards
    employee: "社員証",
    visitor: "訪問者カード",
    contractor: "業者カード",
    temporary: "一時カード",
    // Card keys
    "room-key": "客室キー",
    "access-card": "入館証",
    "parking-card": "駐車場カード",
    "locker-key": "ロッカーキー",
    // Other
    other: "その他"
  };
  return map[type] || type;
}

// Category-specific type options
const TYPE_OPTIONS = {
  "physical-key": [
    { value: "master", label: "マスターキー" },
    { value: "original", label: "純正キー" },
    { value: "spare", label: "スペアキー" }
  ],
  "ic-card": [
    { value: "employee", label: "社員証" },
    { value: "visitor", label: "訪問者カード" },
    { value: "contractor", label: "業者カード" },
    { value: "temporary", label: "一時カード" },
    { value: "other", label: "その他" }
  ],
  "card-key": [
    { value: "room-key", label: "客室キー" },
    { value: "access-card", label: "入館証" },
    { value: "parking-card", label: "駐車場カード" },
    { value: "locker-key", label: "ロッカーキー" },
    { value: "other", label: "その他" }
  ]
};

function updateTypeOptions(category) {
  const typeSelect = document.getElementById("key-type");
  const cardFields = document.getElementById("card-fields");
  const options = TYPE_OPTIONS[category] || TYPE_OPTIONS["physical-key"];

  typeSelect.innerHTML = options.map(opt =>
    `<option value="${opt.value}">${opt.label}</option>`
  ).join("");

  // Show/hide card-specific fields
  if (category === "ic-card" || category === "card-key") {
    cardFields.style.display = "grid";
  } else {
    cardFields.style.display = "none";
  }
}

function formatRelativeTime(ms) {
  if (!ms) return "";
  const now = Date.now();
  const diff = ms - now;
  const absDiff = Math.abs(diff);

  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  if (absDiff < 3600000) { // < 1 hour
    return diff > 0 ? `${minutes}分後` : `${minutes}分前`;
  } else if (absDiff < 86400000) { // < 1 day
    return diff > 0 ? `${hours}時間後` : `${hours}時間前`;
  } else if (absDiff < 604800000) { // < 1 week
    return diff > 0 ? `${days}日後` : `${days}日前`;
  } else {
    // Fallback to formatted date
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

async function rerenderAll() {
  await refreshCache();
  renderKPIs();
  renderAnomalies();
  renderKeysTable();
}

// ============ Key modal ============
function openKeyModal(newKey=true, keyObj=null) {
  isNewKey = newKey;
  els.dlgKeyTitle.textContent = newKey ? "鍵の新規登録" : "鍵の編集";
  const form = els.formKey;
  if (newKey) {
    currentKeyUuid = genUuid();
    form.id.value = "";
    form.name.value = "";
    form.category.value = "physical-key";
    form.type.value = "original";
    form.status.value = "stored";
    form.location.value = "";
    form.notes.value = "";
    form.cardNumber.value = "";
    form.accessLevel.value = "";
    form.validFrom.value = "";
    form.validUntil.value = "";
    updateTypeOptions("physical-key");
  } else {
    currentKeyUuid = keyObj.uuid;
    form.id.value = keyObj.id;
    form.name.value = keyObj.name;
    const category = keyObj.category || "physical-key";
    form.category.value = category;
    updateTypeOptions(category);
    form.type.value = keyObj.type;
    form.status.value = keyObj.status;
    form.location.value = keyObj.location || "";
    form.notes.value = keyObj.notes || "";
    form.cardNumber.value = keyObj.cardNumber || "";
    form.accessLevel.value = keyObj.accessLevel || "";
    form.validFrom.value = keyObj.validFrom ? toLocalDatetimeInput(keyObj.validFrom) : "";
    form.validUntil.value = keyObj.validUntil ? toLocalDatetimeInput(keyObj.validUntil) : "";
  }
  clearQR();
  els.dlgKey.showModal();
}

function clearQR() {
  els.qrBox.innerHTML = "";
  els.qrInfo.textContent = "";
  els.qrInfo.classList.remove("show");
  qrInstance = null;
}
function showQRInfo(url) {
  els.qrInfo.textContent = `📱 QRコード内容: ${url}`;
  els.qrInfo.classList.add("show");
}
function ensureQR() {
  if (!qrInstance) {
    qrInstance = new QRCode(els.qrBox, { text: "", width: 170, height: 170 });
  }
}
function makeQrContentId() {
  const id = els.formKey.id.value.trim();
  const url = new URL(location.href);
  url.searchParams.set("id", id);
  return url.toString();
}
function makeQrContentUuid() {
  const url = new URL(location.href);
  url.searchParams.set("key", currentKeyUuid);
  return url.toString();
}
function downloadQrPng() {
  const img = els.qrBox.querySelector("img") || els.qrBox.querySelector("canvas");
  if (!img) return;
  const link = document.createElement("a");
  link.download = "key-qr.png";
  link.href = img.toDataURL ? img.toDataURL("image/png") : img.src;
  link.click();
}

// ============ Loan modal ============
function openLoanModal(k) {
  const f = els.formLoan;
  f.keyId.value = `${k.id} (${k.uuid.slice(0,8)})`;
  f.borrower.value = "";
  f.dueAt.value = "";
  f.outNotes.value = "";
  els.dlgLoan.showModal();
  els.formLoan.dataset.uuid = k.uuid;
}

// ============ Return modal ============
function openReturnModal(k, activeLoan) {
  const f = els.formReturn;
  f.keyId.value = `${k.id} (${k.uuid.slice(0,8)})`;
  f.borrower.value = activeLoan?.borrower || "";
  f.inNotes.value = "";
  els.dlgReturn.showModal();
  els.formReturn.dataset.uuid = k.uuid;
}

// ============ Audit modal ============
async function openAuditModal() {
  const logs = await getAuditLog(1000);
  const lines = logs.map(l => JSON.stringify(l)).join("\n");
  els.auditBox.textContent = lines || "(ログなし)";
  els.dlgAudit.showModal();
}

// ============ Settings modal ============
function openSettingsModal() {
  const f = els.formSettings;
  f.profileName.value = state.settings.profileName || "local-admin";
  f.multiThreshold.value = state.settings.multiThreshold || 4;
  els.dlgSettings.showModal();
}

function updateThemeIcon() {
  const icon = state.theme === "dark" ? "☀️" : "🌙";
  const icons = document.querySelectorAll(".theme-icon");
  icons.forEach(el => el.textContent = icon);
}

// ============ Events ============
window.addEventListener("DOMContentLoaded", async () => {
  await initLogic();

  // Apply theme immediately
  applyTheme();
  updateThemeIcon();

  // Auto-open key detail from URL params (?id=KEY-001 or ?key=uuid)
  const url = new URL(location.href);
  if (url.searchParams.has("id")) {
    const keyId = url.searchParams.get("id");
    const key = await dbApi.getKeyById(state.db, keyId);
    if (key) {
      openKeyModal(false, key);
    } else {
      alert(`鍵ID「${keyId}」が見つかりませんでした。`);
    }
  } else if (url.searchParams.has("key")) {
    const keyUuid = url.searchParams.get("key");
    const key = await dbApi.getKeyByUuid(state.db, keyUuid);
    if (key) {
      openKeyModal(false, key);
    } else {
      alert(`鍵UUID「${keyUuid}」が見つかりませんでした。`);
    }
  }

  // Render
  await rerenderAll();

  // Search/filter
  els.search.addEventListener("input", renderKeysTable);
  els.filterCategory.addEventListener("change", renderKeysTable);
  els.filterStatus.addEventListener("change", renderKeysTable);

  // New key
  els.btnNewKey.addEventListener("click", () => openKeyModal(true));

  // Category selector change event
  document.getElementById("key-category").addEventListener("change", (e) => {
    updateTypeOptions(e.target.value);
  });

  // Row actions
  els.tbodyKeys.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const uuid = btn.dataset.uuid;
    const k = state.cache.keys.find(x => x.uuid === uuid);
    if (!k) return;

    if (btn.dataset.act === "edit") {
      openKeyModal(false, k);
    } else if (btn.dataset.act === "loan") {
      openLoanModal(k);
    } else if (btn.dataset.act === "return") {
      const activeLoan = state.cache.loans.find(L => L.keyUuid === k.uuid && L.returnedAt == null);
      openReturnModal(k, activeLoan);
    }
  });

  // Key modal: save/delete
  els.formKey.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = els.formKey;
    const category = f.category.value;
    const obj = {
      uuid: currentKeyUuid,
      id: f.id.value.trim(),
      name: f.name.value.trim(),
      category: category,
      type: f.type.value,
      status: f.status.value,
      location: f.location.value.trim(),
      notes: f.notes.value.trim(),
    };

    // Add card-specific fields if category is ic-card or card-key
    if (category === "ic-card" || category === "card-key") {
      obj.cardNumber = f.cardNumber.value.trim() || null;
      obj.accessLevel = f.accessLevel.value.trim() || null;
      obj.validFrom = fromLocalDatetime(f.validFrom.value) || null;
      obj.validUntil = fromLocalDatetime(f.validUntil.value) || null;
    }

    if (!obj.id || !obj.name) return alert("IDと名称は必須です。");
    try {
      await upsertKey(obj, isNewKey);
      els.dlgKey.close();
      await rerenderAll();
    } catch (err) {
      alert(err.message || String(err));
    }
  });

  els.btnKeyDelete.addEventListener("click", async () => {
    if (!currentKeyUuid) return;
    if (!confirm("この鍵を削除します。よろしいですか？（貸出中は削除不可）")) return;
    try {
      await deleteKey(currentKeyUuid);
      els.dlgKey.close();
      await rerenderAll();
    } catch (err) {
      alert(err.message || String(err));
    }
  });

  // QR buttons
  els.btnQrId.addEventListener("click", () => {
    const url = makeQrContentId();
    ensureQR();
    qrInstance.clear();
    qrInstance.makeCode(url);
    showQRInfo(url);
  });
  els.btnQrUuid.addEventListener("click", () => {
    const url = makeQrContentUuid();
    ensureQR();
    qrInstance.clear();
    qrInstance.makeCode(url);
    showQRInfo(url);
  });
  els.btnQrDownload.addEventListener("click", downloadQrPng);

  // Loan modal submit
  els.formLoan.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = els.formLoan;
    const borrower = f.borrower.value.trim();
    if (!borrower) return alert("借主識別子を入力してください。");
    const dueAt = fromLocalDatetime(f.dueAt.value);
    const uuid = els.formLoan.dataset.uuid;
    try {
      await createLoan({ keyUuid: uuid, borrower, dueAt, outNotes: f.outNotes.value.trim() });
      els.dlgLoan.close();
      await rerenderAll();
    } catch (err) {
      alert(err.message || String(err));
    }
  });

  // Return modal submit
  els.formReturn.addEventListener("submit", async (e) => {
    e.preventDefault();
    const uuid = els.formReturn.dataset.uuid;
    try {
      await returnLoanByKeyUuid(uuid, els.formReturn.inNotes.value.trim());
      els.dlgReturn.close();
      await rerenderAll();
    } catch (err) {
      alert(err.message || String(err));
    }
  });

  // Export / Import / Audit / Settings
  els.btnExport.addEventListener("click", exportJson);
  els.fileImport.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("JSONデータで全置換します。よろしいですか？")) return;
    try {
      await importJsonFile(file);
      await rerenderAll();
      alert("インポート完了");
    } catch (err) {
      alert("インポート失敗: " + (err.message || String(err)));
    } finally {
      e.target.value = "";
    }
  });
  els.btnAudit.addEventListener("click", openAuditModal);
  els.btnAuditClose.addEventListener("click", () => els.dlgAudit.close());
  els.btnAuditDownload.addEventListener("click", async () => {
    const logs = await getAuditLog(100000);
    const blob = new Blob(
      [logs.map(l => JSON.stringify(l)).join("\n")],
      { type: "application/x-ndjson" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pkledger-audit.jsonl";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  els.btnSettings.addEventListener("click", openSettingsModal);
  els.formSettings.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = els.formSettings;
    await saveSettings({
      profileName: f.profileName.value.trim(),
      multiThreshold: Number(f.multiThreshold.value) || 4,
    });
    els.dlgSettings.close();
    await rerenderAll();
  });

  // Help modal
  els.btnHelp.addEventListener("click", () => els.dlgHelp.showModal());
  els.btnHelpMobile.addEventListener("click", () => {
    els.dlgHelp.showModal();
    els.mobileMenu.classList.add("hidden");
  });
  els.btnHelpClose.addEventListener("click", () => els.dlgHelp.close());

  // Theme toggle
  els.btnTheme.addEventListener("click", () => {
    toggleTheme();
    updateThemeIcon();
  });
  els.btnThemeMobile.addEventListener("click", () => {
    toggleTheme();
    updateThemeIcon();
    els.mobileMenu.classList.add("hidden");
  });

  // Mobile menu toggle
  els.btnMenu.addEventListener("click", () => {
    els.mobileMenu.classList.toggle("hidden");
  });

  // Close mobile menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!els.btnMenu.contains(e.target) && !els.mobileMenu.contains(e.target)) {
      els.mobileMenu.classList.add("hidden");
    }
  });

  // Mobile menu actions (mirror desktop)
  els.btnExportMobile.addEventListener("click", () => { exportJson(); els.mobileMenu.classList.add("hidden"); });
  els.fileImportMobile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("JSONデータで全置換します。よろしいですか？")) return;
    try {
      await importJsonFile(file);
      await rerenderAll();
      alert("インポート完了");
    } catch (err) {
      alert("インポート失敗: " + (err.message || String(err)));
    } finally {
      e.target.value = "";
      els.mobileMenu.classList.add("hidden");
    }
  });
  els.btnAuditMobile.addEventListener("click", () => { openAuditModal(); els.mobileMenu.classList.add("hidden"); });
  els.btnSettingsMobile.addEventListener("click", () => { openSettingsModal(); els.mobileMenu.classList.add("hidden"); });
});
