// ui.js - bindings and rendering
import {
  initLogic, refreshCache, state, upsertKey, deleteKey,
  createLoan, returnLoanByKeyUuid, detectOverdue, detectMultiHolding, kpi,
  exportJson, importJsonFile, getAuditLog, saveSettings, verifyAuditChain,
  detectExpiredCards, detectLongMasterLoan, detectNoDueDate, detectInconsistent,
  genUuid, toggleTheme, applyTheme
} from "./logic.js";
import { dbApi } from "./db.js";
import {
  escapeHtml, translateCategory, translateStatus, translateType, typeOptionsFor,
  formatRelativeTime, toLocalDatetimeInput, fromLocalDatetime,
  multiHoldingLabel, multiHoldingHeading, expiringHeading, expiryPhrase,
  inconsistencyLabel
} from "./display.js";
import { overdueHours } from "./anomaly.js";
import { applyI18n, pickLang, otherLang, t, fmt, LANG_STORAGE_KEY } from "./i18n.js";

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
  kpiExpiring: document.getElementById("kpi-expiring"),
  headingExpiring: document.getElementById("heading-expiring"),
  listExpiring: document.getElementById("list-expiring"),
  listNotice: document.getElementById("list-notice"),
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
  btnLang: document.getElementById("btn-lang"),
  btnLangMobile: document.getElementById("btn-lang-mobile"),
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
// Display language. Everything on screen is drawn from the dictionary,
// so switching only redraws; nothing is recalculated.
let lang = "ja";

function renderKPIs() {
  const v = kpi();
  els.kpiTotal.textContent = v.total;
  els.kpiLoaned.textContent = v.loaned;
  els.kpiOverdue.textContent = v.overdue;
  els.kpiMulti.textContent = v.multi;
  els.kpiExpiring.textContent = v.expiring;
}

// Labels that depend on the configured threshold are built from the setting
// instead of being written into the HTML.
function renderThresholdLabels() {
  const n = state.settings.multiThreshold;
  els.kpiMultiLabel.textContent = multiHoldingLabel(lang, n);
  els.headingMulti.textContent = multiHoldingHeading(lang, n);
  els.headingExpiring.textContent = expiringHeading(lang, state.settings.expiringSoonDays);
}

function emptyListItem(ul) {
  ul.replaceChildren();
  const li = document.createElement("li");
  li.textContent = t(lang, "dash.none");
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
      li.textContent = fmt(lang, "fmt.overdue_item",
        { hours: overdueHours(L, now), borrower: L.borrower, id: key?.id || L.keyUuid });
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
      const spellings = m.spellings.length > 1
        ? fmt(lang, "fmt.multi_spellings", { list: m.spellings.join(", ") })
        : "";
      li.textContent = fmt(lang, "fmt.multi_item",
        { count: m.count, borrower: m.borrower, threshold: state.settings.multiThreshold }) + spellings;
      els.listMulti.appendChild(li);
    }
  }

  // Cards whose validity is about to run out, or already has. These dates
  // were being stored and never used.
  const expiring = detectExpiredCards(now);
  if (expiring.length === 0) {
    emptyListItem(els.listExpiring);
  } else {
    els.listExpiring.replaceChildren();
    for (const c of expiring) {
      const li = document.createElement("li");
      const held = c.loaned ? fmt(lang, "fmt.expiring_held", { borrower: c.borrower }) : "";
      li.textContent = fmt(lang, "fmt.expiring_item",
        { id: c.id, name: c.name, phrase: expiryPhrase(lang, c) }) + held;
      if (c.expired) li.classList.add("warn-text");
      els.listExpiring.appendChild(li);
    }
  }

  // Everything else worth a look: master keys out for a long time, loans
  // with no due date, and keys whose status does not match the records.
  const notices = [];
  for (const m of detectLongMasterLoan(now)) {
    notices.push(fmt(lang, "fmt.master_item",
      { id: m.id, name: m.name, days: m.days, borrower: m.borrower }));
  }
  for (const L of detectNoDueDate()) {
    const key = state.cache.keys.find(k => k.uuid === L.keyUuid);
    notices.push(fmt(lang, "fmt.no_due_item",
      { borrower: L.borrower, id: key?.id || L.keyUuid }));
  }
  for (const x of detectInconsistent()) {
    notices.push(fmt(lang, "fmt.inconsistent_item",
      { id: x.id, reason: inconsistencyLabel(lang, x.kind) }));
  }
  if (notices.length === 0) {
    emptyListItem(els.listNotice);
  } else {
    els.listNotice.replaceChildren();
    for (const text of notices) {
      const li = document.createElement("li");
      li.textContent = text;
      els.listNotice.appendChild(li);
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
    const dueAt = activeLoan?.dueAt ? formatRelativeTime(activeLoan.dueAt, Date.now(), lang) : "";
    // Every interpolated value is escaped, including the uuid in the data
    // attribute: imported data must not be able to inject markup here.
    const uuid = escapeHtml(k.uuid);
    // Retired keys cannot be lent out, so no loan button is offered.
    const actionButton = k.status === "loaned"
      ? `<button class="btn btn-secondary btn-sm" data-act="return" data-uuid="${uuid}">${escapeHtml(t(lang, "keys.return"))}</button>`
      : k.status === "stored"
        ? `<button class="btn primary btn-sm" data-act="loan" data-uuid="${uuid}">${escapeHtml(t(lang, "keys.loan"))}</button>`
        : "";

    tr.innerHTML = `
      <td>${escapeHtml(k.id)}</td>
      <td>${escapeHtml(translateCategory(lang, k.category || "physical-key"))}</td>
      <td>${escapeHtml(k.name)}</td>
      <td>${escapeHtml(translateType(lang, k.type))}</td>
      <td>${escapeHtml(translateStatus(lang, k.status))}</td>
      <td>${escapeHtml(k.location || "")}</td>
      <td>${escapeHtml(borrower)}</td>
      <td>${escapeHtml(dueAt)}</td>
      <td class="row">
        <button class="btn btn-tertiary btn-sm" data-act="edit" data-uuid="${uuid}">${escapeHtml(t(lang, "keys.edit"))}</button>
        ${actionButton}
      </td>
    `;
    els.tbodyKeys.appendChild(tr);
  }

  // Show empty state if no matches
  if (matchCount === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" class="empty-state">${escapeHtml(t(lang, "keys.empty"))}</td>`;
    els.tbodyKeys.appendChild(tr);
  }
}

// Rebuilds the type <select> for the chosen category. Options are created as
// elements (no innerHTML) so that labels cannot be read as markup.
function updateTypeOptions(category, selected) {
  const typeSelect = document.getElementById("key-type");
  const cardFields = document.getElementById("card-fields");
  typeSelect.replaceChildren();
  for (const value of typeOptionsFor(category)) {
    const el = document.createElement("option");
    el.value = value;
    el.textContent = translateType(lang, value);
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
  els.dlgKeyTitle.textContent = t(lang, newKey ? "key.new_title" : "key.edit_title");
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
  lastQrUrl = "";
  els.qrBox.replaceChildren();
  els.qrInfo.textContent = "";
  els.qrInfo.classList.remove("show");
  qrInstance = null;
}
let lastQrUrl = "";
function showQRInfo(url) {
  lastQrUrl = url;
  els.qrInfo.textContent = fmt(lang, "fmt.qr_info", { url });
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

// Turns an error from the domain layer into text in the current language.
function errorText(err) {
  if (err && Array.isArray(err.errors)) {
    return err.errors.map((e) => fmt(lang, e.key, e.vars || {})).join("\n");
  }
  if (err && err.i18nKey) return t(lang, err.i18nKey);
  return (err && err.message) || String(err);
}

// Opens the key named by the current URL, then takes it out of the address bar.
async function handleDeepLink() {
  const link = readDeepLink();
  if (link.id != null) {
    const key = await dbApi.getKeyById(state.db, link.id);
    if (key) openKeyModal(false, key);
    else alert([fmt(lang, "alert.not_on_device_id", { id: link.id }),
      t(lang, "alert.not_on_device_hint")].join("\n"));
  } else if (link.key != null) {
    const key = await dbApi.getKeyByUuid(state.db, link.key);
    if (key) openKeyModal(false, key);
    else alert([fmt(lang, "alert.not_on_device_uuid", { id: link.key }),
      t(lang, "alert.not_on_device_hint")].join("\n"));
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
  field(f, "keyId").value = fmt(lang, "fmt.key_label", { id: k.id, short: k.uuid.slice(0, 8) });
  field(f, "borrower").value = "";
  field(f, "dueAt").value = "";
  field(f, "outNotes").value = "";
  els.dlgLoan.showModal();
  els.formLoan.dataset.uuid = k.uuid;
}

// ============ Return modal ============
function openReturnModal(k, activeLoan) {
  const f = els.formReturn;
  field(f, "keyId").value = fmt(lang, "fmt.key_label", { id: k.id, short: k.uuid.slice(0, 8) });
  field(f, "borrower").value = activeLoan?.borrower || "";
  field(f, "inNotes").value = "";
  els.dlgReturn.showModal();
  els.formReturn.dataset.uuid = k.uuid;
}

// ============ Audit modal ============
async function openAuditModal() {
  const logs = await getAuditLog(1000);
  const lines = logs.map(l => JSON.stringify(l)).join("\n");
  els.auditBox.textContent = lines || t(lang, "audit.empty");
  // The result belongs to the moment it was produced, so it does not
  // survive reopening the dialog.
  clearChainResult();
  els.dlgAudit.showModal();
}

function clearChainResult() {
  els.chainResult.replaceChildren();
  els.chainResult.classList.remove("ok", "ng");
}

function breakWhere(b) {
  return b.seq == null ? t(lang, "chain.where_unknown") : fmt(lang, "chain.where", { seq: b.seq });
}

function breakReason(b) {
  return t(lang, `chain.reason.${b.reason}`, b.reason);
}

// One line describing the verification result.
function chainSummary(r) {
  if (r.total === 0) return t(lang, "chain.empty");
  if (r.checked === 0) return fmt(lang, "chain.all_unchained", { total: r.total });
  const skipped = r.unchained > 0 ? fmt(lang, "chain.skipped", { n: r.unchained }) : "";
  if (r.ok) return fmt(lang, "chain.ok", { checked: r.checked, skipped });
  const first = r.breaks[0];
  return fmt(lang, "chain.ng",
    { checked: r.checked, skipped, where: breakWhere(first), reason: breakReason(first) });
}

// Recomputes the hash chain and reports what it found.
async function runChainVerification() {
  const r = await verifyAuditChain();
  els.chainResult.replaceChildren();
  els.chainResult.classList.toggle("ok", r.ok);
  els.chainResult.classList.toggle("ng", !r.ok);

  const summary = document.createElement("p");
  summary.className = "chain-summary";
  summary.textContent = `${r.ok ? "✅" : "⚠"} ${chainSummary(r)}`;
  els.chainResult.appendChild(summary);

  // With a single break the summary already names it, so a list would
  // only repeat the same line.
  if (r.breaks.length > 1) {
    const ul = document.createElement("ul");
    ul.className = "bullet-list";
    for (const b of r.breaks.slice(0, 10)) {
      const li = document.createElement("li");
      li.textContent = fmt(lang, "chain.item",
        { where: breakWhere(b), reason: breakReason(b) });
      ul.appendChild(li);
    }
    els.chainResult.appendChild(ul);
    if (r.breaks.length > 10) {
      const more = document.createElement("p");
      more.textContent = fmt(lang, "chain.more", { n: r.breaks.length - 10 });
      els.chainResult.appendChild(more);
    }
  }
}

// ============ Settings modal ============
function openSettingsModal() {
  const f = els.formSettings;
  field(f, "profileName").value = state.settings.profileName || "local-admin";
  field(f, "multiThreshold").value = state.settings.multiThreshold;
  field(f, "expiringSoonDays").value = state.settings.expiringSoonDays;
  field(f, "masterLoanDays").value = state.settings.masterLoanDays;
  els.dlgSettings.showModal();
}

function updateThemeIcon() {
  const icon = state.theme === "dark" ? "☀️" : "🌙";
  const icons = document.querySelectorAll(".theme-icon");
  icons.forEach(el => el.textContent = icon);
}

// ============ Events ============
// ============ Language ============
function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice just does not persist.
  }
}

// Redraws everything in the other language. Nothing is recalculated: the
// ledger is read from the cache and the text comes from the dictionary.
async function switchLang(next) {
  lang = next;
  writeStored(LANG_STORAGE_KEY, lang);
  applyI18n(document, lang);
  if (els.dlgKey.open) {
    // applyI18n writes the generic modal title, so put the right one back
    els.dlgKeyTitle.textContent = t(lang, isNewKey ? "key.new_title" : "key.edit_title");
    const category = field(els.formKey, "category").value;
    const type = field(els.formKey, "type").value;
    updateTypeOptions(category, type);
  }
  if (lastQrUrl) els.qrInfo.textContent = fmt(lang, "fmt.qr_info", { url: lastQrUrl });
  clearChainResult();
  await rerenderAll();
}

window.addEventListener("DOMContentLoaded", async () => {
  await initLogic();

  // Language: ?lang= wins, then the saved choice, then the browser
  const urlLang = new URL(location.href).searchParams.get("lang");
  lang = pickLang({
    urlLang,
    savedLang: readStored(LANG_STORAGE_KEY),
    browserLang: navigator.language
  });
  if (urlLang) writeStored(LANG_STORAGE_KEY, lang);
  applyI18n(document, lang);

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
      alert(errorText(err));
    }
  });

  els.btnKeyDelete.addEventListener("click", async () => {
    if (!currentKeyUuid) return;
    if (!confirm(t(lang, "key.delete_confirm"))) return;
    try {
      await deleteKey(currentKeyUuid);
      els.dlgKey.close();
      await rerenderAll();
    } catch (err) {
      alert(errorText(err));
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
      alert(errorText(err));
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
      alert(errorText(err));
    }
  });

  // Export / Import / Audit / Settings
  els.btnExport.addEventListener("click", exportJson);
  async function handleImportFile(e, closeMenu) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(t(lang, "alert.import_confirm"))) {
      e.target.value = "";
      if (closeMenu) els.mobileMenu.classList.add("hidden");
      return;
    }
    try {
      const counts = await importJsonFile(file);
      await rerenderAll();
      alert(fmt(lang, "alert.import_done",
        { keys: counts.keys, loans: counts.loans, audit: counts.audit }));
    } catch (err) {
      alert([t(lang, "alert.import_failed"), errorText(err)].join("\n"));
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
      alert([t(lang, "chain.failed"), errorText(err)].join("\n"));
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
      multiThreshold: field(f, "multiThreshold").value,
      expiringSoonDays: field(f, "expiringSoonDays").value,
      masterLoanDays: field(f, "masterLoanDays").value,
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

  // Language toggle
  els.btnLang.addEventListener("click", () => { switchLang(otherLang(lang)); });
  els.btnLangMobile.addEventListener("click", () => {
    switchLang(otherLang(lang));
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
