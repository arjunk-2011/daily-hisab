(() => {
  "use strict";

  // Category keys stay in English inside saved data (so old data keeps working).
  // What the user SEES is translated through i18n.js.
  const CATEGORIES = {
    Food: "🍛", Grocery: "🛒", Petrol: "⛽", "Credit Card": "💳", Home: "🏠", Shopping: "🛍️", Other: "•••"
  };

  const STORAGE_KEY = "daily_hisab_by_ak_expenses_v1";
  const SETTINGS_KEY = "daily_hisab_by_ak_settings_v1";

  const state = { expenses: [], selectedCategory: "Food", period: "month" };
  const settings = loadSettings();

  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, "0");
  const localeTag = () => settings.lang === "gu" ? "gu-IN" : "en-IN";

  // ---------- translation ----------
  function t(key, vars) {
    const dict = window.I18N[settings.lang] || window.I18N.en;
    let s = dict[key] ?? window.I18N.en[key] ?? key;
    if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }
  const catName = c => t("cat_" + c);
  const countText = n => t(n === 1 ? "entry_one" : "entry_many", { n });

  function applyStaticText() {
    document.documentElement.lang = settings.lang;
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    // The toggle button shows the language you can switch TO.
    $("langToggle").textContent = settings.lang === "gu" ? "EN" : "ગુ";
    document.querySelectorAll("[data-lang]").forEach(b => b.classList.toggle("active", b.dataset.lang === settings.lang));
    // Form title / button depend on add vs edit mode.
    const editing = !!$("editId").value;
    $("formTitle").textContent = t(editing ? "edit_expense" : "add_expense");
    $("saveBtn").textContent = t(editing ? "update_expense" : "save_expense");
  }

  function setLanguage(lang) {
    if (lang !== "en" && lang !== "gu") return;
    settings.lang = lang;
    saveSettings();
    applyStaticText();
    updateBranding();
    renderCategories();
    renderAll();
    $("exportMonth").value ||= monthNow();
  }

  // ---------- settings (language, name, tagline, logo) ----------
  function loadSettings() {
    const defaults = {
      lang: (navigator.language || "en").toLowerCase().startsWith("gu") ? "gu" : "en",
      appName: "", tagline: "", logo: "", logoText: "₹"
    };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults;
      const saved = JSON.parse(raw);
      return Object.assign(defaults, saved && typeof saved === "object" ? saved : {});
    } catch { return defaults; }
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    catch { toast(t("msg_storage_full")); }
  }

  const displayName = () => settings.appName.trim() || t("appName");
  const displayTagline = () => settings.tagline.trim() || t("tagline");

  function renderLogoInto(el, size) {
    el.innerHTML = "";
    if (settings.logo) {
      const img = document.createElement("img");
      img.src = settings.logo; img.alt = ""; img.className = "logo-img";
      el.appendChild(img);
    } else {
      el.textContent = settings.logoText || "₹";
    }
  }

  // Resize any picture to a square PNG (centre-cropped).
  function squareDataUrl(src, size) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  let manifestUrl = null;
  async function updateBranding() {
    const name = displayName();
    $("brandName").textContent = name;
    $("brandTagline").textContent = displayTagline();
    document.title = name;
    renderLogoInto($("brandIcon"));
    renderLogoInto($("logoPreview"));
    $("brandIcon").classList.toggle("has-img", !!settings.logo);
    $("logoPreview").classList.toggle("has-img", !!settings.logo);

    // Browser tab icon + iOS home-screen icon
    $("faviconLink").href = settings.logo || "icon.svg";
    $("faviconLink").type = settings.logo ? "image/png" : "image/svg+xml";
    $("appleIconLink").href = settings.logo || "icon-192.png";

    // Installed-app name and icon. Only when the user has customised the app do we build a live
    // manifest; otherwise the normal manifest.json is used (this is what PWABuilder and stores read).
    const customised = !!(settings.logo || settings.appName.trim() || settings.tagline.trim());
    if (!customised) {
      if (manifestUrl) { URL.revokeObjectURL(manifestUrl); manifestUrl = null; }
      $("manifestLink").setAttribute("href", "manifest.json");
      return;
    }
    try {
      const base = new URL("./", location.href).href;
      let icons;
      if (settings.logo) {
        const i192 = await squareDataUrl(settings.logo, 192);
        const i512 = await squareDataUrl(settings.logo, 512);
        icons = [
          { src: i192, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: i512, sizes: "512x512", type: "image/png", purpose: "any" }
        ];
      } else {
        icons = [
          { src: base + "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: base + "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: base + "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
        ];
      }
      const manifest = {
        name, short_name: name.length > 12 ? name.slice(0, 12) : name,
        description: displayTagline(), lang: settings.lang,
        start_url: base, scope: base, display: "standalone",
        background_color: "#f5f8fc", theme_color: "#1264e8", orientation: "portrait", icons
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
      const old = manifestUrl;
      manifestUrl = URL.createObjectURL(blob);
      $("manifestLink").href = manifestUrl;
      if (old) URL.revokeObjectURL(old);
    } catch { /* manifest.json fallback stays in place */ }
  }

  // ---------- helpers ----------
  const money = n => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const localIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const monthNow = () => today().slice(0, 7);

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state.expenses = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(state.expenses)) state.expenses = [];
    } catch {
      state.expenses = [];
      toast(t("msg_read_fail"));
    }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses)); }
    catch { toast(t("msg_storage_full")); }
  }

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === name));
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.nav === name));
    if (name === "home") renderHome();
    if (name === "overview") renderOverview();
    if (name === "history") renderHistory();
    if (name === "excel") $("exportMonth").value ||= monthNow();
    if (name === "settings") fillSettingsForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function dateLabel(iso) {
    return new Date(iso + "T12:00:00").toLocaleDateString(localeTag(), { day: "2-digit", month: "short", year: "numeric" });
  }
  function formatTime(tm) {
    const [h, m] = tm.split(":").map(Number);
    const d = new Date(); d.setHours(h, m);
    return d.toLocaleTimeString(localeTag(), { hour: "numeric", minute: "2-digit" });
  }
  const sortDesc = arr => [...arr].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const sum = arr => arr.reduce((s, e) => s + Number(e.amount), 0);
  const isToday = e => e.date === today();
  const isMonth = (e, month) => e.date.startsWith(month);

  // ---------- rendering ----------
  function renderAll() { renderHome(); renderOverview(); renderHistory(); }

  function renderCategories() {
    $("categoryGrid").innerHTML = Object.entries(CATEGORIES).map(([name, icon]) =>
      `<button type="button" class="${state.selectedCategory === name ? "selected" : ""}" data-category="${escapeAttr(name)}"><span>${icon}</span>${escapeHtml(catName(name))}</button>`
    ).join("");
    const keep = $("filterCategory").value;
    $("filterCategory").innerHTML = `<option value="">${escapeHtml(t("all_categories"))}</option>` +
      Object.keys(CATEGORIES).map(c => `<option value="${escapeAttr(c)}">${escapeHtml(catName(c))}</option>`).join("");
    $("filterCategory").value = keep;
  }

  function renderHome() {
    $("todayLabel").textContent = new Date().toLocaleDateString(localeTag(), { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const tl = state.expenses.filter(isToday);
    $("todayTotal").textContent = money(sum(tl));
    $("todayCount").textContent = countText(tl.length);
    $("monthTotalMini").textContent = t("this_month_amt", { amt: money(sum(state.expenses.filter(e => isMonth(e, monthNow())))) });
    $("todayList").innerHTML = sortDesc(tl).map(expenseRow).join("");
    $("todayEmpty").classList.toggle("hidden", tl.length !== 0);
  }

  function expenseRow(e) {
    return `<div class="expense-row">
      <div class="expense-icon">${CATEGORIES[e.category] || "•"}</div>
      <div class="expense-main"><strong>${escapeHtml(e.description)}</strong><small>${escapeHtml(CATEGORIES[e.category] ? catName(e.category) : e.category)} · ${formatTime(e.time)}${e.note ? " · " + escapeHtml(e.note) : ""}</small></div>
      <div class="expense-amount">${money(e.amount)}<small>${dateLabel(e.date)}</small></div>
      <div class="row-actions"><button data-edit="${e.id}" aria-label="${escapeAttr(t("aria_edit"))}">✎</button><button class="delete" data-delete="${e.id}" aria-label="${escapeAttr(t("aria_delete"))}">×</button></div>
    </div>`;
  }

  function renderOverview() {
    const all = state.expenses;
    let filtered;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (state.period === "today") filtered = all.filter(isToday);
    else if (state.period === "week") {
      const day = d.getDay();
      const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const mondayIso = localIso(monday); // local date (not UTC) so the week starts on the right day in India
      filtered = all.filter(e => e.date >= mondayIso && e.date <= today());
    } else filtered = all.filter(e => isMonth(e, monthNow()));

    const total = sum(filtered);
    $("overviewTotal").textContent = money(total);
    $("overviewCount").textContent = filtered.length;
    $("overviewAverage").textContent = money(filtered.length ? total / filtered.length : 0);

    const cats = {};
    filtered.forEach(e => cats[e.category] = (cats[e.category] || 0) + Number(e.amount));
    const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] || 1;
    $("categoryBreakdown").innerHTML = entries.length ? entries.map(([c, v]) =>
      `<div class="bar-item"><div class="bar-top"><span>${CATEGORIES[c] || "•"} ${escapeHtml(CATEGORIES[c] ? catName(c) : c)}</span><strong>${money(v)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${(v / max) * 100}%"></div></div></div>`
    ).join("") : `<p class="muted">${escapeHtml(t("no_period_expenses"))}</p>`;
    $("overviewRecent").innerHTML = sortDesc(filtered).slice(0, 8).map(expenseRow).join("") || `<p class="muted">${escapeHtml(t("no_recent"))}</p>`;
    document.querySelectorAll(".period[data-period]").forEach(b => b.classList.toggle("active", b.dataset.period === state.period));
  }

  function renderHistory() {
    const q = $("search").value.trim().toLowerCase();
    const cat = $("filterCategory").value;
    const from = $("fromDate").value, to = $("toDate").value;
    const filtered = sortDesc(state.expenses).filter(e => {
      const hay = `${e.description} ${e.category} ${CATEGORIES[e.category] ? catName(e.category) : ""} ${e.note || ""}`.toLowerCase();
      return (!q || hay.includes(q)) && (!cat || e.category === cat) && (!from || e.date >= from) && (!to || e.date <= to);
    });
    $("historyCount").textContent = countText(filtered.length);
    $("historyTotal").textContent = money(sum(filtered));
    $("historyList").innerHTML = filtered.map(expenseRow).join("");
    $("historyEmpty").classList.toggle("hidden", filtered.length !== 0);
  }

  // ---------- add / edit / delete ----------
  function resetForm() {
    $("expenseForm").reset();
    $("editId").value = "";
    $("date").value = today();
    $("time").value = nowTime();
    state.selectedCategory = "Food";
    $("cancelEdit").classList.add("hidden");
    applyStaticText();
    renderCategories();
  }

  function editExpense(id) {
    const e = state.expenses.find(x => x.id === id); if (!e) return;
    $("editId").value = e.id;
    $("amount").value = e.amount;
    $("description").value = e.description;
    $("date").value = e.date; $("time").value = e.time; $("note").value = e.note || "";
    state.selectedCategory = e.category;
    $("cancelEdit").classList.remove("hidden");
    applyStaticText();
    renderCategories(); showScreen("add");
  }

  function deleteExpense(id) {
    const e = state.expenses.find(x => x.id === id); if (!e) return;
    if (!confirm(t("confirm_delete", { d: e.description, amt: money(e.amount) }))) return;
    state.expenses = state.expenses.filter(x => x.id !== id); save();
    renderAll();
    toast(t("msg_deleted"));
  }

  $("expenseForm").addEventListener("submit", ev => {
    ev.preventDefault();
    const amount = Number($("amount").value);
    const description = $("description").value.trim();
    if (!amount || amount <= 0 || !description) { toast(t("msg_need_fields")); return; }
    const editId = $("editId").value;
    const item = {
      id: editId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
      amount: Math.round(amount * 100) / 100,
      description,
      category: state.selectedCategory,
      date: $("date").value,
      time: $("time").value,
      note: $("note").value.trim(),
      updatedAt: new Date().toISOString()
    };
    if (editId) {
      const idx = state.expenses.findIndex(x => x.id === editId);
      if (idx >= 0) { item.createdAt = state.expenses[idx].createdAt; state.expenses[idx] = item; }
      toast(t("msg_updated"));
    } else {
      item.createdAt = new Date().toISOString();
      state.expenses.push(item);
      toast(t("msg_saved"));
    }
    save(); resetForm(); showScreen("home");
  });

  $("categoryGrid").addEventListener("click", e => {
    const b = e.target.closest("[data-category]"); if (!b) return;
    state.selectedCategory = b.dataset.category; renderCategories();
  });

  document.addEventListener("click", e => {
    const nav = e.target.closest("[data-nav]"); if (nav) { showScreen(nav.dataset.nav); return; }
    const action = e.target.closest("[data-action]");
    if (action) {
      if (action.dataset.action === "go-add") { resetForm(); showScreen("add"); }
      if (action.dataset.action === "go-history") { showScreen("history"); }
    }
    const quick = e.target.closest("[data-quick]");
    if (quick) { resetForm(); $("description").value = t("q_" + quick.dataset.quick); showScreen("add"); }
    const edit = e.target.closest("[data-edit]"); if (edit) editExpense(edit.dataset.edit);
    const del = e.target.closest("[data-delete]"); if (del) deleteExpense(del.dataset.delete);
    const lang = e.target.closest("[data-lang]"); if (lang) setLanguage(lang.dataset.lang);
  });

  $("langToggle").addEventListener("click", () => setLanguage(settings.lang === "gu" ? "en" : "gu"));
  $("cancelEdit").addEventListener("click", () => { resetForm(); showScreen("home"); });
  document.querySelectorAll(".period[data-period]").forEach(b => b.addEventListener("click", () => { state.period = b.dataset.period; renderOverview(); }));
  ["search", "filterCategory", "fromDate", "toDate"].forEach(id => $(id).addEventListener("input", renderHistory));
  $("clearFilters").addEventListener("click", () => { $("search").value = ""; $("filterCategory").value = ""; $("fromDate").value = ""; $("toDate").value = ""; renderHistory(); });

  // ---------- export / backup ----------
  const csvEscape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;

  function exportCsv() {
    const month = $("exportMonth").value || monthNow();
    const data = sortDesc(state.expenses.filter(e => isMonth(e, month))).reverse();
    const rows = [[t("csv_date"), t("csv_time"), t("csv_desc"), t("csv_cat"), t("csv_amount"), t("csv_note")]];
    data.forEach(e => rows.push([e.date, e.time, e.description, CATEGORIES[e.category] ? catName(e.category) : e.category, e.amount, e.note || ""]));
    rows.push([]);
    rows.push([t("csv_total"), "", "", "", "", sum(data)]);
    const csv = "\uFEFF" + rows.map(r => r.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `Daily-Hisab-by-AK-${month}.csv`; a.click(); URL.revokeObjectURL(a.href);
    toast(t("msg_exported", { n: data.length }));
  }
  $("exportBtn").addEventListener("click", exportCsv);

  $("backupBtn").addEventListener("click", () => {
    const payload = { app: "Daily Hisab by AK", version: 2, exportedAt: new Date().toISOString(), expenses: state.expenses, settings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Daily-Hisab-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
    $("backupStatus").textContent = t("msg_backup_done");
  });

  $("restoreInput").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.expenses)) throw new Error();
      if (!confirm(t("confirm_restore", { n: data.expenses.length }))) { e.target.value = ""; return; }
      state.expenses = data.expenses; save();
      if (data.settings && typeof data.settings === "object") {
        const s = data.settings;
        if (typeof s.appName === "string") settings.appName = s.appName;
        if (typeof s.tagline === "string") settings.tagline = s.tagline;
        if (typeof s.logo === "string" && (s.logo === "" || s.logo.startsWith("data:image/"))) settings.logo = s.logo;
        if (typeof s.logoText === "string") settings.logoText = s.logoText;
        saveSettings(); updateBranding();
      }
      renderAll();
      $("backupStatus").textContent = t("msg_restore_done"); toast(t("msg_restore_toast"));
    } catch { toast(t("msg_invalid_backup")); }
    e.target.value = "";
  });

  // ---------- settings screen ----------
  function fillSettingsForm() {
    $("appNameInput").value = settings.appName;
    $("taglineInput").value = settings.tagline;
    $("logoText").value = settings.logoText;
    renderLogoInto($("logoPreview"));
  }

  $("saveSettings").addEventListener("click", () => {
    settings.appName = $("appNameInput").value.trim();
    settings.tagline = $("taglineInput").value.trim();
    settings.logoText = $("logoText").value.trim() || "₹";
    saveSettings(); updateBranding();
    toast(t("msg_settings_saved"));
  });

  $("logoInput").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    if (!file.type.startsWith("image/")) { toast(t("msg_not_image")); e.target.value = ""; return; }
    try {
      const reader = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      settings.logo = await squareDataUrl(reader, 512);
      saveSettings(); await updateBranding();
      toast(t("msg_logo_updated"));
    } catch { toast(t("msg_logo_fail")); }
    e.target.value = "";
  });

  $("logoReset").addEventListener("click", () => {
    settings.logo = ""; saveSettings(); updateBranding();
    toast(t("msg_logo_reset"));
  });

  // ---------- helpers: escaping ----------
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---------- install prompt + offline ----------
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; $("installBtn").classList.remove("hidden"); });
  $("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $("installBtn").classList.add("hidden");
  });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));

  // ---------- start ----------
  load();
  $("exportMonth").value = monthNow();
  resetForm();          // also applies translated static text
  updateBranding();
  renderAll();
})();
