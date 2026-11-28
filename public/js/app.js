// ============================================================================
// BELLUSTOUR — CLEAN 3D CATEGORY CAROUSEL -> CATEGORY POPUP -> QUOTE POPUP
// ============================================================================

(function () {
  "use strict";

  const STORAGE_KEY = "bellustour_site_config_v1";

  let siteConfig = JSON.parse(JSON.stringify(window.BELLUSTOUR_DEFAULT_CONFIG));
  let activeCatIndex = 0;
  let openCategoryId = null;
  let selectedPackage = null;

  const CATEGORY_ICONS = {
    cruzeiros: "🛳️",
    nacionais: "🇧🇷",
    internacionais: "🌍",
    promocionais: "🔥",
    "ultimas-vagas": "⏳"
  };

  function getCategoryIcon(cat) {
    if (!cat) return "✨";
    if (cat.emoji) return cat.emoji;
    if (cat.icon && !/^[a-z]+$/i.test(cat.icon)) return cat.icon;
    return CATEGORY_ICONS[cat.id] || "✨";
  }

  // --------------------------------------------------------------------------
  // 1. Load Configuration (LocalStorage -> /api/config -> Default)
  // --------------------------------------------------------------------------
  async function loadSiteConfig() {
    try {
      const localRaw = localStorage.getItem(STORAGE_KEY);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (parsed && parsed.categories && parsed.packages) {
          // Ensure categories have images from new schema
          if (parsed.categories[0] && parsed.categories[0].image) {
            siteConfig = parsed;
          }
        }
      }
    } catch (e) {
      console.warn(e);
    }

    if (location.protocol.startsWith("http")) {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (res.ok) {
          const remoteData = await res.json();
          if (
            remoteData &&
            remoteData.categories &&
            remoteData.categories[0] &&
            remoteData.categories[0].image
          ) {
            siteConfig = remoteData;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(siteConfig));
          }
        }
      } catch (_) {}
    }
  }

  // --------------------------------------------------------------------------
  // 2. Apply Brand, Logo & Texts
  // --------------------------------------------------------------------------
  function applyBrandAndTexts() {
    const b = siteConfig.brand || {};
    const p = siteConfig.popup || {};

    const logoImg = document.getElementById("brand-logo-img");
    const logoSvg = document.getElementById("brand-emblem-svg");
    const wordmark = document.getElementById("brand-wordmark");
    if (logoImg && logoSvg) {
      if (b.logoMode === "original") {
        logoImg.src = "assets/logo-transparent.png";
        logoImg.style.display = "block";
        logoSvg.style.display = "none";
        if (wordmark) wordmark.style.display = "none";
      } else if (b.logoMode === "custom") {
        logoImg.src = b.logoUrl || "assets/logo-transparent.png";
        logoImg.style.display = "block";
        logoSvg.style.display = "none";
        if (wordmark) wordmark.style.display = "none";
      } else {
        logoImg.style.display = "none";
        logoSvg.style.display = "block";
        if (wordmark) wordmark.style.display = "flex";
      }
    }

    setText("brand-tagline", b.tagline || "VIAGENS • CRUZEIROS • EXPERIÊNCIAS");
    setText("hero-badge-text", b.heroBadge || "BELLUSTOUR • CURADORIA POR MATHEUS");
    setText("header-btn-text", b.headerButtonText || "Fale Conosco");

    // Populate 3-column Institutional Footer dynamically from config
    const inst = siteConfig.institutional || {};
    const rawWa = (b.whatsappNumber || b.headerButtonWhatsapp || "5511976655534").replace(/\D/g, "");
    const waHref = rawWa ? `https://wa.me/${rawWa}?text=${encodeURIComponent(b.headerWhatsappMessage || "Olá Matheus! Vim pelo site da Bellustour e gostaria de atendimento.")}` : "#top";
    const displayPhone =
      inst.phoneDisplay ||
      b.phoneDisplay ||
      (rawWa.length >= 12
        ? `${rawWa.slice(2, 4)} ${rawWa.slice(4, 9)}-${rawWa.slice(9)}`
        : b.whatsappNumber || "11 97665-5534");

    setText("footer-col1-title", inst.footerCol1Title || "Bellustour Brasil");
    setText("footer-col2-title", inst.footerCol2Title || "Central de atendimento");
    setText("footer-col2-subtitle", inst.footerCol2Subtitle || "Central de relacionamento com o cliente");
    setText("footer-col3-title", inst.footerCol3Title || "Termos");

    const emailAddr = b.email || "matheus.belluco01@live.com";
    const emailLink = document.getElementById("footer-email-link");
    if (emailLink) {
      emailLink.textContent = emailAddr;
      emailLink.href = `mailto:${emailAddr}`;
    }

    const phoneLink = document.getElementById("footer-phone-link");
    if (phoneLink) {
      phoneLink.textContent = displayPhone;
      phoneLink.href = waHref;
    }

    const waLink = document.getElementById("footer-wa-link");
    if (waLink) {
      waLink.href = waHref;
      waLink.textContent = inst.footerCol2WaText || "Atendimento por WhatsApp";
    }

    setText("footer-cnpj-text", b.cnpj || "70.339.841/0001-03");
    setText("footer-cnpj-bottom", b.cnpj || "70.339.841/0001-03");
    setText("footer-hours-weekdays", inst.hoursWeekdays || b.hoursWeekdays || "Segunda à Sexta: 09h às 20h");
    setText("footer-hours-saturday", inst.hoursSaturday || b.hoursSaturday || "Sábado das 09h às 16h");
    setText("footer-brand-copy", (b.name || "Bellustour") + " Viagens & Cruzeiros");
    setText("footer-address-text", b.address || "Atendimento Digital em Todo o Brasil • Especialista em Cruzeiros");
    setText("footer-year", new Date().getFullYear());

    setText("popup-welcome-title", p.welcomeTitle || "Olá! Seja muito bem-vindo(a)!");
    setText("popup-welcome-intro", p.welcomeIntro || "Aqui é o Matheus, seu especialista em cruzeiros 😎✨");
    setText("popup-welcome-pitch", p.welcomePitch || "");
    setText("popup-welcome-prompt", p.welcomePrompt || "");
    setText("popup-welcome-footer", p.welcomeFooter || "");
    setText("popup-btn-label", p.buttonText || "Cotação");

    setText("label-field-port", p.labelPort || "📍 De qual porto você gostaria de sair?");
    setText("label-field-passengers", p.labelPassengers || "👨‍👩‍👧‍👦 Quantas pessoas vão viajar?");
    setText("label-field-adults", p.labelAdults || "🔞 Todos são adultos?");
    setText("label-field-month", p.labelMonth || "📅 Qual mês você pretende viajar?");
    setText("label-field-duration", p.labelDuration || "⏳ Qual duração você prefere?");

    setText("dur-short-title", p.durShortTitle || "3 / 4 dias");
    setText("dur-short-sub", p.durShortSub || "Mini Cruzeiro (Exclusivo Santos)");
    setText("dur-long-title", p.durLongTitle || "7 / 8 dias");
    setText("dur-long-sub", p.durLongSub || "Roteiro Completo (Todos os portos)");

    const inputShort = document.getElementById("dur-input-short");
    const inputLong = document.getElementById("dur-input-long");
    if (inputShort && p.durShortTitle) inputShort.value = p.durShortTitle;
    if (inputLong && p.durLongTitle) inputLong.value = p.durLongTitle;

    setText("rule-santos-text", p.santosRuleText || "👉 Saindo de Santos: temos opções de 3/4 dias ou 7/8 dias");
    setText("rule-other-text", p.otherPortsRuleText || "👉 Outros portos: roteiros de 7/8 dias");

    populateSelect("field-port", p.ports || []);
    populateSelect("field-passengers", p.passengersOptions || []);
    populateSelect("field-adults", p.adultsOptions || []);
    populateSelect("field-month", p.months || []);
  }

  function getPackagesForCategory(catId) {
    const all = siteConfig.packages || [];
    if (!catId || catId === "all") return all;
    return all.filter(
      (pkg) =>
        pkg.category === catId ||
        (Array.isArray(pkg.alsoIn) && pkg.alsoIn.includes(catId))
    );
  }

  // --------------------------------------------------------------------------
  // 3. Render 3D Category Carousel (The 5 Categories ARE the Carousel Cards)
  // --------------------------------------------------------------------------
  function renderCategoryCarousel() {
    const cats = siteConfig.categories || [];
    const track = document.getElementById("carousel-track-3d");
    const dotsContainer = document.getElementById("carousel-dots");
    const headerBar = document.getElementById("header-cat-bar");
    if (!track || cats.length === 0) return;

    // Header quick category selector
    if (headerBar) {
      headerBar.innerHTML = cats
        .map((c, idx) => {
          const icon = getCategoryIcon(c);
          return `
            <button
              type="button"
              class="header-cat-btn ${idx === activeCatIndex ? "active" : ""}"
              data-header-idx="${idx}"
            >
              ${icon} ${escapeHtml(c.shortName || c.name)}
            </button>
          `;
        })
        .join("");

      headerBar.querySelectorAll(".header-cat-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.getAttribute("data-header-idx")) || 0;
          if (idx === activeCatIndex) {
            openCategoryPopup(cats[idx].id);
          } else {
            activeCatIndex = idx;
            update3DCategoryPositions();
          }
        });
      });
    }

    // 3D Category Cards
    track.innerHTML = cats
      .map((cat, idx) => {
        const pkgCount = getPackagesForCategory(cat.id).length;
        const icon = getCategoryIcon(cat);
        const coverImg =
          cat.image ||
          "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1600&q=85";

        return `
          <article
            class="cat-card-3d"
            data-index="${idx}"
            data-cat-id="${escapeAttr(cat.id)}"
            data-offset="0"
            role="button"
            tabindex="0"
            aria-label="${escapeAttr(cat.name)} — Clique para ver os pacotes"
          >
            <img
              class="cat-card-bg"
              src="${escapeAttr(coverImg)}"
              alt="${escapeAttr(cat.name)}"
              loading="${idx === 0 ? "eager" : "lazy"}"
            />

            <div class="cat-card-top">
              <span class="cat-badge-pill">${escapeHtml(cat.badge || `0${idx + 1}`)}</span>
              <span class="cat-count-pill">${pkgCount} ${pkgCount === 1 ? "opção" : "opções"}</span>
            </div>

            <div class="cat-card-bottom">
              <span class="cat-card-price">${escapeHtml(cat.priceFrom || "Consultoria Especializada")}</span>
              <h2 class="cat-card-title">${icon} ${escapeHtml(cat.name)}</h2>
              <p class="cat-card-sub">${escapeHtml(cat.subtitle || cat.description || "")}</p>

              <div class="cat-card-cta">
                <span>Explorar pacotes</span>
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    // Dots
    if (dotsContainer) {
      dotsContainer.innerHTML = cats
        .map(
          (c, idx) => `
          <button
            type="button"
            class="hud-dot ${idx === activeCatIndex ? "active" : ""}"
            data-dot-idx="${idx}"
            aria-label="Focar categoria ${escapeAttr(c.name)}"
          ></button>
        `
        )
        .join("");

      dotsContainer.querySelectorAll(".hud-dot").forEach((dot) => {
        dot.addEventListener("click", () => {
          activeCatIndex = Number(dot.getAttribute("data-dot-idx")) || 0;
          update3DCategoryPositions();
        });
      });
    }

    // Card Click:
    // - If clicking an angled side card: rotates it to center first
    // - If clicking the active center card: opens Popup 1 (Category Packages Showcase)
    track.querySelectorAll(".cat-card-3d").forEach((cardEl) => {
      cardEl.addEventListener("click", () => {
        const idx = Number(cardEl.getAttribute("data-index"));
        const catId = cardEl.getAttribute("data-cat-id");
        if (idx !== activeCatIndex) {
          activeCatIndex = idx;
          update3DCategoryPositions();
        } else {
          openCategoryPopup(catId);
        }
      });
    });

    update3DCategoryPositions();
  }

  function update3DCategoryPositions() {
    const cats = siteConfig.categories || [];
    const total = cats.length;
    if (total === 0) return;

    const track = document.getElementById("carousel-track-3d");
    const backdropImg = document.getElementById("stage-backdrop-img");
    const counterEl = document.getElementById("carousel-counter");

    if (track) {
      track.querySelectorAll(".cat-card-3d").forEach((card, idx) => {
        let diff = idx - activeCatIndex;
        if (diff > total / 2) diff -= total;
        if (diff < -total / 2) diff += total;

        let offset = "hidden";
        if (diff === 0) offset = "0";
        else if (diff === -1) offset = "-1";
        else if (diff === 1) offset = "1";
        else if (diff === -2) offset = "-2";
        else if (diff === 2) offset = "2";

        card.setAttribute("data-offset", offset);
      });
    }

    // Cross-fade full-screen backdrop to active category cover
    const activeCat = cats[activeCatIndex];
    if (activeCat && backdropImg && activeCat.image && backdropImg.src !== activeCat.image) {
      backdropImg.style.opacity = "0.35";
      setTimeout(() => {
        backdropImg.src = activeCat.image;
        backdropImg.style.opacity = "1";
      }, 150);
    }

    if (counterEl) {
      const currentStr = String(activeCatIndex + 1).padStart(2, "0");
      const totalStr = String(total).padStart(2, "0");
      counterEl.textContent = `${currentStr} / ${totalStr}`;
    }

    document.querySelectorAll("#carousel-dots .hud-dot").forEach((dot, idx) => {
      dot.classList.toggle("active", idx === activeCatIndex);
    });

    document.querySelectorAll("#header-cat-bar .header-cat-btn").forEach((btn, idx) => {
      btn.classList.toggle("active", idx === activeCatIndex);
    });
  }

  function stepCategoryCarousel(dir) {
    const total = (siteConfig.categories || []).length;
    if (total <= 1) return;
    activeCatIndex = (activeCatIndex + dir + total) % total;
    update3DCategoryPositions();
  }

  // --------------------------------------------------------------------------
  // 4. Popup 1: Immersive Category Packages Showcase
  // --------------------------------------------------------------------------
  function openCategoryPopup(catId) {
    const cats = siteConfig.categories || [];
    const cat = cats.find((c) => c.id === catId) || cats[0];
    if (!cat) return;

    openCategoryId = cat.id;
    const backdrop = document.getElementById("category-modal-backdrop");
    if (!backdrop) return;

    const icon = getCategoryIcon(cat);
    setText("cat-modal-badge", cat.badge || "CATEGORIA BELLUSTOUR");
    setText("cat-modal-title", `${icon} ${cat.name}`);
    setText("cat-modal-sub", cat.subtitle || cat.description || "");

    // Render quick category pills inside the popup so user can switch categories seamlessly
    const pillsContainer = document.getElementById("showcase-switcher-pills");
    if (pillsContainer) {
      pillsContainer.innerHTML = cats
        .map((c) => {
          const cIcon = getCategoryIcon(c);
          const count = getPackagesForCategory(c.id).length;
          return `
            <button
              type="button"
              class="showcase-pill ${c.id === cat.id ? "active" : ""}"
              data-switch-cat="${escapeAttr(c.id)}"
            >
              ${cIcon} ${escapeHtml(c.shortName || c.name)} (${count})
            </button>
          `;
        })
        .join("");

      pillsContainer.querySelectorAll(".showcase-pill").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetCat = btn.getAttribute("data-switch-cat");
          const newIdx = cats.findIndex((c) => c.id === targetCat);
          if (newIdx >= 0) {
            activeCatIndex = newIdx;
            update3DCategoryPositions();
          }
          openCategoryPopup(targetCat);
        });
      });
    }

    // Render Packages inside this Category
    const grid = document.getElementById("category-packages-grid");
    const navArrows = document.getElementById("showcase-nav-arrows");
    const list = getPackagesForCategory(cat.id);

    const visibleCols =
      window.innerWidth <= 640 ? 1 : window.innerWidth <= 1024 ? 2 : 3;
    if (navArrows) {
      navArrows.classList.toggle("hidden", list.length <= visibleCols);
    }

    if (grid) {
      grid.scrollLeft = 0;
      if (list.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 42px; background: rgba(255,255,255,0.03); border-radius: 16px;">
            <p style="font-size: 1.05rem; font-weight: 700; color: var(--gold-bright);">Consulte roteiros personalizados nesta categoria.</p>
            <button type="button" class="btn btn-gold" style="margin-top: 14px;" id="empty-cat-quote-btn">Falar com o Matheus</button>
          </div>
        `;
        document
          .getElementById("empty-cat-quote-btn")
          ?.addEventListener("click", () => openQuoteModal(null));
      } else {
        grid.innerHTML = list
          .map((pkg) => {
            const isUrgent =
              pkg.category === "ultimas-vagas" ||
              (pkg.alsoIn && pkg.alsoIn.includes("ultimas-vagas"));

            return `
              <article class="pkg-card">
                <div>
                  <div class="pkg-card-media">
                    <img src="${escapeAttr(pkg.image)}" alt="${escapeAttr(pkg.title)}" loading="lazy" />
                    <div class="pkg-card-badges">
                      <span class="badge-tag ${isUrgent ? "badge-urgent" : "badge-gold"}">
                        ${escapeHtml(pkg.badge || "DESTAQUE")}
                      </span>
                      <span class="badge-tag badge-ocean">⏳ ${escapeHtml(pkg.duration || "")}</span>
                    </div>
                    <span class="pkg-card-port">📍 ${escapeHtml(pkg.port || "")}</span>
                  </div>

                  <div class="pkg-card-body">
                    <span style="font-size: 0.72rem; font-weight: 800; color: var(--ocean-bright); text-transform: uppercase;">
                      ${escapeHtml(pkg.shipOrHotel || "Bellustour")}
                    </span>
                    <h3 class="pkg-card-title">${escapeHtml(pkg.title)}</h3>
                    <p class="pkg-card-sub">${escapeHtml(pkg.subtitle || "")}</p>
                    <p class="pkg-card-route"><strong>Roteiro:</strong> ${escapeHtml(pkg.route || "")}</p>
                  </div>
                </div>

                <div class="pkg-card-body" style="padding-top: 0;">
                  <div class="pkg-card-footer">
                    <div class="price-block">
                      <span class="price-label">A partir de</span>
                      <div class="price-main">${escapeHtml(pkg.priceInstallment || "")}</div>
                      <span class="price-sub">${escapeHtml(pkg.priceTotal || "")}</span>
                    </div>

                    <button
                      type="button"
                      class="btn btn-gold js-pkg-quote"
                      data-pkg-id="${escapeAttr(pkg.id)}"
                    >
                      <span>Faça sua cotação</span>
                    </button>
                  </div>
                </div>
              </article>
            `;
          })
          .join("");

        grid.querySelectorAll(".js-pkg-quote").forEach((btn) => {
          btn.addEventListener("click", () => {
            openQuoteModal(btn.getAttribute("data-pkg-id"));
          });
        });
      }
    }

    backdrop.classList.add("open");
    if (history.replaceState) {
      history.replaceState(null, "", `#${cat.id}`);
    }
  }

  function closeCategoryPopup() {
    document.getElementById("category-modal-backdrop")?.classList.remove("open");
    if (history.replaceState) {
      history.replaceState(null, "", location.pathname);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Popup 2: Matheus Quote Form Modal (-> WhatsApp)
  // --------------------------------------------------------------------------
  function openQuoteModal(pkgId) {
    const backdrop = document.getElementById("quote-modal-backdrop");
    const fallbackBox = document.getElementById("whatsapp-fallback-box");
    if (!backdrop) return;

    if (fallbackBox) fallbackBox.classList.remove("visible");

    selectedPackage =
      (siteConfig.packages || []).find((p) => p.id === pkgId) ||
      getPackagesForCategory(openCategoryId)[0] ||
      (siteConfig.packages || [])[0] ||
      null;

    if (selectedPackage) {
      const imgEl = document.getElementById("modal-pkg-img");
      if (imgEl) imgEl.src = selectedPackage.image || "assets/logo.jpeg";
      setText(
        "modal-pkg-cat",
        (selectedPackage.shipOrHotel || "PACOTE SELECIONADO").toUpperCase()
      );
      setText("modal-pkg-title", selectedPackage.title);
      setText(
        "modal-pkg-price",
        `${selectedPackage.priceInstallment || ""} • ${selectedPackage.duration || ""}`
      );

      const portSelect = document.getElementById("field-port");
      if (portSelect && selectedPackage.port) {
        const matchIdx = Array.from(portSelect.options).findIndex((opt) =>
          opt.value
            .toLowerCase()
            .includes(selectedPackage.port.split(" ")[0].toLowerCase())
        );
        if (matchIdx >= 0) portSelect.selectedIndex = matchIdx;
      }

      const prefersShort =
        selectedPackage.duration && selectedPackage.duration.includes("3");
      updateDurationRules(prefersShort ? "3/4 dias" : "7/8 dias");
    }

    backdrop.classList.add("open");
  }

  function closeQuoteModal() {
    document.getElementById("quote-modal-backdrop")?.classList.remove("open");
  }

  function updateDurationRules(preferredValue) {
    const portSelect = document.getElementById("field-port");
    const pillShort = document.getElementById("dur-pill-short");
    const pillLong = document.getElementById("dur-pill-long");
    if (!portSelect || !pillShort || !pillLong) return;

    const isSantos = (portSelect.value || "").toLowerCase().includes("santos");
    const inputShort = pillShort.querySelector("input");
    const inputLong = pillLong.querySelector("input");

    if (isSantos) {
      pillShort.classList.remove("disabled");
      inputShort.disabled = false;
      if (preferredValue === "3/4 dias") {
        inputShort.checked = true;
        pillShort.classList.add("selected");
        pillLong.classList.remove("selected");
      } else if (!inputShort.checked && !inputLong.checked) {
        inputLong.checked = true;
        pillLong.classList.add("selected");
        pillShort.classList.remove("selected");
      }
    } else {
      pillShort.classList.add("disabled");
      pillShort.classList.remove("selected");
      inputShort.disabled = true;
      inputShort.checked = false;

      inputLong.checked = true;
      pillLong.classList.add("selected");
    }
  }

  // --------------------------------------------------------------------------
  // 6. Stage Gestures (Drag, Swipe, Wheel, Keyboard, Mouse Parallax) & Events
  // --------------------------------------------------------------------------
  function setupInteractions() {
    const viewport = document.getElementById("carousel-viewport");
    const stage = document.getElementById("stage-carousel");

    document
      .getElementById("carousel-prev")
      ?.addEventListener("click", () => stepCategoryCarousel(-1));
    document
      .getElementById("carousel-next")
      ?.addEventListener("click", () => stepCategoryCarousel(1));

    // Drag / Swipe on Category Carousel
    if (viewport) {
      let startX = 0;
      let isDragging = false;

      viewport.addEventListener("pointerdown", (e) => {
        startX = e.clientX;
        isDragging = true;
      });

      window.addEventListener("pointerup", (e) => {
        if (!isDragging) return;
        isDragging = false;
        const deltaX = e.clientX - startX;
        if (Math.abs(deltaX) > 45) {
          stepCategoryCarousel(deltaX < 0 ? 1 : -1);
        }
      });

      // Horizontal wheel/trackpad gesture switches categories; vertical wheel scrolls smoothly to the footer
      let wheelLock = false;
      viewport.addEventListener(
        "wheel",
        (e) => {
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20 && !wheelLock) {
            wheelLock = true;
            stepCategoryCarousel(e.deltaX > 0 ? 1 : -1);
            setTimeout(() => {
              wheelLock = false;
            }, 400);
          }
        },
        { passive: true }
      );
    }

    // Subtle 3D Mouse Parallax
    if (stage) {
      stage.addEventListener("pointermove", (e) => {
        const rect = stage.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width - 0.5;
        const relY = (e.clientY - rect.top) / rect.height - 0.5;
        stage.style.setProperty("--px", `${(relX * -20).toFixed(1)}px`);
        stage.style.setProperty("--py", `${(relY * -12).toFixed(1)}px`);
      });
    }

    // Keyboard navigation
    window.addEventListener("keydown", (e) => {
      const quoteOpen = document
        .getElementById("quote-modal-backdrop")
        ?.classList.contains("open");
      const catOpen = document
        .getElementById("category-modal-backdrop")
        ?.classList.contains("open");

      if (quoteOpen) {
        if (e.key === "Escape") closeQuoteModal();
        return;
      }
      if (catOpen) {
        if (e.key === "Escape") closeCategoryPopup();
        return;
      }
      if (e.key === "ArrowLeft") stepCategoryCarousel(-1);
      if (e.key === "ArrowRight") stepCategoryCarousel(1);
      if (e.key === "Enter") {
        const activeCat = (siteConfig.categories || [])[activeCatIndex];
        if (activeCat) openCategoryPopup(activeCat.id);
      }
    });

    // Category Popup Close & Horizontal Rail Navigation
    document
      .getElementById("cat-modal-close-btn")
      ?.addEventListener("click", closeCategoryPopup);
    document
      .getElementById("category-modal-backdrop")
      ?.addEventListener("click", (e) => {
        if (e.target.id === "category-modal-backdrop") closeCategoryPopup();
      });

    const pkgGridEl = document.getElementById("category-packages-grid");
    document.getElementById("pkg-rail-prev")?.addEventListener("click", () => {
      if (pkgGridEl) {
        pkgGridEl.scrollBy({ left: -pkgGridEl.clientWidth, behavior: "smooth" });
      }
    });
    document.getElementById("pkg-rail-next")?.addEventListener("click", () => {
      if (pkgGridEl) {
        pkgGridEl.scrollBy({ left: pkgGridEl.clientWidth, behavior: "smooth" });
      }
    });
    pkgGridEl?.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          pkgGridEl.scrollBy({ left: e.deltaY * 1.6, behavior: "smooth" });
        }
      },
      { passive: false }
    );

    // Quote Popup Events
    document
      .getElementById("modal-close-btn")
      ?.addEventListener("click", closeQuoteModal);
    document
      .getElementById("quote-modal-backdrop")
      ?.addEventListener("click", (e) => {
        if (e.target.id === "quote-modal-backdrop") closeQuoteModal();
      });
    document
      .getElementById("header-quote-btn")
      ?.addEventListener("click", () => {
        const b = siteConfig.brand || {};
        const rawPhone = (b.headerButtonWhatsapp || b.whatsappNumber || "").replace(/\D/g, "");
        const msg =
          b.headerWhatsappMessage ||
          `Olá Matheus! Vim pelo site da *Bellustour* e gostaria de atendimento 🛳️✨`;
        if (rawPhone) {
          const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`;
          window.open(waUrl, "_blank", "noopener,noreferrer");
        } else {
          openQuoteModal(null);
        }
      });

    document
      .getElementById("field-port")
      ?.addEventListener("change", () => updateDurationRules());

    const durationOptions = document.getElementById("duration-options");
    durationOptions?.querySelectorAll(".duration-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        if (pill.classList.contains("disabled")) return;
        durationOptions
          .querySelectorAll(".duration-pill")
          .forEach((p) => p.classList.remove("selected"));
        pill.classList.add("selected");
        const radio = pill.querySelector("input");
        if (radio) radio.checked = true;
      });
    });

    // Submit Quote -> WhatsApp
    const form = document.getElementById("quote-form");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();

      const port = document.getElementById("field-port")?.value || "Santos - SP";
      const passengers =
        document.getElementById("field-passengers")?.value || "2 pessoas";
      const adults =
        document.getElementById("field-adults")?.value ||
        "Sim, todos são adultos";
      const month = document.getElementById("field-month")?.value || "A definir";
      const duration =
        form.querySelector('input[name="duration"]:checked')?.value ||
        "7/8 dias";

      const pkgTitle = selectedPackage
        ? `${selectedPackage.title} (${selectedPackage.shipOrHotel || "Bellustour"})`
        : "Consultoria Personalizada Bellustour";

      const defaultTemplate = [
        `Olá Matheus! Vim pelo site da *Bellustour* e quero fazer uma cotação 🛳️✨`,
        ``,
        `📦 *Pacote de interesse:* {pacote}`,
        `📍 *Porto de saída:* {porto}`,
        `👨‍👩‍👧‍👦 *Quantidade de pessoas:* {pessoas}`,
        `🔞 *Todos são adultos?* {adultos}`,
        `📅 *Mês pretendido:* {mes}`,
        `⏳ *Duração preferida:* {duracao}`,
        ``,
        `Pode me enviar as melhores ofertas disponíveis hoje?`
      ].join("\n");

      const rawTemplate =
        (siteConfig.popup && siteConfig.popup.whatsappTemplate) ||
        defaultTemplate;

      const fullMessage = rawTemplate
        .replace(/\{pacote\}/gi, pkgTitle)
        .replace(/\{porto\}/gi, port)
        .replace(/\{pessoas\}/gi, passengers)
        .replace(/\{adultos\}/gi, adults)
        .replace(/\{mes\}/gi, month)
        .replace(/\{duracao\}/gi, duration);
      const rawPhone = (
        (siteConfig.brand && siteConfig.brand.whatsappNumber) ||
        ""
      ).replace(/\D/g, "");

      if (!rawPhone) {
        const fallbackBox = document.getElementById("whatsapp-fallback-box");
        const previewText = document.getElementById("whatsapp-preview-text");
        if (previewText) previewText.textContent = fullMessage;
        if (fallbackBox) fallbackBox.classList.add("visible");
        return;
      }

      const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(fullMessage)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
    });

    // Check URL hash OR pathname on load (e.g., #cruzeiros or /cruzeiros opens the category popup directly)
    const initialHash = (location.hash || "").replace("#", "");
    const initialPathSlug = (location.pathname || "").replace(/^\/+|\/+$/g, "");
    const targetCatSlug = initialHash || initialPathSlug;
    if (
      targetCatSlug &&
      (siteConfig.categories || []).some((c) => c.id === targetCatSlug)
    ) {
      const idx = siteConfig.categories.findIndex((c) => c.id === targetCatSlug);
      if (idx >= 0) activeCatIndex = idx;
      update3DCategoryPositions();
      openCategoryPopup(targetCatSlug);
    }
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function populateSelect(id, items) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = items
      .map(
        (item) => `<option value="${escapeAttr(item)}">${escapeHtml(item)}</option>`
      )
      .join("");
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
    await loadSiteConfig();
    applyBrandAndTexts();
    renderCategoryCarousel();
    setupInteractions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
