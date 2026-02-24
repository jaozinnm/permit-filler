"use strict";

// ✅ trava total contra "carreguei 2x sem querer"
if (window.__PF_APP_LOADED__) {
  console.warn("[PF] app.js carregado 2x — ignorando segunda carga.");
} else {
  window.__PF_APP_LOADED__ = true;
}

// ================== CONFIG ==================
// ✅ anti-duplicação (se o app.js for carregado 2x, não explode)
window.API_BASE = window.API_BASE || "http://127.0.0.1:4000";
var API_BASE = window.API_BASE;

// ===== Router simples por página =====
// ✅ anti-duplicação do PAGE
window.PAGE = window.PAGE || document.body?.dataset?.page || "";
var PAGE = window.PAGE;

function nav(to) {
  window.location.href = to;
}

function saveSession(patch) {
  const cur = JSON.parse(localStorage.getItem("pf_session") || "{}");
  const next = { ...cur, ...patch };
  localStorage.setItem("pf_session", JSON.stringify(next));
  return next;
}

function getSession() {
  return JSON.parse(localStorage.getItem("pf_session") || "{}");
}

// ====== API (shared) ======
async function apiSaveOverride(payload) {
  const r = await fetch(`${API_BASE}/api/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiGeneratePacket(project_key) {
  const r = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_key }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiGenerateCompany(payload) {
  const r = await fetch(`${API_BASE}/api/generate-company`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiGetProjects() {
  const r = await fetch(`${API_BASE}/api/projects`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiOpenFolder(path) {
  const r = await fetch(`${API_BASE}/api/open-folder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// catálogo
async function apiCatalogCities() {
  const r = await fetch(`${API_BASE}/api/catalog/cities`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiCatalogForms(city) {
  const r = await fetch(
    `${API_BASE}/api/catalog/${encodeURIComponent(city)}/forms`,
    {
      cache: "no-store",
    },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// companies
async function apiCompanies() {
  const r = await fetch(`${API_BASE}/api/companies`, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiCompanyUpsert(company_key, data) {
  const r = await fetch(`${API_BASE}/api/companies/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_key, data }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ====== PREVIEW (via API /api/data/{name}) ======
async function apiGetData(name) {
  const r = await fetch(`${API_BASE}/api/data/${name}`, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.data || {};
}

// ====== HELPERS ======
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function uid(prefix = "ly") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function setStatus(el, msg) {
  if (!el) return;
  el.textContent = msg || "";
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getCheckedFormKeys(container) {
  if (!container) return [];
  const checks = Array.from(
    container.querySelectorAll('input[type="checkbox"][data-form-key]'),
  );
  return checks
    .filter((c) => c.checked)
    .map((c) => c.getAttribute("data-form-key"));
}

function renderPermitsList(container, forms, selectedKeys = []) {
  if (!container) return;
  container.innerHTML = "";

  if (!forms?.length) {
    container.innerHTML = `<div class="mini">Nenhum permit encontrado para essa city.</div>`;
    return;
  }

  for (const f of forms) {
    const id = uid("permit");
    const name = f.name || f.label || f.form_key;

    const row = document.createElement("label");
    row.className = "permitRow";
    row.setAttribute("for", id);
    row.innerHTML = `
      <input id="${id}" type="checkbox" data-form-key="${f.form_key}" />
      <span class="permitName">${name}</span>
      <span class="mini">(${f.form_key})</span>
    `;

    const input = row.querySelector("input");
    if (input && selectedKeys.includes(f.form_key)) input.checked = true;

    container.appendChild(row);
  }
}

// =====================================================
// ===================== COMPANY PAGE ==================
// =====================================================
function initCompanyPage() {
  const el = {
    selCompany: document.getElementById("selCompany"),
    companyKey: document.getElementById("companyKey"),
    companyName: document.getElementById("companyName"),
    companyLicense: document.getElementById("companyLicense"),
    companyAddress: document.getElementById("companyAddress"),
    companyPhone: document.getElementById("companyPhone"),
    companyEmail: document.getElementById("companyEmail"),

    // ✅ se existir no HTML, salva também
    companyQualifier: document.getElementById("companyQualifier"),

    btnSaveCompany: document.getElementById("btnSaveCompany"),
    btnGoProject: document.getElementById("btnGoProject"),

    // ✅ suporta status em apiStatus OU companyMsg
    apiStatus:
      document.getElementById("apiStatus") ||
      document.getElementById("companyMsg"),
    btnRefreshCompanies: document.getElementById("btnRefreshCompanies"),
  };

  async function loadCompaniesIntoSelect() {
    const res = await apiCompanies();
    const companies = res.companies || [];
    if (!el.selCompany) return;

    el.selCompany.innerHTML = `<option value="">— Select —</option>`;
    for (const c of companies) {
      const key = c.company_key;
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = `${c.name || key} (${key})`;
      el.selCompany.appendChild(opt);
    }

    const sess = getSession();
    if (sess.company_key) el.selCompany.value = sess.company_key;
  }

  async function onSelectCompany() {
    const key = el.selCompany?.value || "";
    if (!key) return;
    saveSession({ company_key: key });

    const res = await fetch(
      `${API_BASE}/api/companies/${encodeURIComponent(key)}`,
      {
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(await res.text());
    const j = await res.json();
    const c = j.company || {};

    if (el.companyKey) el.companyKey.value = c.company_key || key;
    if (el.companyName) el.companyName.value = c.name || "";
    if (el.companyLicense) el.companyLicense.value = c.license || "";
    if (el.companyAddress) el.companyAddress.value = c.address || "";
    if (el.companyPhone) el.companyPhone.value = c.phone || "";
    if (el.companyEmail) el.companyEmail.value = c.email || "";
    if (el.companyQualifier) el.companyQualifier.value = c.qualifier || "";
  }

  async function onSaveCompany() {
    const key = (el.companyKey?.value || "").trim();
    if (!key) return setStatus(el.apiStatus, "❌ Informe o company_key.");

    const data = {
      name: el.companyName?.value || "",
      license: el.companyLicense?.value || "",
      address: el.companyAddress?.value || "",
      phone: el.companyPhone?.value || "",
      email: el.companyEmail?.value || "",
      // ✅ não quebra se backend ignorar
      qualifier: el.companyQualifier?.value || "",
    };

    // ✅ opcional: dicionário padrão pronto (backend pode ignorar sem quebrar)
    data.fields = {
      "company.name": data.name,
      "company.license": data.license,
      "company.qualifier_name": data.qualifier,
      "company.address": data.address,
      "company.phone": data.phone,
      "company.email": data.email,
    };

    setStatus(el.apiStatus, "Salvando...");
    await apiCompanyUpsert(key, data);
    setStatus(el.apiStatus, "✅ Salvo!");
    saveSession({ company_key: key });

    await loadCompaniesIntoSelect();
    if (el.selCompany) el.selCompany.value = key;
  }

  if (el.selCompany)
    el.selCompany.onchange = () => onSelectCompany().catch(console.error);
  if (el.btnSaveCompany)
    el.btnSaveCompany.onclick = () => onSaveCompany().catch(console.error);
  if (el.btnGoProject) el.btnGoProject.onclick = () => nav("./project.html");

  if (el.btnRefreshCompanies) {
    el.btnRefreshCompanies.onclick = () =>
      loadCompaniesIntoSelect().catch(console.error);
  }

  loadCompaniesIntoSelect()
    .then(() => onSelectCompany())
    .catch((e) =>
      setStatus(el.apiStatus, "❌ API offline: " + (e?.message || String(e))),
    );
}

// =====================================================
// ===================== PROJECT PAGE ===================
// =====================================================
function initProjectPage() {
  const el = {
    btnGoCompany: document.getElementById("btnGoCompany"),

    selCity: document.getElementById("selCity"),
    permitsList: document.getElementById("permitsList"),
    projectName: document.getElementById("projectName"),
    btnSelectAllPermits: document.getElementById("btnSelectAllPermits"),
    btnClearPermits: document.getElementById("btnClearPermits"),
    btnCreateProject: document.getElementById("btnCreateProject"),

    projectSelect: document.getElementById("projectSelect"),
    btnRefreshProjects: document.getElementById("btnRefreshProjects"),
    btnOpenEditor: document.getElementById("btnOpenEditor"),

    btnGeneratePacket: document.getElementById("btnGeneratePacket"),
    btnOpenFolder: document.getElementById("btnOpenFolder"),

    apiStatus: document.getElementById("apiStatus"),
  };

  let lastOutFolder = null;

  if (el.btnGoCompany) el.btnGoCompany.onclick = () => nav("./company.html");

  async function loadCities() {
    if (!el.selCity) return;

    // 🔒 trava o sistema em Miami
    el.selCity.innerHTML = `
    <option value="">— Select —</option>
    <option value="miami">miami</option>
  `;

    el.selCity.value = "miami";
    saveSession({ city: "miami" });

    // carrega automaticamente os permits de Miami
    await loadPermitsForCity("miami");
  }

  async function loadPermitsForCity(city) {
    if (!city) {
      renderPermitsList(el.permitsList, []);
      return;
    }

    let forms = [];

    // ✅ REGRA SIMPLES:
    // Se a city for MIAMI, mostramos os 3 permits fixos
    if (city === "miami") {
      forms = [
        {
          city: "miami",
          form_key: "building_permit",
          name: "City of Miami - Permit Application",
        },
        {
          city: "miami",
          form_key: "hvhz",
          name: "HVHZ Uniform Permit Application (FBC 8th 2023)",
        },
        {
          city: "miami",
          form_key: "miami_dade",
          name: "Miami-Dade County Permit",
        },
      ];
    } else {
      // fallback padrão (não mexe no resto do sistema)
      const res = await apiCatalogForms(city);
      forms = res.forms || [];
    }

    const sess = getSession();
    const selected = sess.form_keys || [];
    renderPermitsList(el.permitsList, forms, selected);
  }

  if (el.btnSelectAllPermits) {
    el.btnSelectAllPermits.onclick = () => {
      const checks =
        el.permitsList?.querySelectorAll(
          'input[type="checkbox"][data-form-key]',
        ) || [];
      checks.forEach((c) => (c.checked = true));
    };
  }

  if (el.btnClearPermits) {
    el.btnClearPermits.onclick = () => {
      const checks =
        el.permitsList?.querySelectorAll(
          'input[type="checkbox"][data-form-key]',
        ) || [];
      checks.forEach((c) => (c.checked = false));
    };
  }

  // ✅ MVP: “Create project” só salva seleção na sessão e manda pro editor
  if (el.btnCreateProject) {
    el.btnCreateProject.onclick = () => {
      const city = el.selCity?.value || "";
      const form_keys = getCheckedFormKeys(el.permitsList);

      if (!city) return setStatus(el.apiStatus, "❌ Selecione uma city.");
      if (!form_keys.length)
        return setStatus(el.apiStatus, "❌ Marque pelo menos 1 permit.");

      saveSession({
        city,
        form_keys,
        project_name: (el.projectName?.value || "").trim(),
      });

      const job_address = (
        document.getElementById("jobAddress")?.value || ""
      ).trim();
      const job_zip = (document.getElementById("jobZip")?.value || "").trim();
      const roof_category = (
        document.getElementById("roofCategory")?.value || ""
      ).trim();
      const roof_area_sqft = (
        document.getElementById("roofAreaSqft")?.value || ""
      ).trim();

      saveSession({
        job_address,
        job_zip,
        roof_category,
        roof_area_sqft,
      });

      setStatus(el.apiStatus, "✅ Seleção salva. Abrindo editor...");
      nav("./editor.html");
    };
  }

  if (el.btnOpenEditor) el.btnOpenEditor.onclick = () => nav("./editor.html");

  if (el.btnGeneratePacket) {
    el.btnGeneratePacket.onclick = async () => {
      try {
        const sess = getSession();
        const company_key = sess.company_key;
        const city = sess.city;
        const form_keys = sess.form_keys || getCheckedFormKeys(el.permitsList);

        if (!company_key)
          return setStatus(
            el.apiStatus,
            "❌ Selecione a company na tela Company.",
          );
        if (!city) return setStatus(el.apiStatus, "❌ Selecione uma city.");
        if (!form_keys.length)
          return setStatus(el.apiStatus, "❌ Marque pelo menos 1 permit.");

        setStatus(el.apiStatus, "Gerando PDFs...");
        const res = await apiGenerateCompany({ company_key, city, form_keys });
        lastOutFolder = res.out_folder || null;
        setStatus(el.apiStatus, "✅ Gerado!\n" + JSON.stringify(res, null, 2));
      } catch (e) {
        setStatus(
          el.apiStatus,
          "❌ Erro ao gerar: " + (e?.message || String(e)),
        );
      }
    };
  }

  if (el.btnOpenFolder) {
    el.btnOpenFolder.onclick = async () => {
      if (!lastOutFolder)
        return setStatus(el.apiStatus, "❌ Nenhum packet gerado ainda.");
      try {
        await apiOpenFolder(lastOutFolder);
      } catch (e) {
        setStatus(
          el.apiStatus,
          "❌ Erro ao abrir pasta: " + (e?.message || String(e)),
        );
      }
    };
  }

  // init
  loadCities()
    .then(async () => {
      const city = el.selCity?.value || getSession().city || "";
      if (city) await loadPermitsForCity(city);
    })
    .catch((e) =>
      setStatus(el.apiStatus, "❌ API offline: " + (e?.message || String(e))),
    );
}

// =====================================================
// ===================== EDITOR PAGE ====================
// =====================================================
function initEditorPage() {
  initEditor();
}

// ====== BOOT ======
window.addEventListener("DOMContentLoaded", () => {
  try {
    if (window.PAGE === "company") return initCompanyPage();
    if (window.PAGE === "project") return initProjectPage();
    if (window.PAGE === "editor") return initEditorPage();
  } catch (e) {
    console.error(e);
    const s = document.getElementById("apiStatus");
    if (s) s.textContent = "❌ Erro: " + (e?.message || String(e));
  }
});

// ================= EDITOR =================
function loadSessionSafe() {
  try {
    return JSON.parse(localStorage.getItem("pf_session") || "{}");
  } catch (e) {
    console.error("Session inválida", e);
    return null;
  }
}

function setApiStatus(msg) {
  const el = document.getElementById("apiStatus");
  if (el) el.textContent = msg || "";
}

// ================= PROJECT DATA UI (Editor) =================
function fillProjectDataUIFromSession() {
  const s = getSession();

  const a = document.getElementById("edJobAddress");
  const z = document.getElementById("edJobZip");
  const rc = document.getElementById("edRoofCategory");
  const ra = document.getElementById("edRoofAreaSqft");

  if (a) a.value = s.job_address || "";
  if (z) z.value = s.job_zip || "";
  if (rc) rc.value = s.roof_category || "";
  if (ra) ra.value = s.roof_area_sqft || "";
}

function readProjectDataUIToSession() {
  const job_address = (
    document.getElementById("edJobAddress")?.value || ""
  ).trim();
  const job_zip = (document.getElementById("edJobZip")?.value || "").trim();
  const roof_category = (
    document.getElementById("edRoofCategory")?.value || ""
  ).trim();
  const roof_area_sqft = (
    document.getElementById("edRoofAreaSqft")?.value || ""
  ).trim();

  saveSession({ job_address, job_zip, roof_category, roof_area_sqft });
}

// ================= PATCH 2 helper =================
// render do PDF baseado em URL (blank.pdf do backend) + navegação por páginas
async function renderPDFByUrl(url) {
  if (!window.pdfjsLib) {
    setApiStatus("❌ pdfjsLib não carregou. Confere o editor.html.");
    return;
  }

  // estado global simples
  window.__pdfUrl = url;
  window.__pdfPage = window.__pdfPage || 1;

  const task = window.pdfjsLib.getDocument(url);
  const pdf = await task.promise;

  window.__pdfDoc = pdf;

  // se a página atual for maior que total, corrige
  if (window.__pdfPage > pdf.numPages) window.__pdfPage = pdf.numPages;
  if (window.__pdfPage < 1) window.__pdfPage = 1;

  async function renderCurrentPage() {
    const pageNum = window.__pdfPage || 1;
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    window.__pdfScale = Number(viewport?.scale || 1.5);
    window.__pdfCanvasHeight = Number(viewport?.height || 0);


    const canvas = document.getElementById("pdfCanvas");
    if (!canvas) {
      setApiStatus("❌ pdfCanvas não encontrado no HTML.");
      return;
    }
    const ctx = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;

    // ✅ alinhar overlay exatamente por cima do canvas
    const overlay = document.getElementById("overlay");
    if (overlay) {
      overlay.style.position = "absolute";
      overlay.style.width = canvas.width + "px";
      overlay.style.height = canvas.height + "px";
      overlay.style.left = canvas.offsetLeft + "px";
      overlay.style.top = canvas.offsetTop + "px";
    }

    // se existir UI de página, atualiza
    const elPageNum = document.getElementById("pageNum");
    const elPageInfo = document.getElementById("pageInfo");
    if (elPageNum) elPageNum.value = String(pageNum);
    if (elPageInfo)
      elPageInfo.textContent = `Página ${pageNum} / ${pdf.numPages}`;

    // ✅ PATCH 3: ao mudar página, redesenha overlay conforme o page atual
    try {
      if (typeof window.__editorSetLayers === "function") {
        window.__editorSetLayers(window.__editorLayers || []);
      }
    } catch (e) {
      console.warn("[PF] redraw overlay falhou", e);
    }
  }

  // expõe helpers (p/ botões/atalhos)
  window.__pdfRenderCurrentPage = renderCurrentPage;
  window.__pdfNextPage = async () => {
    if (!window.__pdfDoc) return;
    if (window.__pdfPage < window.__pdfDoc.numPages) {
      window.__pdfPage += 1;
      await renderCurrentPage();
    }
  };
  window.__pdfPrevPage = async () => {
    if (!window.__pdfDoc) return;
    if (window.__pdfPage > 1) {
      window.__pdfPage -= 1;
      await renderCurrentPage();
    }
  };

  // bind opcional se existir no HTML
  const btnPrev = document.getElementById("btnPrevPage");
  const btnNext = document.getElementById("btnNextPage");
  if (btnPrev)
    btnPrev.onclick = () => window.__pdfPrevPage().catch(console.error);
  if (btnNext)
    btnNext.onclick = () => window.__pdfNextPage().catch(console.error);

  const pageNumInput = document.getElementById("pageNum");
  if (pageNumInput) {
    pageNumInput.onchange = () => {
      const n = Number(pageNumInput.value || "1");
      window.__pdfPage = Math.max(1, Math.min(pdf.numPages, n));
      renderCurrentPage().catch(console.error);
    };
  }

  // teclado (← →) — só quando estiver no editor
  if (!window.__pdfKeysBound) {
    window.__pdfKeysBound = true;
    window.addEventListener("keydown", (ev) => {
      if (window.PAGE !== "editor") return;
      if (!window.__pdfDoc) return;

      if (ev.key === "ArrowRight") {
        window.__pdfNextPage().catch(console.error);
      } else if (ev.key === "ArrowLeft") {
        window.__pdfPrevPage().catch(console.error);
      }
    });
  }

  // render inicial
  await renderCurrentPage();
}

function initEditor() {
  console.log("[EDITOR] init");

  const session = loadSessionSafe();
  if (!session) return setApiStatus("❌ Session inválida");

  bindEditorUI();
  loadEditorContext(session);

  fillProjectDataUIFromSession();

  const btnApply = document.getElementById("btnApplyProjectData");
  if (btnApply) {
    btnApply.onclick = async () => {
      try {
        // 1) salva os inputs na sessão
        readProjectDataUIToSession();

        // 2) reaplica fields em cima dos layers atuais (SEM reset)
        if (typeof window.__pfReapplyFieldsNow === "function") {
          window.__pfReapplyFieldsNow();
        }

        setApiStatus("✅ Dados aplicados no preview.");
      } catch (e) {
        console.error(e);
        setApiStatus("❌ " + (e?.message || String(e)));
      }
    };
  }
}

function bindEditorUI() {
  const btnSave = document.getElementById("btnSaveOverride");
  if (btnSave) {
    btnSave.onclick = async () => {
      try {
        const layers = Array.isArray(window.__editorLayers)
          ? window.__editorLayers
          : [];
        const s = getSession();
        const fieldsPatch = {
          "job.address": s.job_address || "",
          "job.zip": s.job_zip || "",
          "roof.category": s.roof_category || "",
          "roof.area_sqft": s.roof_area_sqft || "",
        };

        await saveOverrideToApi(layers, fieldsPatch);
      } catch (e) {
        setApiStatus("❌ Erro ao salvar: " + (e?.message || String(e)));
      }
    };
  }

  const btnBack = document.getElementById("btnBack");
  if (btnBack) {
    btnBack.onclick = () => {
      if (window.history.length > 1) window.history.back();
      else nav("./project.html");
    };
  }
}

function loadEditorContext(session) {
  const { company_key, city, form_key } = session;

  if (!company_key || !city) {
    setApiStatus(
      "❌ Contexto incompleto (company/city). Volte e selecione na tela Company/Project.",
    );
    return;
  }

  const companyBadge = document.getElementById("companyBadge");
  if (companyBadge) companyBadge.textContent = `Company: ${company_key}`;

  const ctxCity = document.getElementById("ctxCity");
  if (ctxCity) ctxCity.value = city;

  const allowed = Array.isArray(session.form_keys) ? session.form_keys : [];
  loadFormsByCity(city, form_key, allowed).catch((e) => {
    setApiStatus("❌ Erro ao carregar forms: " + (e?.message || String(e)));
  });
}

// ================= PATCH 1 (Editor) =================
// ✅ Agora o select do editor usa os permits selecionados no Project (session.form_keys)
async function loadFormsByCity(
  city,
  selectedFormKey = "",
  allowedFormKeys = [],
) {
  setApiStatus("Carregando forms...");

  const data = await apiCatalogForms(city);
  let forms = data.forms || [];

  // ✅ FILTRO: só mostra os permits selecionados no Project
  if (Array.isArray(allowedFormKeys) && allowedFormKeys.length) {
    const allow = new Set(allowedFormKeys);
    forms = forms.filter((f) => allow.has(f.form_key));
  }

  const sel = document.getElementById("permitSelect");
  if (!sel) return setApiStatus("❌ permitSelect não encontrado no HTML.");

  sel.innerHTML = "";
  forms.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.form_key;
    opt.textContent = f.name || f.label || f.form_key;
    sel.appendChild(opt);
  });

  // ✅ escolhe o inicial:
  // 1) o que veio da session (se existir e estiver permitido)
  // 2) senão o primeiro da lista filtrada
  const allowSet = new Set(forms.map((f) => f.form_key));
  const initialCandidate =
    selectedFormKey && allowSet.has(selectedFormKey) ? selectedFormKey : "";
  const initial = initialCandidate || forms[0]?.form_key || "";

  if (initial) {
    sel.value = initial;
    saveSession({ form_key: initial });
    await loadPermit(initial);
  } else {
    setApiStatus("⚠️ Nenhum permit selecionado para abrir no Editor.");
  }

  sel.onchange = async () => {
    // ✅ PATCH 1: reset troca de permit
    window.__pdfPage = 1;
    window.__editorLayers = []; // evita “herdar” layers do permit anterior

    saveSession({ form_key: sel.value });
    await loadPermit(sel.value);
  };

  setApiStatus("✅ Forms carregados.");
}

// ================= PATCH 2 =================
async function loadPermit(formKey) {
  const s = getSession
    ? getSession()
    : JSON.parse(localStorage.getItem("pf_session") || "{}");
  const city = s.city;
  const company_key = s.company_key;

  if (!city || !formKey) {
    setApiStatus("❌ Contexto incompleto (city/form).");
    return;
  }

  setApiStatus("Carregando permit...");

  const pdfUrl = `${API_BASE}/api/template/${encodeURIComponent(city)}/${encodeURIComponent(formKey)}/blank.pdf`;

  const fieldsUrl =
    `${API_BASE}/api/template/${encodeURIComponent(city)}/${encodeURIComponent(formKey)}` +
    `/fields.json?company_key=${encodeURIComponent(company_key || "")}`;

  const layersUrl =
    `${API_BASE}/api/template/${encodeURIComponent(city)}/${encodeURIComponent(formKey)}` +
    `/layers.json?company_key=${encodeURIComponent(company_key || "")}`;

  try {
    const [fieldsRaw, layersRaw] = await Promise.all([
      fetch(fieldsUrl, { cache: "no-store" }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
      fetch(layersUrl, { cache: "no-store" }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    ]);

    const fields = fieldsRaw.fields || fieldsRaw.data || fieldsRaw;
    const layers = layersRaw.layers || layersRaw.data || layersRaw;

    // ✅ PATCH: puxar dados da company + session
    let companyObj = {};
    if (company_key) {
      try {
        const cr = await fetch(
          `${API_BASE}/api/companies/${encodeURIComponent(company_key)}`,
          { cache: "no-store" },
        );
        if (cr.ok) {
          const cj = await cr.json();
          companyObj = cj.company || {};
        }
      } catch (e) {}
    }

    // ✅ PATCH: normalizar fields
    function normalizeFields(fieldsObj, company) {
      const F = fieldsObj || {};
      const C = company || {};
      const S =
        typeof getSession === "function"
          ? getSession()
          : JSON.parse(localStorage.getItem("pf_session") || "{}");

      const out = { ...F };

      // company.*
      out["company.name"] =
        out["company.name"] ??
        F.name ??
        F.companyName ??
        C.name ??
        S.company_name ??
        "";
      out["company.license"] =
        out["company.license"] ??
        F.license ??
        F.companyLicense ??
        C.license ??
        S.company_license ??
        "";
      out["company.qualifier_name"] =
        out["company.qualifier_name"] ??
        F.qualifier ??
        F.companyQualifier ??
        C.qualifier ??
        S.company_qualifier ??
        "";
      out["company.address"] =
        out["company.address"] ??
        F.address ??
        F.companyAddress ??
        C.address ??
        S.company_address ??
        "";
      out["company.phone"] =
        out["company.phone"] ??
        F.phone ??
        F.companyPhone ??
        C.phone ??
        S.company_phone ??
        "";
      out["company.email"] =
        out["company.email"] ??
        F.email ??
        F.companyEmail ??
        C.email ??
        S.company_email ??
        "";

      // job.*
      out["job.address"] =
        out["job.address"] ??
        F.jobAddress ??
        F.address_job ??
        S.job_address ??
        "";
      out["job.city"] = out["job.city"] ?? F.jobCity ?? "";
      out["job.state"] = out["job.state"] ?? F.jobState ?? "";
      out["job.zip"] = out["job.zip"] ?? F.jobZip ?? S.job_zip ?? "";

      // roof.*
      out["roof.category"] =
        out["roof.category"] ?? F.roofCategory ?? S.roof_category ?? "";
      out["roof.type"] = out["roof.type"] ?? F.roofType ?? "";
      out["roof.area_sqft"] =
        out["roof.area_sqft"] ??
        F.roofArea ??
        F.areaSqft ??
        S.roof_area_sqft ??
        "";

      // noa.*
      out["noa.primary.number"] =
        out["noa.primary.number"] ?? F.noaNumber ?? "";
      out["noa.primary.product"] =
        out["noa.primary.product"] ?? F.noaProduct ?? "";

      return out;
    }

    const fieldsNormalized = normalizeFields(fields, companyObj);

    // ✅ PATCH: aplicar fields em cima dos layers
    function applyFieldsToLayers(fieldsObj, layersArr) {
      const F = fieldsObj || {};
      const out = Array.isArray(layersArr) ? layersArr : [];

      for (const l of out) {
        if (!l || !l.key) continue;

        if (
          (l.type === "text" || !l.type) &&
          (l.value == null || String(l.value).trim() === "")
        ) {
          const v = F[l.key];
          if (v != null) l.value = String(v);
        }

        if (l.type === "check") {
          const v = F[l.key];
          if (v != null && String(v).trim() !== "") {
            l.checked = !!v && v !== "false" && v !== "0";
          } else if (l.checked == null) {
            l.checked = String(l.key || "").startsWith("custom.")
              ? true
              : l.checked;
          }
        }
      }
      return out;
    }

    // ✅ PATCH 1: cria layers padrão automaticamente (1x) quando aplicar dados
    function ensureStandardDataLayers(curLayers, pageNum) {
      const page = Number(pageNum || 1);
      const arr = Array.isArray(curLayers) ? curLayers : [];

      const needed = [
        { key: "job.address", type: "text" },
        { key: "job.zip", type: "text" },
        { key: "roof.category", type: "text" },
        { key: "roof.area_sqft", type: "text" },

        { key: "company.name", type: "text" },
        { key: "company.license", type: "text" },
        { key: "company.address", type: "text" },
      ];

      const hasKey = (k) => arr.some((l) => l && l.key === k);

      let x = 120;
      let y = 120;

      for (const it of needed) {
        if (hasKey(it.key)) continue;

        const l = {
          id: uid("ly"),
          type: it.type,
          key: it.key,
          page,
          x,
          y,
          font_size: 10,
          value: "",
        };

        arr.push(l);

        y += 18;
        if (y > 300) {
          y = 120;
          x += 240;
        }
      }

      return arr;
    }

    // aplica inicialmente nos layers do template
    const layersApplied = applyFieldsToLayers(
      fieldsNormalized,
      Array.isArray(layers) ? layers : [],
    );

    await renderPDFByUrl(pdfUrl);

    if (typeof window.renderFields === "function")
      window.renderFields(fieldsNormalized);

    // ✅ PATCH C: preservar estado do usuário se já existir
    const existing = Array.isArray(window.__editorLayers)
      ? window.__editorLayers
      : [];

    if (existing.length) {
      const appliedExisting = applyFieldsToLayers(fieldsNormalized, existing);

      window.__editorLayers = appliedExisting;
      if (typeof window.__editorSetLayers === "function") {
        window.__editorSetLayers(appliedExisting);
      } else if (typeof window.renderLayers === "function") {
        window.renderLayers(appliedExisting);
      }
    } else {
      if (typeof window.__editorSetLayers === "function") {
        window.__editorSetLayers(layersApplied);
      } else if (typeof window.renderLayers === "function") {
        window.renderLayers(layersApplied);
      } else {
        window.__editorLayers = Array.isArray(layersApplied)
          ? layersApplied
          : [];
      }
    }

    // ✅ PATCH A + PATCH 1.2: reaplica fields e cria layers padrão (1x)
    window.__pfReapplyFieldsNow = function () {
      try {
        const curLayers0 = Array.isArray(window.__editorLayers)
          ? window.__editorLayers
          : [];
        const pageNow = Number(window.__pdfPage || 1);

        const curLayers = ensureStandardDataLayers(curLayers0, pageNow);

        const applied = applyFieldsToLayers(fieldsNormalized, curLayers);

        window.__editorLayers = applied;

        if (typeof window.__editorSetLayers === "function") {
          window.__editorSetLayers(applied);
        } else if (typeof window.renderLayers === "function") {
          window.renderLayers(applied);
        }
      } catch (e) {
        console.error("[PF] reapplyFieldsNow failed", e);
      }
    };

    saveSession({ form_key: formKey });
    setApiStatus("✅ Permit carregado");
  } catch (e) {
    setApiStatus("❌ Erro ao carregar permit: " + (e?.message || String(e)));
  }
}

// ================= PATCH 3 =================
async function saveOverrideToApi(layers, fields = {}) {
  const s = getSession
    ? getSession()
    : JSON.parse(localStorage.getItem("pf_session") || "{}");

  // ================= PATCH — normaliza layers antes de salvar =================
  function normalizeLayersForBackend(layers) {
    const arr = Array.isArray(layers) ? layers : [];

    const scale = Number(window.__pdfScale || 1);               // ex: 1.5
    const canvasH = Number(window.__pdfCanvasHeight || 0);      // ex: viewport.height

    // helpers
    const toNum = (v, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    // converte coord do canvas (top-left, scale) -> PDF (bottom-left, scale 1.0)
    const fixXY = (x, y) => {
      const xx = toNum(x, 0) / scale;
      const yy_canvas = toNum(y, 0);
      const yy = canvasH ? ((canvasH - yy_canvas) / scale) : (yy_canvas / scale);
      return { x: xx, y: yy };
    };

    const fixY = (y) => {
      const yy_canvas = toNum(y, 0);
      return canvasH ? ((canvasH - yy_canvas) / scale) : (yy_canvas / scale);
    };

    return arr.map((l) => {
      const copy = { ...(l || {}) };

      // tipo
      const t = String(copy.type || "text");
      copy.type = t;

      // página
      copy.page = Number(copy.page || window.__pdfPage || 1);

      // ===== TEXT =====
      if (t === "text") {
        // garante value vindo de value/text/key (se você digita no "key", ele vira value)
        copy.value = String(
          copy.value ?? copy.text ?? copy.key ?? ""
        );

        // fonte
        copy.font_size = toNum(copy.font_size ?? copy.fontSize, 10);

        // coords
        const { x, y } = fixXY(copy.x, copy.y);
        copy.x = x;
        copy.y = y;

        return copy;
      }

      // ===== CHECK =====
      if (t === "check") {
        copy.checked = (copy.checked !== false); // default true
        copy.size = toNum(copy.size, 12);

        const { x, y } = fixXY(copy.x, copy.y);
        copy.x = x;
        copy.y = y;

        return copy;
      }

      // ===== LINE =====
      if (t === "line") {
        // backend usa x1,y1,x2,y2,width
        copy.width = toNum(copy.width ?? copy.thickness, 1);

        // alguns editores guardam line como x,y,length... mas seu backend desenha x1,y1,x2,y2
        // então garantimos: se tiver x1/x2, converte; se não tiver, tenta derivar de x/length
        const hasX1 = copy.x1 != null && copy.y1 != null && copy.x2 != null && copy.y2 != null;

        if (hasX1) {
          copy.x1 = toNum(copy.x1, 0) / scale;
          copy.x2 = toNum(copy.x2, 0) / scale;
          copy.y1 = fixY(copy.y1);
          copy.y2 = fixY(copy.y2);
          return copy;
        }

        // fallback: derive de x,y,length (horizontal)
        const x0 = toNum(copy.x, 0);
        const y0 = toNum(copy.y, 0);
        const len = toNum(copy.length, 160);

        copy.x1 = x0 / scale;
        copy.x2 = (x0 + len) / scale;
        copy.y1 = fixY(y0);
        copy.y2 = fixY(y0);

        return copy;
      }

      // tipo desconhecido: retorna do jeito que está
      return copy;
    });
  }

  // ✅ PATCH: normaliza layers antes de salvar
  const fixedLayers = normalizeLayersForBackend(layers || []);

  const payload = {
    company_key: s.company_key,
    city: s.city,
    form_key: s.form_key,
    fields: fields || {},
    layers: fixedLayers,
  };

  const r = await fetch(`${API_BASE}/api/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) throw new Error(await r.text());
  setApiStatus("✅ Override salvo.");
  return r.json();
}


/* ==========================================================
   ✅ EDITOR ENHANCEMENTS:
   - Check com “caixa” igual ao texto + ✅
   - Layers list em “cards”
   - Drag & drop correto
   ✅ PATCH 2 — Paginação correta (overlay só mostra layers da página atual)
   ✅ PATCH 2b — Layers novas nascem na página atual (page = __pdfPage)
   ========================================================== */
(function attachEditorEnhancements() {
  if (window.PAGE !== "editor") return;

  const editorState = {
    layers: [],
    selectedId: null,
    drag: { on: false, id: null, dx: 0, dy: 0 },
  };

  function newId() {
    return "L" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function normalizeLayer(raw) {
    const l = { ...(raw || {}) };
    if (!l.id) l.id = newId();
    if (!l.type) l.type = "text";
    if (typeof l.page !== "number") l.page = 1;
    if (typeof l.x !== "number") l.x = 120;
    if (typeof l.y !== "number") l.y = 120;

    if (l.type === "text") {
      if (typeof l.font_size !== "number") l.font_size = 10;
      if (!l.key) l.key = "custom.text";
      if (typeof l.value !== "string") l.value = "";
    }

    if (l.type === "check") {
      if (typeof l.size !== "number") l.size = 14;
      if (!l.key) l.key = "custom.check";
    }

    if (l.type === "line") {
      if (typeof l.length !== "number") l.length = 160;
      if (typeof l.thickness !== "number") l.thickness = 2;
      if (!l.key) l.key = "custom.line";
    }

    return l;
  }

  function setLayersFromAny(input) {
    const arr = Array.isArray(input)
      ? input
      : input?.layers || input?.data || [];
    editorState.layers = (Array.isArray(arr) ? arr : []).map(normalizeLayer);
    editorState.selectedId = editorState.layers[0]?.id || null;
    window.__editorLayers = editorState.layers;
    renderLayersUI();
  }

  window.__editorSetLayers = setLayersFromAny;

  // ================== ACTION PRESETS (front only) ==================
  function actionsKey(city, form_key) {
    return `pf_actions::${city}::${form_key}`;
  }

  function loadActionsList(city, form_key) {
    try {
      return JSON.parse(
        localStorage.getItem(actionsKey(city, form_key)) || "[]",
      );
    } catch {
      return [];
    }
  }

  function saveActionsList(city, form_key, arr) {
    localStorage.setItem(actionsKey(city, form_key), JSON.stringify(arr || []));
  }

  function refreshActionUI(city, form_key) {
    const sel = document.getElementById("actionSelect");
    if (!sel) return;

    const list = loadActionsList(city, form_key);
    sel.innerHTML = `<option value="">— selecione —</option>`;
    for (const a of list) {
      const opt = document.createElement("option");
      opt.value = a.name;
      opt.textContent = a.name;
      sel.appendChild(opt);
    }
  }

  function getCurrentCityForm() {
    const s =
      typeof getSession === "function"
        ? getSession()
        : JSON.parse(localStorage.getItem("pf_session") || "{}");
    return { city: s.city, form_key: s.form_key };
  }

  function getCustomLayersOnly(allLayers) {
    const arr = Array.isArray(allLayers) ? allLayers : [];
    return arr.filter((l) => l?.key && String(l.key).startsWith("custom."));
  }

  function applyActionLayers(actionLayers) {
    // adiciona layers da ação aos layers atuais
    if (!Array.isArray(window.__editorLayers)) window.__editorLayers = [];
    const base = window.__editorLayers;

    // clona e cria IDs novos (pra não duplicar id)
    const cloned = (actionLayers || []).map((l) => {
      const copy = { ...l };
      copy.id =
        "A" + Math.random().toString(16).slice(2) + Date.now().toString(16);
      copy.page = Number(window.__pdfPage || 1); // ✅ PATCH
      return copy;
    });

    window.__editorLayers = base.concat(cloned);
    editorState.layers = window.__editorLayers.map(normalizeLayer);

    // reflete no overlay
    if (typeof window.__editorSetLayers === "function") {
      window.__editorSetLayers(editorState.layers);
    }
  }

  function bindActionButtons() {
    const btnSave = document.getElementById("btnSaveAction");
    const btnApply = document.getElementById("btnApplyAction");
    const input = document.getElementById("actionName");
    const sel = document.getElementById("actionSelect");

    const { city, form_key } = getCurrentCityForm();
    if (!city || !form_key) return;

    refreshActionUI(city, form_key);

    if (btnSave) {
      btnSave.onclick = () => {
        const name = (input?.value || "").trim();
        if (!name) return setApiStatus("❌ Dê um nome para a ação.");

        const custom = getCustomLayersOnly(window.__editorLayers || []);
        if (!custom.length)
          return setApiStatus("❌ Nenhum custom layer para salvar (custom.*).");

        const list = loadActionsList(city, form_key);
        const next = list
          .filter((x) => x.name !== name)
          .concat([{ name, layers: custom }]);
        saveActionsList(city, form_key, next);
        refreshActionUI(city, form_key);

        if (sel) sel.value = name;
        setApiStatus("✅ Ação salva: " + name);
      };
    }

    if (btnApply) {
      btnApply.onclick = () => {
        const picked = sel?.value || "";
        if (!picked) return setApiStatus("❌ Selecione uma ação.");
        const list = loadActionsList(city, form_key);
        const found = list.find((x) => x.name === picked);
        if (!found) return setApiStatus("❌ Ação não encontrada.");

        applyActionLayers(found.layers || []);
        setApiStatus("✅ Ação aplicada: " + picked);
      };
    }
  }

  // ✅ PATCH: download do packet (zip) via backend usando company/city/forms
  function bindDownloadPacket() {
    const btn = document.getElementById("btnDownloadPacket");
    if (!btn) return;

    btn.onclick = async () => {
      try {
        const s =
          typeof getSession === "function"
            ? getSession()
            : JSON.parse(localStorage.getItem("pf_session") || "{}");

        // ✅ PATCH 2.1 — validações por company/city/forms
        const company_key = (s.company_key || "").trim();
        const city = (s.city || "").trim();
        const form_keys = Array.isArray(s.form_keys) ? s.form_keys : [];

        if (!company_key)
          return setApiStatus(
            "❌ company_key vazio (selecione a empresa primeiro).",
          );
        if (!city) return setApiStatus("❌ city vazio (selecione a city).");
        if (!form_keys.length)
          return setApiStatus("❌ Nenhum permit selecionado (form_keys).");

        setApiStatus("⏳ Gerando ZIP...");

        // ✅ PATCH 2.2 — endpoint /api/download-company
        const r = await fetch(`${window.API_BASE}/api/download-company`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_key,
            city,
            form_keys,
            job_key: s.job_key || null,
            owner_key: s.owner_key || null,
            roof_key: s.roof_key || null,
          }),
        });

        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          throw new Error(`Falha no download: ${r.status} ${txt}`);
        }

        const blob = await r.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        // ✅ PATCH — nome do arquivo
        a.download = `${city}_${s.project_name || "packet"}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);
        setApiStatus("✅ Download iniciado.");
      } catch (e) {
        console.error(e);
        setApiStatus("❌ " + (e?.message || String(e)));
      }
    };
  }

  window.addEventListener("DOMContentLoaded", () => {
    try {
      bindDownloadPacket();
    } catch (e) {}
  });

  // ✅ ativa os botões/combos de presets quando o editor abrir
  try {
    bindActionButtons();
  } catch (e) {}

  function getSelected() {
    return (
      editorState.layers.find((x) => x.id === editorState.selectedId) || null
    );
  }

  function selectLayer(id) {
    editorState.selectedId = id;
    renderLayersUI();
  }

  function syncPanel(forceHideIfNone) {
    const box = document.getElementById("layerEditor");
    const l = getSelected();
    if (!box) return;

    if (!l) {
      box.style.display = "none";
      return;
    }

    box.style.display = "block";

    const elKey = document.getElementById("layerKey");
    const elX = document.getElementById("layerX");
    const elY = document.getElementById("layerY");
    const elPage = document.getElementById("layerPage");
    const elFont = document.getElementById("layerFont");

    if (elKey) elKey.value = l.key || "";
    if (elX) elX.value = Number(l.x || 0);
    if (elY) elY.value = Number(l.y || 0);
    if (elPage) elPage.value = Number(l.page || 1);

    if (elFont) {
      if (l.type === "check") elFont.value = Number(l.size || 14);
      else if (l.type === "line") elFont.value = Number(l.thickness || 2);
      else elFont.value = Number(l.font_size || 10);
    }
  }

  function bindPanel() {
    const ids = ["layerKey", "layerX", "layerY", "layerPage", "layerFont"];
    ids.forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;

      input.addEventListener("input", () => {
        const l = getSelected();
        if (!l) return;

        if (id === "layerKey") l.key = input.value;
        if (id === "layerX") l.x = Number(input.value);
        if (id === "layerY") l.y = Number(input.value);
        if (id === "layerPage") l.page = Number(input.value);

        if (id === "layerFont") {
          if (l.type === "check") l.size = Number(input.value);
          else if (l.type === "line") l.thickness = Number(input.value);
          else l.font_size = Number(input.value);
        }

        window.__editorLayers = editorState.layers;
        renderLayersUI();
      });
    });

    const btnDel = document.getElementById("btnDeleteLayer");
    if (btnDel) {
      btnDel.onclick = () => {
        const l = getSelected();
        if (!l) return;
        editorState.layers = editorState.layers.filter((x) => x.id !== l.id);
        editorState.selectedId = editorState.layers[0]?.id || null;
        window.__editorLayers = editorState.layers;
        renderLayersUI();
      };
    }
  }

  function renderLayersUI() {
    const list = document.getElementById("layersList");
    const overlay = document.getElementById("overlay");

    // ✅ PATCH 2 — página atual do PDF (fallback = 1)
    const currentPage = Number(window.__pdfPage || 1);

    if (list) list.innerHTML = "";
    if (overlay) overlay.innerHTML = "";

    (editorState.layers || []).forEach((l) => {
      // LIST (✅ cards) — pode mostrar todas (ok)
      if (list) {
        const item = document.createElement("div");
        item.className =
          "listItem" + (l.id === editorState.selectedId ? " active" : "");
        item.innerHTML = `
          <div style="font-weight:600">${l.type} • ${l.key}</div>
          <div style="opacity:.7; font-size:12px">x:${Math.round(l.x)} y:${Math.round(
            l.y,
          )} p:${l.page}</div>
        `;
        item.style.padding = "10px";
        item.style.border = "1px solid rgba(15,23,42,.12)";
        item.style.borderRadius = "10px";
        item.style.marginBottom = "8px";
        item.style.background =
          l.id === editorState.selectedId
            ? "rgba(37,99,235,.08)"
            : "rgba(255,255,255,.6)";
        item.onclick = () => selectLayer(l.id);
        list.appendChild(item);
      }

      // OVERLAY (✅ só na página atual)
      if (overlay && Number(l.page || 1) === currentPage) {
        const node = document.createElement("div");
        node.className =
          "layerNode" + (l.id === editorState.selectedId ? " active" : "");
        node.dataset.id = l.id;

        node.style.position = "absolute";
        node.style.left = `${l.x}px`;
        node.style.top = `${l.y}px`;
        node.style.cursor = "move";
        node.style.userSelect = "none";
        node.style.touchAction = "none";

        if (l.type === "text") {
          node.textContent = l.value && l.value.trim() ? l.value : l.key;
          node.style.fontSize = `${l.font_size}px`;
          node.style.padding = "2px 4px";
          node.style.background = "rgba(255,255,255,0.35)";
          node.style.border = "1px dashed rgba(0,0,0,0.35)";
          node.style.borderRadius = "4px";
        }

        if (l.type === "check") {
          const isOn = !!l.checked;

          node.textContent = isOn ? "✓" : "";
          node.style.width = `${l.size}px`;
          node.style.height = `${l.size}px`;
          node.style.display = "flex";
          node.style.alignItems = "center";
          node.style.justifyContent = "center";
          node.style.fontSize = `${Math.max(10, l.size - 2)}px`;
          node.style.fontWeight = "800";

          node.style.padding = "2px 4px";
          node.style.background = "rgba(255,255,255,0.35)";
          node.style.border = "1px dashed rgba(0,0,0,0.45)";
          node.style.borderRadius = "4px";
          node.style.boxSizing = "border-box";
          node.style.color = "rgba(0,0,0,0.85)";
        }

        if (l.type === "line") {
          node.textContent = "";
          node.style.width = `${l.length}px`;
          node.style.height = "0px";
          node.style.borderTop = `${l.thickness}px solid rgba(0,0,0,0.75)`;
        }

        node.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();

          editorState.selectedId = l.id;
          syncPanel(false);

          const overlayRect = overlay.getBoundingClientRect();
          editorState.drag.on = true;
          editorState.drag.id = l.id;

          editorState.drag.dx = ev.clientX - overlayRect.left - l.x;
          editorState.drag.dy = ev.clientY - overlayRect.top - l.y;

          try {
            node.setPointerCapture?.(ev.pointerId);
          } catch (e) {}

          renderLayersUI();
        });

        overlay.appendChild(node);
      }
    });

    // DRAG global
    if (overlay) {
      overlay.onpointermove = (ev) => {
        if (!editorState.drag.on) return;

        const id = editorState.drag.id;
        const l = editorState.layers.find((x) => x.id === id);
        if (!l) return;

        const r = overlay.getBoundingClientRect();
        l.x = ev.clientX - r.left - editorState.drag.dx;
        l.y = ev.clientY - r.top - editorState.drag.dy;

        const node = overlay.querySelector(`.layerNode[data-id="${id}"]`);
        if (node) {
          node.style.left = `${l.x}px`;
          node.style.top = `${l.y}px`;
        }

        window.__editorLayers = editorState.layers;
        syncPanel(false);
      };

      const stop = () => {
        editorState.drag.on = false;
        editorState.drag.id = null;
      };
      overlay.onpointerup = stop;
      overlay.onpointercancel = stop;
      overlay.onmouseleave = stop;
    }

    syncPanel(true);
  }

  // ✅ PATCH 2b — novas layers nascem na página atual
  function makeTextLayer() {
    return normalizeLayer({
      type: "text",
      key: "custom.text",
      value: "",
      page: Number(window.__pdfPage || 1),
      x: 120,
      y: 120,
      font_size: 10,
    });
  }

  function makeCheckLayer() {
    return normalizeLayer({
      type: "check",
      key: "custom.check",
      page: Number(window.__pdfPage || 1),
      x: 120,
      y: 120,
      size: 14,
      checked: true, // ✅ PATCH: default ON
    });
  }

  function makeLineLayer() {
    return normalizeLayer({
      type: "line",
      key: "custom.line",
      page: Number(window.__pdfPage || 1),
      x: 120,
      y: 120,
      length: 160,
      thickness: 2,
    });
  }

  function bindAddButtons() {
    const btnText = document.getElementById("btnAddText");
    const btnCheck = document.getElementById("btnAddCheck");
    const btnLine = document.getElementById("btnAddLine");

    if (btnText)
      btnText.onclick = () => {
        const l = makeTextLayer();
        editorState.layers.push(l);
        editorState.selectedId = l.id;
        window.__editorLayers = editorState.layers;
        renderLayersUI();
        setApiStatus("✅ Texto criado (arraste e salve)");
      };

    if (btnCheck)
      btnCheck.onclick = () => {
        const l = makeCheckLayer();
        editorState.layers.push(l);
        editorState.selectedId = l.id;
        window.__editorLayers = editorState.layers;
        renderLayersUI();
        setApiStatus("✅ Check criado");
      };

    if (btnLine)
      btnLine.onclick = () => {
        const l = makeLineLayer();
        editorState.layers.push(l);
        editorState.selectedId = l.id;
        window.__editorLayers = editorState.layers;
        renderLayersUI();
        setApiStatus("✅ Linha criada");
      };
  }

  bindAddButtons();
  // ✅ PATCH: reativar edição (X/Y/Fonte/Key) + Excluir
  try {
    bindPanel();
  } catch (e) {
    console.error("[EDITOR] bindPanel falhou", e);
  }
})();
