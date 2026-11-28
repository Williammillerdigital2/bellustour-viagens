// ============================================================================
// BELLUSTOUR — SHARED INSTITUTIONAL PAGES HYDRATION (Sobre Nós, Termos, LGPD)
// Dynamically populates all Footer fields, Company info, and Page Paragraphs
// from Admin Config (/api/config).
// ============================================================================

(function () {
  "use strict";

  const STORAGE_KEY = "bellustour_site_config_v1";
  let cfg = window.BELLUSTOUR_DEFAULT_CONFIG || {};

  async function initInstitutional() {
    try {
      const localRaw = localStorage.getItem(STORAGE_KEY);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (parsed && parsed.brand) cfg = parsed;
      }
    } catch (_) {}

    if (location.protocol.startsWith("http")) {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (res.ok) {
          const remote = await res.json();
          if (remote && remote.brand) cfg = remote;
        }
      } catch (_) {}
    }

    const b = cfg.brand || {};
    const inst = cfg.institutional || {};
    const email = b.email || "matheus.belluco01@live.com";
    const cnpj = b.cnpj || "70.339.841/0001-03";
    const rawWa = (b.whatsappNumber || b.headerButtonWhatsapp || "5511976655534").replace(/\D/g, "");
    const waHref = `https://wa.me/${rawWa || "5511976655534"}?text=${encodeURIComponent(b.headerWhatsappMessage || "Olá Matheus! Vim pelo site da Bellustour e gostaria de atendimento.")}`;
    const displayPhone =
      inst.phoneDisplay ||
      b.phoneDisplay ||
      (rawWa.length >= 12
        ? `${rawWa.slice(2, 4)} ${rawWa.slice(4, 9)}-${rawWa.slice(9)}`
        : b.whatsappNumber || "11 97665-5534");
    const weekdays = inst.hoursWeekdays || b.hoursWeekdays || "Atendimento 24 horas — Todos os dias";
    const saturday =
      inst.hoursSaturday !== undefined
        ? inst.hoursSaturday
        : b.hoursSaturday !== undefined
          ? b.hoursSaturday
          : "";

    document.querySelectorAll(".js-inst-email").forEach((el) => {
      el.textContent = email;
      if (el.tagName === "A") el.href = `mailto:${email}`;
    });

    document.querySelectorAll(".js-inst-cnpj").forEach((el) => {
      el.textContent = cnpj;
    });

    document.querySelectorAll(".js-inst-phone").forEach((el) => {
      el.textContent = displayPhone;
      if (el.tagName === "A") el.href = waHref;
    });

    document.querySelectorAll(".js-inst-wa-link").forEach((el) => {
      if (el.tagName === "A") el.href = waHref;
      if (el.dataset.waText === "true" && inst.footerCol2WaText) {
        el.textContent = inst.footerCol2WaText;
      }
    });

    document.querySelectorAll(".js-inst-weekdays").forEach((el) => {
      el.textContent = weekdays;
    });

    document.querySelectorAll(".js-inst-saturday").forEach((el) => {
      el.textContent = saturday;
      el.style.display = saturday ? "" : "none";
    });

    // Dynamic page content fields editable from Admin Tab 5
    const fieldMap = {
      "inst-about-title": inst.aboutTitle,
      "inst-about-text1": inst.aboutText1,
      "inst-about-text2": inst.aboutText2,
      "inst-about-modality": inst.aboutModality,
      "inst-about-specialist": b.specialistName,
      "inst-terms-intro": inst.termsIntro,
      "inst-conditions-intro": inst.conditionsIntro,
      "inst-privacy-intro": inst.privacyIntro,
      "inst-ethics-intro": inst.ethicsIntro
    };

    for (const [id, val] of Object.entries(fieldMap)) {
      if (val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initInstitutional);
  } else {
    initInstitutional();
  }
})();
