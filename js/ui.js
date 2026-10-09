// ui.js - bindings and rendering
import {
  initLogic, refreshCache, state, upsertKey, deleteKey,
  createLoan, returnLoanByKeyUuid, detectOverdue, detectMultiHolding, kpi,
  exportJson, importJsonFile, getAuditLog, saveSettings, verifyAuditChain,
  genUuid, toggleTheme, applyTheme
} from "./logic.js";
import { dbApi } from "./db.js";
import {
  escapeHtml, translateCategory, translateStatus, translateType, typeOptionsFor,
  formatRelativeTime, toLocalDatetimeInput, fromLocalDatetime,
  multiHoldingLabel, multiHoldingHeading
} from "./display.js";
import { overdueHours } from "./anomaly.js";
import { describeResult, REASON_LABELS } from "./audit-chain.js";

// Elements
const els = {
  kpiTotal: document.getElementById("kpi-total"),
  kpiLoaned: document.getElementById("kpi-loaned"),
  kpiOverdue: document.getElementById("kpi-overdue"),
  kpiMulti: document.getElementById("kpi-multi"),
  listOverdue: document.getElementById("list-overdue"),
  listMulti: document.getElementById("list-multi"),
  kpiMultiLabel: document.getElementById("kpi-multi-label"),
  headingMulti: document.getElementById("heading-multi"),
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
  btnChainVerify: document.getElementById("btn-chain-verify"),
  chainResult: document.getElementById("chain-result"),
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

// Labels that depend on the configured threshold are built from the setting
// instead of being written into the HTML.
function renderThresholdLabels() {
  const n = state.settings.multiThreshold;
  els.kpiMultiLabel.textContent = multiHoldingLabel(n);
  els.headingMulti.textContent = multiHoldingHeading(n);
}

function emptyListItem(ul) {
  ul.replaceChildren();
  const li = document.createElement("li");
  li.textContent = "なし";
  ul.appendChild(li);
}

function renderAnomalies() {
  // overdue
  const now = Date.now();
  const overdue = detectOverdue(now);
  if (overdue.length === 0) {
    emptyListItem(els.listOverdue);
  } else {
    els.listOverdue.replaceChildren();
    for (const L of overdue) {
      const key = state.cache.keys.find(k => k.uuid === L.keyUuid);
      const li = document.createElement("li");
      li.textContent = `返却期限を ${overdueHours(L, now)} 時間超過（${L.borrower} / ${key?.id || L.keyUuid}）`;
      els.listOverdue.appendChild(li);
    }
  }
  // multi
  const multi = detectMultiHolding();
  if (multi.length === 0) {
    emptyListItem(els.listMulti);
  } else {
    els.listMulti.replaceChildren();
    for (const m of multi) {
      const li = document.createElement("li");
      const spellings = m.spellings.length > 1 ? `／表記ゆれ: ${m.spellings.join(", ")}` : "";
      li.textContent =
        `同一借主が ${m.count} 本の鍵を保持（${m.borrower} / しきい値 ${state.settings.multiThreshold}${spellings}）`;
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
    const dueAt = activeLoan?.dueAt ? formatRelativeTime(activeLoan.dueAt, Date.now()) : "";
    // Every interpolated value is escaped, including the uuid in the data
    // attribute: imported data must not be able to inject markup here.
    const uuid = escapeHtml(k.uuid);
    // Retired keys cannot be lent out, so no loan button is offered.
    const actionButton = k.status === "loaned"
      ? `<button class="btn btn-secondary btn-sm" data-act="return" data-uuid="${uuid}">回収</button>`
      : k.status === "stored"
        ? `<button class="btn primary btn-sm" data-act="loan" data-uuid="${uuid}">貸出</button>`
        : "";

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
        <button class="btn btn-tertiary btn-sm" data-act="edit" data-uuid="${uuid}">編集</button>
        ${actionButton}
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

// Rebuilds the type <select> for the chosen category. Options are created as
// elements (no innerHTML) so that labels cannot be read as markup.
function updateTypeOptions(category, selected) {
  const typeSelect = document.getElementById("key-type");
  const cardFields = document.getElementById("card-fields");
  typeSelect.replaceChildren();
  for (const opt of typeOptionsFor(category)) {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    typeSelect.appendChild(el);
  }
  if (selected) typeSelect.value = selected;

  // Card-only fields are toggled with a class so that no inline style
  // attribute is needed (Content-Security-Policy blocks those).
  const isCard = category === "ic-card" || category === "card-key";
  cardFields.classList.toggle("hidden", !isCard);
}

async function rerenderAll() {
  await refreshCache();
  renderThresholdLabels();
  renderKPIs();
  renderAnomalies();
  renderKeysTable();
}

// ============ Key modal ============
// Fields are reached through form.elements so that an <input name="id">
// cannot shadow a DOM property of the form itself.
function field(form, name) {
  return form.elements.namedItem(name);
}

function openKeyModal(newKey = true, keyObj = null) {
  isNewKey = newKey;
  els.dlgKeyTitle.textContent = newKey ? "鍵の新規登録" : "鍵の編集";
  const form = els.formKey;
  const set = (name, value) => { field(form, name).value = value; };
  const blanks = ["id", "name", "location", "notes", "cardNumber", "accessLevel", "validFrom", "validUntil"];
  if (newKey) {
    currentKeyUuid = genUuid();
    for (const name of blanks) set(name, "");
    set("category", "physical-key");
    set("status", "stored");
    updateTypeOptions("physical-key", "original");
  } else {
    currentKeyUuid = keyObj.uuid;
    set("id", keyObj.id);
    set("name", keyObj.name);
    const category = keyObj.category || "physical-key";
    set("category", category);
    updateTypeOptions(category, keyObj.type);
    set("status", keyObj.status);
    set("location", keyObj.location || "");
    set("notes", keyObj.notes || "");
    set("cardNumber", keyObj.cardNumber || "");
    set("accessLevel", keyObj.accessLevel || "");
    set("validFrom", keyObj.validFrom ? toLocalDatetimeInput(keyObj.validFrom) : "");
    set("validUntil", keyObj.validUntil ? toLocalDatetimeInput(keyObj.validUntil) : "");
  }
  clearQR();
  els.dlgKey.showModal();
}

function clearQR() {
  els.qrBox.replaceChildren();
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
// The key is put in the fragment (#), which browsers do not send to the
// server. With "?" the key ID would appear in the access log of whoever
// hosts the page.
function qrUrl(name, value) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = `${name}=${encodeURIComponent(value)}`;
  return url.toString();
}
function makeQrContentId() {
  return qrUrl("id", field(els.formKey, "id").value.trim());
}
function makeQrContentUuid() {
  return qrUrl("key", currentKeyUuid);
}

// Reads #id= / #key= first and still understands the older ?id= / ?key=
// links printed on existing labels.
function readDeepLink() {
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  return {
    id: hash.get("id") ?? url.searchParams.get("id"),
    key: hash.get("key") ?? url.searchParams.get("key"),
    hasQuery: url.search.length > 0 || url.hash.length > 0
  };
}

const NOT_ON_THIS_DEVICE =
  "台帳データは端末ごとに保存されるため、登録した端末・ブラウザーで開いてください。";

// Opens the key named by the current URL, then takes it out of the address bar.
async function handleDeepLink() {
  const link = readDeepLink();
  if (link.id != null) {
    const key = await dbApi.getKeyById(state.db, link.id);
    if (key) openKeyModal(false, key);
    else alert([`鍵ID「${link.id}」はこの端末の台帳にありません。`, NOT_ON_THIS_DEVICE].join("\n"));
  } else if (link.key != null) {
    const key = await dbApi.getKeyByUuid(state.db, link.key);
    if (key) openKeyModal(false, key);
    else alert([`鍵UUID「${link.key}」はこの端末の台帳にありません。`, NOT_ON_THIS_DEVICE].join("\n"));
  }
  if (link.hasQuery) clearDeepLink();
}

// Removes the key from the address bar and from the back/forward history.
// The browser history of the visit itself still holds the original URL.
function clearDeepLink() {
  try {
    history.replaceState(null, "", location.pathname);
  } catch {
    // Some sandboxes block replaceState; the page still works.
  }
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
  field(f, "keyId").value = `${k.id} (${k.uuid.slice(0, 8)})`;
  field(f, "borrower").value = "";
  field(f, "dueAt").value = "";
  field(f, "outNotes").value = "";
  els.dlgLoan.showModal();
  els.formLoan.dataset.uuid = k.uuid;
}

// ============ Return modal ============
function openReturnModal(k, activeLoan) {
  const f = els.formReturn;
  field(f, "keyId").value = `${k.id} (${k.uuid.slice(0, 8)})`;
  field(f, "borrower").value = activeLoan?.borrower || "";
  field(f, "inNotes").value = "";
  els.dlgReturn.showModal();
  els.formReturn.dataset.uuid = k.uuid;
}

// ============ Audit modal ============
async function openAuditModal() {
  const logs = await getAuditLog(1000);
  const lines = logs.map(l => JSON.stringify(l)).join("\n");
  els.auditBox.textContent = lines || "(ログなし)";
  // The result belongs to the moment it was produced, so it does not
  // survive reopening the dialog.
  clearChainResult();
  els.dlgAudit.showModal();
}

function clearChainResult() {
  els.chainResult.replaceChildren();
  els.chainResult.classList.remove("ok", "ng");
}

// Recomputes the hash chain and reports what it found.
async function runChainVerification() {
  const r = await verifyAuditChain();
  els.chainResult.replaceChildren();
  els.chainResult.classList.toggle("ok", r.ok);
  els.chainResult.classList.toggle("ng", !r.ok);

  const summary = document.createElement("p");
  summary.className = "chain-summary";
  summary.textContent = `${r.ok ? "✅" : "⚠"} ${describeResult(r)}`;
  els.chainResult.appendChild(summary);

  // With a single break the summary already names it, so a list would
  // only repeat the same line.
  if (r.breaks.length > 1) {
    const ul = document.createElement("ul");
    ul.className = "bullet-list";
    for (const b of r.breaks.slice(0, 10)) {
      const li = document.createElement("li");
      const where = b.seq == null ? "位置不明" : `seq ${b.seq}`;
      li.textContent = `${where}: ${REASON_LABELS[b.reason] || b.reason}`;
      ul.appendChild(li);
    }
    els.chainResult.appendChild(ul);
    if (r.breaks.length > 10) {
      const more = document.createElement("p");
      more.textContent = `ほか ${r.breaks.length - 10} 件`;
      els.chainResult.appendChild(more);
    }
  }
}

// ============ Settings modal ============
function openSettingsModal() {
  const f = els.formSettings;
  field(f, "profileName").value = state.settings.profileName || "local-admin";
  field(f, "multiThreshold").value = state.settings.multiThreshold || 4;
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

  // Auto-open the key detail from a scanned label (#id=KEY-001 or #key=uuid)
  await handleDeepLink();
  // A label scanned while the page is already open only changes the
  // fragment, which does not reload the document.
  window.addEventListener("hashchange", () => { handleDeepLink(); });

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
    const value = (name) => field(f, name).value;
    const category = value("category");
    const obj = {
      uuid: currentKeyUuid,
      id: value("id").trim(),
      name: value("name").trim(),
      category: category,
      type: value("type"),
      status: value("status"),
      location: value("location").trim(),
      notes: value("notes").trim(),
    };

    // Add card-specific fields if category is ic-card or card-key
    if (category === "ic-card" || category === "card-key") {
      obj.cardNumber = value("cardNumber").trim() || null;
      obj.accessLevel = value("accessLevel").trim() || null;
      obj.validFrom = fromLocalDatetime(value("validFrom")) || null;
      obj.validUntil = fromLocalDatetime(value("validUntil")) || null;
    }

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
    const borrower = field(f, "borrower").value.trim();
    if (!borrower) return alert("借主識別子を入力してください。");
    const dueAt = fromLocalDatetime(field(f, "dueAt").value);
    const uuid = els.formLoan.dataset.uuid;
    try {
      await createLoan({ keyUuid: uuid, borrower, dueAt, outNotes: field(f, "outNotes").value.trim() });
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
      await returnLoanByKeyUuid(uuid, field(els.formReturn, "inNotes").value.trim());
      els.dlgReturn.close();
      await rerenderAll();
    } catch (err) {
      alert(err.message || String(err));
    }
  });

  // Export / Import / Audit / Settings
  els.btnExport.addEventListener("click", exportJson);
  async function handleImportFile(e, closeMenu) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("JSONデータで全置換します。よろしいですか？")) {
      e.target.value = "";
      if (closeMenu) els.mobileMenu.classList.add("hidden");
      return;
    }
    try {
      const counts = await importJsonFile(file);
      await rerenderAll();
      alert(`インポート完了（鍵 ${counts.keys} 件 / 貸出 ${counts.loans} 件 / 監査ログ ${counts.audit} 件）`);
    } catch (err) {
      alert(["インポート失敗", err.message || String(err)].join("\n"));
    } finally {
      e.target.value = "";
      if (closeMenu) els.mobileMenu.classList.add("hidden");
    }
  }

  els.fileImport.addEventListener("change", (e) => handleImportFile(e, false));
  els.btnAudit.addEventListener("click", openAuditModal);
  els.btnAuditClose.addEventListener("click", () => els.dlgAudit.close());
  els.btnChainVerify.addEventListener("click", async () => {
    els.btnChainVerify.disabled = true;
    try {
      await runChainVerification();
    } catch (err) {
      alert(["整合性の検証に失敗しました", err.message || String(err)].join("\n"));
    } finally {
      els.btnChainVerify.disabled = false;
    }
  });
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
      profileName: field(f, "profileName").value.trim(),
      multiThreshold: Number(field(f, "multiThreshold").value) || 4,
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
    const open = els.mobileMenu.classList.toggle("hidden") === false;
    els.btnMenu.setAttribute("aria-expanded", String(open));
  });

  // Close mobile menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!els.btnMenu.contains(e.target) && !els.mobileMenu.contains(e.target)) {
      els.mobileMenu.classList.add("hidden");
      els.btnMenu.setAttribute("aria-expanded", "false");
    }
  });

  // Cancel / close buttons inside the dialogs. These used to be inline
  // onclick attributes, which a Content-Security-Policy blocks.
  for (const btn of document.querySelectorAll("[data-close-dialog]")) {
    btn.addEventListener("click", () => btn.closest("dialog")?.close());
  }

  // Mobile menu actions (mirror desktop)
  els.btnExportMobile.addEventListener("click", () => { exportJson(); els.mobileMenu.classList.add("hidden"); });
  els.fileImportMobile.addEventListener("change", (e) => handleImportFile(e, true));
  els.btnAuditMobile.addEventListener("click", () => { openAuditModal(); els.mobileMenu.classList.add("hidden"); });
  els.btnSettingsMobile.addEventListener("click", () => { openSettingsModal(); els.mobileMenu.classList.add("hidden"); });
});
