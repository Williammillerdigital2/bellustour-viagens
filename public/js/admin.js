// ============================================================================
// BELLUSTOUR — MOBILE-FIRST INTUITIVE ADMIN CONTROLLER
// Includes iPhone/Android Photo Compression -> Cloudflare KV /api/image Upload
// and 1-Click Rollback Safety System.
// ============================================================================

(function () {
  "use strict";

  const STORAGE_KEY = "bellustour_site_config_v1";
  const PREV_STORAGE_KEY = "bellustour_site_config_prev_v1";

  let config = JSON.parse(JSON.stringify(window.BELLUSTOUR_DEFAULT_CONFIG));
  let lastCommittedSnapshot = JSON.stringify(config);
  let activeAdminFilter = "all";

  const CAT_LABELS = {
    cruzeiros: "🛳️ Cruzeiros",
    nacionais: "🇧🇷 Nacionais",
    internacionais: "🌍 Internacionais",
    promocionais: "🔥 Promocionais",
    "ultimas-vagas": "⏳ Últimas Vagas"
  };

  // --------------------------------------------------------------------------
  // 1. Load Configuration
  // --------------------------------------------------------------------------
  async function loadConfig() {
    try {
      const localRaw = localStorage.getItem(STORAGE_KEY);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (parsed && parsed.packages) config = parsed;
      }
    } catch (e) {
      console.warn(e);
    }

    if (location.protocol.startsWith("http")) {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (res.ok) {
          const remote = await res.json();
          if (remote && remote.packages) {
            config = remote;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
          }
        }
      } catch (_) {}
    }
    lastCommittedSnapshot = JSON.stringify(config);
  }

  function populateFields() {
    const b = config.brand || {};
    const p = config.popup || {};

    setVal("adm-whatsapp", b.whatsappNumber || "");
    setVal("adm-header-btn-text", b.headerButtonText || "Fale Conosco");
    setVal("adm-header-btn-wa", b.headerButtonWhatsapp || b.whatsappNumber || "");
    setVal("adm-logo-mode", b.logoMode || "refined");
    setVal("adm-brand-name", b.name || "Bellustour");
    setVal("adm-tagline", b.tagline || "");
    setVal("adm-hero-badge", b.heroBadge || "");
    setVal("adm-hero-title", b.heroTitle || "");
    setVal("adm-email", b.email || "");
    setVal("adm-cnpj", b.cnpj || "");
    setVal("adm-address", b.address || "");

    setVal("adm-pop-title", p.welcomeTitle || "");
    setVal("adm-pop-intro", p.welcomeIntro || "");
    setVal("adm-pop-pitch", p.welcomePitch || "");
    setVal("adm-pop-santos", p.santosRuleText || "");
    setVal("adm-pop-other", p.otherPortsRuleText || "");
    setVal("adm-pop-ports", (p.ports || []).join("\n"));
    setVal("adm-pop-btn", p.buttonText || "Cotação");

    renderCategoriesList();
    renderPackagesList();
  }

  function collectFields() {
    config.brand = config.brand || {};
    config.brand.whatsappNumber = getVal("adm-whatsapp").trim();
    config.brand.headerButtonText =
      getVal("adm-header-btn-text").trim() || "Fale Conosco";
    config.brand.headerButtonWhatsapp =
      getVal("adm-header-btn-wa").trim() || config.brand.whatsappNumber;
    config.brand.logoMode = getVal("adm-logo-mode");
    config.brand.name = getVal("adm-brand-name").trim() || "Bellustour";
    config.brand.tagline = getVal("adm-tagline").trim();
    config.brand.heroBadge = getVal("adm-hero-badge").trim();
    config.brand.heroTitle = getVal("adm-hero-title").trim();
    config.brand.email = getVal("adm-email").trim();
    config.brand.cnpj = getVal("adm-cnpj").trim();
    config.brand.address = getVal("adm-address").trim();

    config.popup = config.popup || {};
    config.popup.welcomeTitle = getVal("adm-pop-title").trim();
    config.popup.welcomeIntro = getVal("adm-pop-intro").trim();
    config.popup.welcomePitch = getVal("adm-pop-pitch").trim();
    config.popup.santosRuleText = getVal("adm-pop-santos").trim();
    config.popup.otherPortsRuleText = getVal("adm-pop-other").trim();
    config.popup.ports = getVal("adm-pop-ports")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    config.popup.buttonText = getVal("adm-pop-btn").trim() || "Cotação";
  }

  async function saveAllConfig(msg, isRollback = false) {
    if (!isRollback) {
      const prevRaw = localStorage.getItem(STORAGE_KEY) || lastCommittedSnapshot;
      if (prevRaw) {
        localStorage.setItem(PREV_STORAGE_KEY, prevRaw);
      }
      collectFields();
    }

    const serialized = JSON.stringify(config);
    localStorage.setItem(STORAGE_KEY, serialized);
    lastCommittedSnapshot = serialized;
    updateRollbackStatusUI();

    if (location.protocol.startsWith("http")) {
      try {
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: serialized
        });
      } catch (_) {}
    }

    showToast(msg || "✓ Alterações salvas e publicadas no site!");
  }

  function updateRollbackStatusUI() {
    const statusEl = document.getElementById("rollback-status-text");
    const btnEl = document.getElementById("adm-rollback-btn");
    const hasPrev = Boolean(localStorage.getItem(PREV_STORAGE_KEY));
    if (statusEl) {
      statusEl.textContent = hasPrev
        ? "✓ Há um ponto de restauração pronto para desfazer sua última alteração se precisar."
        : "Assim que você salvar qualquer modificação, o botão acima poderá desfazer a alteração.";
    }
    if (btnEl) {
      btnEl.style.opacity = hasPrev ? "1" : "0.75";
    }
  }

  async function performRollback() {
    let prevRaw = localStorage.getItem(PREV_STORAGE_KEY);

    if (!prevRaw && location.protocol.startsWith("http")) {
      try {
        const res = await fetch("/api/config?rollback=1", { cache: "no-store" });
        if (res.ok) {
          const prevData = await res.json();
          if (prevData && prevData.packages) {
            prevRaw = JSON.stringify(prevData);
          }
        }
      } catch (_) {}
    }

    if (!prevRaw) {
      showToast("⚠️ Ainda não há modificação anterior para desfazer.");
      return;
    }

    try {
      const restored = JSON.parse(prevRaw);
      if (restored && restored.packages && restored.brand) {
        const currentSnap = JSON.stringify(config);
        config = restored;
        localStorage.setItem(PREV_STORAGE_KEY, currentSnap);
        populateFields();
        await saveAllConfig(
          "⏪ Última modificação desfeita com sucesso!",
          true
        );
      }
    } catch (e) {
      console.error("Rollback error:", e);
    }
  }

  // --------------------------------------------------------------------------
  // 2. Mobile Photo Compression (iPhone Safari + Android) -> /api/image KV Upload
  // --------------------------------------------------------------------------
  function compressAndUploadPhoto(file, prefixId, onSuccess) {
    if (!file) return;
    showToast("⏳ Otimizando foto do celular...");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const maxW = 1280;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Try WebP first; if older iPhone Safari falls back to PNG, use JPEG 0.84 so file stays ~90 KB
        let compressedDataUrl = canvas.toDataURL("image/webp", 0.84);
        if (!compressedDataUrl.startsWith("data:image/webp")) {
          compressedDataUrl = canvas.toDataURL("image/jpeg", 0.84);
        }

        // Upload to /api/image (Cloudflare Free KV or local disk) so site-config.json stays tiny (~5KB)
        if (location.protocol.startsWith("http")) {
          try {
            const res = await fetch("/api/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: prefixId || "viagem",
                dataUrl: compressedDataUrl
              })
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.url) {
                onSuccess(data.url);
                return;
              }
            }
          } catch (_) {}
        }

        // Offline fallback
        onSuccess(compressedDataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // --------------------------------------------------------------------------
  // 3. Render 5 Carousel Category Cover Cards (Tab 2)
  // --------------------------------------------------------------------------
  function renderCategoriesList() {
    const listEl = document.getElementById("admin-cat-list");
    if (!listEl) return;

    const cats = config.categories || [];
    listEl.innerHTML = cats
      .map(
        (cat, idx) => `
        <div class="admin-pkg-item" style="grid-template-columns: 120px 1fr;">
          <img src="${escapeAttr(cat.image || "")}" alt="${escapeAttr(cat.name)}" style="width: 120px; height: 92px;" />
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="form-row-2">
              <div class="form-group">
                <label>Nome do Cartão #${idx + 1}</label>
                <input type="text" class="form-control js-cat-field" data-idx="${idx}" data-field="name" value="${escapeAttr(cat.name || "")}" />
              </div>
              <div class="form-group">
                <label>Chamada de Preço</label>
                <input type="text" class="form-control js-cat-field" data-idx="${idx}" data-field="priceFrom" value="${escapeAttr(cat.priceFrom || "")}" />
              </div>
            </div>
            <div class="form-group">
              <label>Frase explicativa abaixo do título</label>
              <input type="text" class="form-control js-cat-field" data-idx="${idx}" data-field="subtitle" value="${escapeAttr(cat.subtitle || "")}" />
            </div>
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <label class="mobile-file-label" style="padding: 9px 15px; font-size: 0.8rem;">
                <span>📱 Trocar Foto de Capa pelo Celular</span>
                <input type="file" accept="image/*" class="js-cat-file" data-idx="${idx}" />
              </label>
              <input type="text" class="form-control js-cat-field" data-idx="${idx}" data-field="image" value="${escapeAttr(cat.image || "")}" style="flex: 1; min-width: 180px; font-size: 0.78rem;" placeholder="Ou link da foto" />
            </div>
          </div>
        </div>
      `
      )
      .join("");

    listEl.querySelectorAll(".js-cat-field").forEach((inp) => {
      inp.addEventListener("input", () => {
        const idx = Number(inp.getAttribute("data-idx"));
        const field = inp.getAttribute("data-field");
        if (config.categories[idx]) {
          config.categories[idx][field] = inp.value;
        }
      });
    });

    listEl.querySelectorAll(".js-cat-file").forEach((fileInp) => {
      fileInp.addEventListener("change", (e) => {
        const idx = Number(fileInp.getAttribute("data-idx"));
        const file = e.target.files && e.target.files[0];
        if (!file || !config.categories[idx]) return;

        compressAndUploadPhoto(
          file,
          `capa_${config.categories[idx].id}`,
          (uploadedUrl) => {
            config.categories[idx].image = uploadedUrl;
            renderCategoriesList();
            saveAllConfig("🖼️ Foto de capa atualizada e salva!");
          }
        );
      });
    });
  }

  // --------------------------------------------------------------------------
  // 4. Render Packages List & Friendly Editor (Tab 1)
  // --------------------------------------------------------------------------
  function renderPackagesList() {
    const listEl = document.getElementById("admin-pkg-list");
    if (!listEl) return;

    const allPkgs = config.packages || [];
    const filtered =
      activeAdminFilter === "all"
        ? allPkgs
        : allPkgs.filter(
            (p) =>
              p.category === activeAdminFilter ||
              (Array.isArray(p.alsoIn) && p.alsoIn.includes(activeAdminFilter))
          );

    listEl.innerHTML = filtered
      .map((pkg) => {
        const catLabel = CAT_LABELS[pkg.category] || pkg.category;
        return `
          <div class="admin-pkg-item">
            <img src="${escapeAttr(pkg.image)}" alt="${escapeAttr(pkg.title)}" />
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="badge-tag badge-gold" style="font-size: 0.65rem; padding: 3px 9px;">${escapeHtml(catLabel)}</span>
                <span style="font-size: 0.76rem; color: var(--ocean-bright); font-weight: 700;">📍 ${escapeHtml(pkg.port)} • ⏳ ${escapeHtml(pkg.duration)}</span>
              </div>
              <h4 style="font-size: 1.04rem; font-weight: 800; margin-top: 4px;">${escapeHtml(pkg.title)}</h4>
              <p style="font-size: 0.84rem; color: var(--gold-bright); font-weight: 700;">${escapeHtml(pkg.priceInstallment)} <span style="color: var(--ink-muted); font-weight: 400;">(${escapeHtml(pkg.priceTotal || "")})</span></p>
            </div>
            <div class="admin-actions-row">
              <button type="button" class="btn btn-glass btn-sm js-edit-pkg" data-id="${escapeAttr(pkg.id)}">✏️ Editar</button>
              <button type="button" class="btn btn-danger btn-sm js-del-pkg" data-id="${escapeAttr(pkg.id)}">🗑️ Apagar</button>
            </div>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll(".js-edit-pkg").forEach((btn) => {
      btn.addEventListener("click", () =>
        openPkgEditor(btn.getAttribute("data-id"))
      );
    });

    listEl.querySelectorAll(".js-del-pkg").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        config.packages = (config.packages || []).filter((p) => p.id !== id);
        renderPackagesList();
        saveAllConfig("🗑️ Viagem apagada! (Você pode desfazer na aba 4 se quiser)");
      });
    });
  }

  function openPkgEditor(pkgId) {
    const box = document.getElementById("pkg-editor-box");
    const heading = document.getElementById("pkg-editor-heading");
    const previewImg = document.getElementById("edit-pkg-preview");
    const statusText = document.getElementById("edit-pkg-upload-status");
    if (!box) return;

    const existing = (config.packages || []).find((p) => p.id === pkgId);
    if (existing) {
      heading.textContent = `✏️ Editando: ${existing.title}`;
      setVal("edit-pkg-id", existing.id);
      setVal("edit-pkg-title", existing.title || "");
      setVal("edit-pkg-subtitle", existing.subtitle || "");
      setVal("edit-pkg-category", existing.category || "cruzeiros");
      setVal("edit-pkg-also", (existing.alsoIn && existing.alsoIn[0]) || "");
      setVal("edit-pkg-port", existing.port || "Santos - SP");
      setVal("edit-pkg-duration", existing.duration || "7 / 8 dias");
      setVal("edit-pkg-price", existing.priceInstallment || "");
      setVal("edit-pkg-total", existing.priceTotal || "");
      setVal("edit-pkg-ship", existing.shipOrHotel || "");
      setVal("edit-pkg-badge", existing.badge || "DESTAQUE");
      setVal("edit-pkg-route", existing.route || "");
      setVal("edit-pkg-urgency", existing.urgencyTag || "");
      setVal("edit-pkg-image", existing.image || "");
      setVal("edit-pkg-highlights", (existing.highlights || []).join("\n"));
      if (previewImg) previewImg.src = existing.image || "assets/logo.jpeg";
    } else {
      heading.textContent = "✨ Adicionar Nova Viagem ou Cruzeiro";
      const defaultPhoto =
        "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1200&q=85";
      setVal("edit-pkg-id", "");
      setVal("edit-pkg-title", "");
      setVal("edit-pkg-subtitle", "");
      setVal(
        "edit-pkg-category",
        activeAdminFilter === "all" ? "cruzeiros" : activeAdminFilter
      );
      setVal("edit-pkg-also", "");
      setVal("edit-pkg-port", "Santos - SP");
      setVal("edit-pkg-duration", "7 / 8 dias");
      setVal("edit-pkg-price", "12x de R$ 299");
      setVal("edit-pkg-total", "por pessoa + taxas");
      setVal("edit-pkg-ship", "MSC / Costa Cruzeiros");
      setVal("edit-pkg-badge", "DESTAQUE");
      setVal("edit-pkg-route", "Santos • Búzios • Ilhabela • Santos");
      setVal("edit-pkg-urgency", "Vagas limitadas");
      setVal("edit-pkg-image", defaultPhoto);
      setVal("edit-pkg-highlights", "");
      if (previewImg) previewImg.src = defaultPhoto;
    }

    if (statusText) {
      statusText.textContent =
        "Toque no botão azul acima para escolher uma foto da galeria do seu celular.";
    }

    box.style.display = "block";
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function applyPkgEditor() {
    const idRaw = getVal("edit-pkg-id").trim();
    const title = getVal("edit-pkg-title").trim() || "Nova Viagem Bellustour";
    const id = idRaw || "pkg-" + Date.now();
    const alsoVal = getVal("edit-pkg-also");

    const pkgObj = {
      id,
      title,
      subtitle: getVal("edit-pkg-subtitle").trim(),
      category: getVal("edit-pkg-category") || "cruzeiros",
      alsoIn: alsoVal ? [alsoVal] : [],
      featured: true,
      port: getVal("edit-pkg-port").trim() || "Santos - SP",
      duration: getVal("edit-pkg-duration").trim() || "7 / 8 dias",
      priceInstallment: getVal("edit-pkg-price").trim() || "Consulte",
      priceTotal: getVal("edit-pkg-total").trim(),
      shipOrHotel: getVal("edit-pkg-ship").trim() || "Bellustour",
      badge: getVal("edit-pkg-badge").trim() || "DESTAQUE",
      route: getVal("edit-pkg-route").trim(),
      urgencyTag: getVal("edit-pkg-urgency").trim(),
      image:
        getVal("edit-pkg-image").trim() ||
        "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1200&q=85"
    };

    const idx = (config.packages || []).findIndex((p) => p.id === id);
    if (idx >= 0) {
      config.packages[idx] = pkgObj;
    } else {
      config.packages.unshift(pkgObj);
    }

    document.getElementById("pkg-editor-box").style.display = "none";
    renderPackagesList();
    saveAllConfig("✓ Viagem salva e publicada no site!");
  }

  // --------------------------------------------------------------------------
  // 5. UI Navigation & Events
  // --------------------------------------------------------------------------
  function setupEvents() {
    // Sidebar tab switch
    document.querySelectorAll(".admin-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-tab");
        document
          .querySelectorAll(".admin-nav-btn")
          .forEach((b) => b.classList.remove("active"));
        document
          .querySelectorAll(".admin-panel-card")
          .forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(target)?.classList.add("active");
      });
    });

    // Category filter pills inside Tab 1
    document
      .querySelectorAll("#admin-pkg-filter-pills .admin-filter-pill")
      .forEach((pill) => {
        pill.addEventListener("click", () => {
          activeAdminFilter = pill.getAttribute("data-filter") || "all";
          document
            .querySelectorAll("#admin-pkg-filter-pills .admin-filter-pill")
            .forEach((p) => p.classList.remove("active"));
          pill.classList.add("active");
          renderPackagesList();
        });
      });

    // Top & Mobile Sticky Save Buttons
    document
      .getElementById("admin-save-all-btn")
      ?.addEventListener("click", () => saveAllConfig());
    document
      .getElementById("admin-mobile-save-btn")
      ?.addEventListener("click", () => saveAllConfig());

    document
      .getElementById("adm-new-pkg-btn")
      ?.addEventListener("click", () => openPkgEditor(null));

    document.getElementById("pkg-cancel-btn")?.addEventListener("click", () => {
      document.getElementById("pkg-editor-box").style.display = "none";
    });

    document
      .getElementById("pkg-apply-btn")
      ?.addEventListener("click", applyPkgEditor);

    // Sync manual image URL input with thumbnail preview
    document
      .getElementById("edit-pkg-image")
      ?.addEventListener("input", (e) => {
        const preview = document.getElementById("edit-pkg-preview");
        if (preview && e.target.value) preview.src = e.target.value;
      });

    // Package photo upload from phone gallery -> /api/image
    document
      .getElementById("edit-pkg-file")
      ?.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        compressAndUploadPhoto(file, "pacote", (uploadedUrl) => {
          setVal("edit-pkg-image", uploadedUrl);
          const preview = document.getElementById("edit-pkg-preview");
          if (preview) preview.src = uploadedUrl;
          const statusText = document.getElementById("edit-pkg-upload-status");
          if (statusText) {
            statusText.textContent =
              "✓ Foto carregada e otimizada com sucesso! Agora toque em Salvar esta Viagem.";
            statusText.style.color = "#34d399";
          }
          showToast("📸 Foto do celular otimizada e pronta!");
        });
      });

    // Custom Logo upload from phone gallery -> /api/image
    document
      .getElementById("adm-logo-upload")
      ?.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        compressAndUploadPhoto(file, "logo", (uploadedUrl) => {
          config.brand.logoUrl = uploadedUrl;
          config.brand.logoMode = "custom";
          setVal("adm-logo-mode", "custom");
          saveAllConfig("🎨 Nova logo enviada e aplicada no site!");
        });
      });

    // Export Backup JSON
    document
      .getElementById("adm-export-json-btn")
      ?.addEventListener("click", () => {
        collectFields();
        const blob = new Blob([JSON.stringify(config, null, 2)], {
          type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "site-config.json";
        a.click();
        URL.revokeObjectURL(url);
      });

    // Rollback to last modification
    document
      .getElementById("adm-rollback-btn")
      ?.addEventListener("click", () => {
        performRollback();
      });

    updateRollbackStatusUI();
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
  }

  function showToast(text) {
    const t = document.getElementById("admin-toast");
    if (!t) return;
    t.textContent = text;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3400);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  async function init() {
    await loadConfig();
    populateFields();
    setupEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
