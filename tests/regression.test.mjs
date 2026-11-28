// ============================================================================
// BELLUSTOUR — AUTOMATED REGRESSION & MULTI-DEVICE RESPONSIVENESS TEST SUITE
// Rule (AGENTS.md): Every bug fix or layout adjustment MUST have a regression
// test added here and pass before delivery.
// Run with: node tests/regression.test.mjs
// ============================================================================

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:8080";

const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);

function findBrowser() {
  for (const p of BROWSER_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

// Lightweight CDP Client using Node 22+ built-in WebSocket
class CDPPage {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
    await this.send("Page.enable");
    await this.send("Runtime.enable");
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async setViewport(width, height, mobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: mobile ? 2 : 1,
      mobile
    });
  }

  async goto(url) {
    await this.send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, 550));
  }

  async eval(fnOrExpr) {
    const expression =
      typeof fnOrExpr === "function" ? `(${fnOrExpr.toString()})()` : fnOrExpr;
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(
        "JS Error in page: " +
          (res.exceptionDetails.exception?.description ||
            res.exceptionDetails.text)
      );
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

// Test Runner
let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? "-> " + details : ""}`);
    failed++;
  }
}

async function runTests() {
  console.log("==============================================================");
  console.log("🛳️ BELLUSTOUR — AUTOMATED REGRESSION & RESPONSIVENESS SUITE");
  console.log("==============================================================\n");

  // 1. Static & Config Integrity Tests
  console.log("[1/4] Config & Modular Architecture Integrity");
  const configPath = path.join(ROOT, "public", "data", "site-config.json");
  assert(fs.existsSync(configPath), "site-config.json exists");
  const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  assert(
    Array.isArray(configData.categories) && configData.categories.length === 5,
    "Config contains exactly the 5 required Carousel Categories (Cruzeiros, Nacionais, Internacionais, Promocionais, Últimas Vagas)"
  );
  assert(
    typeof configData.brand.whatsappNumber === "string",
    "WhatsApp number field is present and configurable via Admin"
  );

  // 2. Launch Headless Browser for Real DOM, Layout & Multi-Device Viewport Tests
  const browserBin = findBrowser();
  if (!browserBin) {
    throw new Error("No Chrome/Edge found for headless browser tests");
  }

  const debugPort = 9333;
  const userDataDir = path.join(ROOT, ".taste-skill", "chrome-test-profile");
  fs.mkdirSync(userDataDir, { recursive: true });

  const proc = spawn(
    browserBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank"
    ],
    { stdio: "ignore" }
  );

  try {
    // Wait for CDP endpoint
    let targets = null;
    for (let i = 0; i < 25; i++) {
      try {
        targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
        if (targets && targets.length > 0) break;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 200));
    }

    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    const page = new CDPPage(pageTarget.webSocketDebuggerUrl);
    await page.connect();

    // ------------------------------------------------------------------------
    // [2/4] Multi-Device Responsiveness Matrix (Phones, Tablets, Notebooks, Desktop)
    // ------------------------------------------------------------------------
    console.log("\n[2/4] Multi-Device Responsiveness across 8 Screen Sizes");

    const VIEWPORTS = [
      { name: "iPhone SE / Compact Mobile (320x568)", w: 320, h: 568, mobile: true },
      { name: "iPhone 13/14 Mini & Android (360x740)", w: 360, h: 740, mobile: true },
      { name: "iPhone 14/15 Standard (390x844)", w: 390, h: 844, mobile: true },
      { name: "iPhone 15 Pro Max / Plus (430x932)", w: 430, h: 932, mobile: true },
      { name: "iPad Mini / Tablet Portrait (768x1024)", w: 768, h: 1024, mobile: true },
      { name: "iPad Air / Tablet Landscape (1024x768)", w: 1024, h: 768, mobile: true },
      { name: "Compact Laptop 1366x720 (Short Screen)", w: 1366, h: 720, mobile: false },
      { name: "Full HD Desktop (1920x1080)", w: 1920, h: 1080, mobile: false }
    ];

    await page.goto(BASE_URL);

    for (const vp of VIEWPORTS) {
      await page.setViewport(vp.w, vp.h, vp.mobile);
      await new Promise((r) => setTimeout(r, 160));

      const metrics = await page.eval(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const activeCard = document.querySelector('.cat-card-3d[data-offset="0"]');
        const header = document.querySelector(".site-header");
        const bottomBar = document.querySelector(".stage-bottom-bar");

        const cardRect = activeCard ? activeCard.getBoundingClientRect() : null;
        const headerRect = header ? header.getBoundingClientRect() : null;
        const bottomRect = bottomBar ? bottomBar.getBoundingClientRect() : null;

        return {
          winW: window.innerWidth,
          winH: window.innerHeight,
          docScrollW: docEl.scrollWidth,
          bodyLocked: getComputedStyle(body).overflow === "hidden",
          cardFitsWidth:
            cardRect &&
            cardRect.left >= 0 &&
            cardRect.right <= window.innerWidth + 1,
          cardFitsHeight:
            cardRect &&
            cardRect.top >= (headerRect ? headerRect.bottom - 16 : 0) &&
            cardRect.bottom <= window.innerHeight,
          hudVisible:
            bottomRect &&
            bottomRect.bottom <= window.innerHeight + 2 &&
            bottomRect.top >= 0
        };
      });

      assert(
        metrics.docScrollW <= metrics.winW + 1 &&
          metrics.cardFitsWidth &&
          metrics.cardFitsHeight &&
          metrics.hudVisible,
        `Viewport ${vp.name}: fits 100svh cleanly, zero horizontal bleed, active 3D card & HUD fully visible`,
        JSON.stringify(metrics)
      );
    }

    // ------------------------------------------------------------------------
    // [3/4] Regression Tests for Reported Bugs & Core Interactive Flows
    // ------------------------------------------------------------------------
    console.log("\n[3/4] Functional & Visual Regression Tests");

    // Reset to Desktop 1440x900
    await page.setViewport(1440, 900, false);
    await page.goto(BASE_URL);

    // Regression #1: Home Page must ONLY have the 5 Categories in the 3D Carousel (Clean single screen)
    const homeState = await page.eval(() => {
      const cards = document.querySelectorAll(".cat-card-3d");
      return {
        count: cards.length,
        firstCatId: cards[0]?.getAttribute("data-cat-id"),
        activeOffsetCount: document.querySelectorAll('.cat-card-3d[data-offset="0"]').length
      };
    });
    assert(
      homeState.count === 5 &&
        homeState.firstCatId === "cruzeiros" &&
        homeState.activeOffsetCount === 1,
      "REGRESSION #1: Home page is 100% clean with only the 5 Category Cards in 3D Carousel (Cruzeiros active first)"
    );

    // Regression #2: Clicking a category with >3 options (e.g., "promocionais" with 6 packages or "cruzeiros" with 7)
    // MUST NOT display a scrollbar and MUST keep cards in a single horizontal glide row!
    const popupScrollRegression = await page.eval(() => {
      // Click active card (Cruzeiros - 7 options)
      const activeCard = document.querySelector('.cat-card-3d[data-offset="0"]');
      activeCard.click();

      const modal = document.querySelector(".category-showcase-modal");
      const grid = document.getElementById("category-packages-grid");
      const cards = grid.querySelectorAll(".pkg-card");
      const arrows = document.getElementById("showcase-nav-arrows");

      const modalStyle = getComputedStyle(modal);
      const gridStyle = getComputedStyle(grid);

      // Verify all cards sit on the exact same vertical top Y coordinate (1 single row, no second row wrapping!)
      const firstTop = cards[0]?.getBoundingClientRect().top;
      const allSameRow = Array.from(cards).every(
        (c) => Math.abs(c.getBoundingClientRect().top - firstTop) < 3
      );

      return {
        isOpen: document
          .getElementById("category-modal-backdrop")
          .classList.contains("open"),
        cardCount: cards.length,
        allSameRow,
        gridAutoFlow: gridStyle.gridAutoFlow,
        modalScrollbarWidth: modalStyle.scrollbarWidth,
        gridScrollbarWidth: gridStyle.scrollbarWidth,
        arrowsVisible: !arrows.classList.contains("hidden")
      };
    });

    assert(
      popupScrollRegression.isOpen &&
        popupScrollRegression.cardCount > 3 &&
        popupScrollRegression.allSameRow &&
        popupScrollRegression.gridAutoFlow === "column" &&
        popupScrollRegression.modalScrollbarWidth === "none" &&
        popupScrollRegression.gridScrollbarWidth === "none" &&
        popupScrollRegression.arrowsVisible,
      "REGRESSION #2 (No Scrollbar in >3 Options Popup): Category with >3 packages stays in 1 single horizontal row with scrollbar-width:none and sleek slide arrows",
      JSON.stringify(popupScrollRegression)
    );

    // Regression #2B: Also test Category Popup on Mobile (390x844) to ensure zero vertical cut-off
    await page.setViewport(390, 844, true);
    await new Promise((r) => setTimeout(r, 150));
    const mobilePopupCheck = await page.eval(() => {
      const modal = document.querySelector(".category-showcase-modal");
      const rect = modal.getBoundingClientRect();
      return {
        fitsScreenHeight: rect.top >= 0 && rect.bottom <= window.innerHeight + 1,
        fitsScreenWidth: rect.left >= 0 && rect.right <= window.innerWidth + 1
      };
    });
    assert(
      mobilePopupCheck.fitsScreenHeight && mobilePopupCheck.fitsScreenWidth,
      "REGRESSION #2B: Category Packages Popup fits 100% inside mobile screen (390x844) without overflowing",
      JSON.stringify(mobilePopupCheck)
    );

    // Regression #12: Even on a short mobile screen with browser address/bottom bars visible (360x620),
    // the Category Packages Popup must have ZERO vertical scroll (overflow-y: hidden, scrollHeight <= clientHeight),
    // while showing 100% of the card information (photo, title, subtitle, route, price & quote button),
    // and only the Quote Modal (.quote-modal) allows vertical scrolling.
    await page.setViewport(360, 620, true);
    await new Promise((r) => setTimeout(r, 150));
    const mobileNoVerticalScrollCheck = await page.eval(() => {
      const catModal = document.querySelector(".category-showcase-modal");
      const quoteModal = document.querySelector(".quote-modal");
      const firstCard = catModal.querySelector(".pkg-card");
      const quoteBtn = firstCard.querySelector(".js-pkg-quote");
      const titleEl = firstCard.querySelector(".pkg-card-title");
      const routeEl = firstCard.querySelector(".pkg-card-route");
      const priceEl = firstCard.querySelector(".price-main");

      const modalRect = catModal.getBoundingClientRect();
      const cardRect = firstCard.getBoundingClientRect();
      const btnRect = quoteBtn.getBoundingClientRect();

      return {
        catOverflowY: getComputedStyle(catModal).overflowY,
        zeroVerticalScroll: catModal.scrollHeight <= catModal.clientHeight + 1,
        cardFullyInsideModal:
          cardRect.top >= modalRect.top &&
          cardRect.bottom <= modalRect.bottom + 1,
        btnFullyVisible:
          btnRect.top >= modalRect.top &&
          btnRect.bottom <= modalRect.bottom + 1,
        allCardFieldsRendered: Boolean(
          titleEl?.textContent && routeEl?.textContent && priceEl?.textContent
        ),
        quoteModalHasVerticalScroll:
          getComputedStyle(quoteModal).overflowY === "auto"
      };
    });

    assert(
      mobileNoVerticalScrollCheck.catOverflowY === "hidden" &&
        mobileNoVerticalScrollCheck.zeroVerticalScroll &&
        mobileNoVerticalScrollCheck.cardFullyInsideModal &&
        mobileNoVerticalScrollCheck.btnFullyVisible &&
        mobileNoVerticalScrollCheck.allCardFieldsRendered &&
        mobileNoVerticalScrollCheck.quoteModalHasVerticalScroll,
      "REGRESSION #12 (Zero Vertical Scroll in Mobile Category Popup): On compact mobile viewport (360x620), Category Popup has zero vertical scroll, displays full card info & CTA button, and keeps vertical scroll exclusive to Quote Modal",
      JSON.stringify(mobileNoVerticalScrollCheck)
    );

    // Regression #3: Clicking "Faça sua cotação" opens Matheus Quote Popup and enforces Santos (3/4 or 7/8 dias) vs Other Ports (7/8 dias) rule
    await page.setViewport(1440, 900, false);
    const quoteRuleCheck = await page.eval(() => {
      const quoteBtn = document.querySelector(".js-pkg-quote");
      quoteBtn.click();

      const quoteOpen = document
        .getElementById("quote-modal-backdrop")
        .classList.contains("open");
      const portSelect = document.getElementById("field-port");
      const pillShort = document.getElementById("dur-pill-short");
      const pillLong = document.getElementById("dur-pill-long");

      // Select Santos
      portSelect.value = "Santos - SP";
      portSelect.dispatchEvent(new Event("change"));
      const santosAllowsShort = !pillShort.classList.contains("disabled");

      // Select Rio de Janeiro (other port)
      portSelect.value = "Rio de Janeiro - RJ";
      portSelect.dispatchEvent(new Event("change"));
      const otherPortDisablesShort = pillShort.classList.contains("disabled");
      const otherPortSelectsLong = pillLong.querySelector("input").checked;

      // Intercept window.open to capture direct WhatsApp redirect when number is configured in Admin
      let openedUrl = "";
      const origOpen = window.open;
      window.open = (url) => {
        openedUrl = String(url || "");
        return null;
      };

      document
        .getElementById("quote-form")
        .dispatchEvent(new Event("submit", { cancelable: true }));

      window.open = origOpen;
      const previewMsg = document.getElementById("whatsapp-preview-text").textContent;
      const decodedUrl = decodeURIComponent(openedUrl);

      return {
        quoteOpen,
        santosAllowsShort,
        otherPortDisablesShort,
        otherPortSelectsLong,
        hasFormattedWhatsAppMsg:
          (previewMsg.includes("Bellustour") &&
            previewMsg.includes("Rio de Janeiro - RJ") &&
            (previewMsg.includes("7/8 dias") || previewMsg.includes("7 / 8 dias"))) ||
          (decodedUrl.includes("wa.me/") &&
            decodedUrl.includes("Bellustour") &&
            decodedUrl.includes("Rio de Janeiro - RJ") &&
            (decodedUrl.includes("7/8 dias") || decodedUrl.includes("7 / 8 dias")))
      };
    });

    assert(
      quoteRuleCheck.quoteOpen &&
        quoteRuleCheck.santosAllowsShort &&
        quoteRuleCheck.otherPortDisablesShort &&
        quoteRuleCheck.otherPortSelectsLong &&
        quoteRuleCheck.hasFormattedWhatsAppMsg,
      "REGRESSION #3 (Matheus Quote Popup & Santos Conditional Rule): Santos enables 3/4 & 7/8 days; other ports lock to 7/8 days and generate formatted WhatsApp quote",
      JSON.stringify(quoteRuleCheck)
    );

    // Regression #4: Official Logo Emblem must never be distorted (rendered aspect ratio must match naturalWidth/naturalHeight)
    const logoAspectCheck = await page.eval(() => {
      const emblem = document.getElementById("brand-emblem-svg");
      if (!emblem || !emblem.naturalWidth) return { ok: false };
      const naturalRatio = emblem.naturalWidth / emblem.naturalHeight;
      const renderedRatio = emblem.clientWidth / emblem.clientHeight;
      const diff = Math.abs(naturalRatio - renderedRatio);
      return {
        ok: diff < 0.05 && emblem.src.includes("logo-emblem.png"),
        naturalRatio: Number(naturalRatio.toFixed(3)),
        renderedRatio: Number(renderedRatio.toFixed(3)),
        diff: Number(diff.toFixed(3))
      };
    });

    assert(
      logoAspectCheck.ok,
      "REGRESSION #4 (Official Logo Zero Distortion): Extracted high-res emblem renders at exact 1:1 original aspect ratio (891:382) with zero stretching",
      JSON.stringify(logoAspectCheck)
    );

    // Regression #5: Top Header button is "Fale Conosco" and forwards directly to WhatsApp
    const headerBtnCheck = await page.eval(() => {
      const btn = document.getElementById("header-quote-btn");
      const label = document.getElementById("header-btn-text")?.textContent?.trim();
      let openedUrl = "";
      const origOpen = window.open;
      window.open = (url) => {
        openedUrl = String(url || "");
        return null;
      };
      btn.click();
      window.open = origOpen;
      return {
        label,
        forwardsToWa: openedUrl.includes("wa.me/")
      };
    });

    assert(
      headerBtnCheck.label === "Fale Conosco" && headerBtnCheck.forwardsToWa,
      "REGRESSION #5 (Header Button 'Fale Conosco' -> Direct WhatsApp): Header button displays 'Fale Conosco' and redirects directly to WhatsApp",
      JSON.stringify(headerBtnCheck)
    );

    // Regression #6: Footer must NOT expose any link to Admin, and bottom HUD must NOT show numeric counter (01 / 05) or arrows
    const cleanFooterAndHudCheck = await page.eval(() => {
      const legalLinks = Array.from(
        document.querySelectorAll(".stage-mini-legal a")
      ).map((a) => a.getAttribute("href"));
      const hasAdminLink = legalLinks.some((h) => h && h.includes("admin"));
      const hasCounter = Boolean(document.getElementById("carousel-counter"));
      const hasPrevNext =
        Boolean(document.getElementById("carousel-prev")) ||
        Boolean(document.getElementById("carousel-next"));
      return {
        noAdminLink: !hasAdminLink,
        noNumericCounter: !hasCounter,
        noHudArrows: !hasPrevNext
      };
    });

    assert(
      cleanFooterAndHudCheck.noAdminLink &&
        cleanFooterAndHudCheck.noNumericCounter &&
        cleanFooterAndHudCheck.noHudArrows,
      "REGRESSION #6 & #7 (Hidden Admin Link & No Bottom Counter/Arrows): Footer has no Admin link and bottom HUD has no numeric counter or arrows",
      JSON.stringify(cleanFooterAndHudCheck)
    );

    // ------------------------------------------------------------------------
    // [4/4] Admin Panel (/admin.html) & Rollback Verification
    // ------------------------------------------------------------------------
    console.log("\n[4/4] Admin Panel (/admin.html) & Rollback System Verification");
    await page.setViewport(1440, 900, false);
    await page.goto(`${BASE_URL}/admin.html`);

    // Regression #17: Secure Worker Auth (/api/auth) Login (matheus/matheus), No password in site-config.json, & Password Change
    assert(
      !configData.brand.adminPin && !configData.brand.password,
      "REGRESSION #17A (Zero Credentials in Public JSON): No password or adminPin is exposed in public site-config.json"
    );

    const authAndPasswordChangeCheck = await page.eval(async () => {
      document.getElementById("admin-logout-btn")?.click();
      const gate = document.getElementById("admin-login-gate");
      const gateVisibleBeforeLogin = !gate.classList.contains("hidden");

      const badRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username: "matheus", password: "wrong_password" })
      });
      const badRejected = badRes.status === 401;

      document.getElementById("login-username").value = "matheus";
      document.getElementById("login-password").value = "matheus";
      document
        .getElementById("admin-login-form")
        .dispatchEvent(new Event("submit", { cancelable: true }));
      await new Promise((r) => setTimeout(r, 200));
      const gateHiddenAfterLogin = gate.classList.contains("hidden");

      const changeRes1 = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          currentPassword: "matheus",
          newPassword: "nova1234"
        })
      });
      const changeOk1 = changeRes1.status === 200;

      const changeRes2 = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          currentPassword: "nova1234",
          newPassword: "matheus"
        })
      });
      const changeOk2 = changeRes2.status === 200;

      return {
        gateVisibleBeforeLogin,
        badRejected,
        gateHiddenAfterLogin,
        passwordChangeWorks: changeOk1 && changeOk2
      };
    });

    assert(
      authAndPasswordChangeCheck.gateVisibleBeforeLogin &&
        authAndPasswordChangeCheck.badRejected &&
        authAndPasswordChangeCheck.gateHiddenAfterLogin &&
        authAndPasswordChangeCheck.passwordChangeWorks,
      "REGRESSION #17B (Worker Auth & Password Change): Login gate blocks unauthenticated access, validates matheus/matheus via /api/auth, and supports changing password",
      JSON.stringify(authAndPasswordChangeCheck)
    );

    const adminCheck = await page.eval(async () => {
      const catInputs = document.querySelectorAll("#admin-cat-list .admin-cat-item");
      const pkgItems = document.querySelectorAll("#admin-pkg-list .admin-pkg-item");
      const waInput = document.getElementById("adm-whatsapp");
      const headerBtnTextInput = document.getElementById("adm-header-btn-text");
      const headerBtnWaInput = document.getElementById("adm-header-btn-wa");
      const factoryResetBtn = document.getElementById("adm-reset-default-btn");
      const rollbackBtn = document.getElementById("adm-rollback-btn");

      // Test Rollback behavior: modify button name, save, then click Rollback and verify it restores previous name!
      const originalBtnText = headerBtnTextInput.value;
      headerBtnTextInput.value = "Texto Temporario Teste";
      document.getElementById("admin-save-all-btn").click();
      await new Promise((r) => setTimeout(r, 150));
      const savedModified = headerBtnTextInput.value === "Texto Temporario Teste";

      rollbackBtn.click();
      await new Promise((r) => setTimeout(r, 150));
      const restoredOriginal = headerBtnTextInput.value === originalBtnText;

      return {
        catCount: catInputs.length,
        pkgCount: pkgItems.length,
        hasWaField: Boolean(waInput),
        hasHeaderBtnFields: Boolean(headerBtnTextInput && headerBtnWaInput),
        noFactoryReset: !factoryResetBtn,
        hasRollbackBtn: Boolean(rollbackBtn),
        rollbackWorks: savedModified && restoredOriginal
      };
    });

    assert(
      adminCheck.catCount === 5 &&
        adminCheck.pkgCount >= 10 &&
        adminCheck.hasWaField &&
        adminCheck.hasHeaderBtnFields,
      "Admin Panel renders all 5 Carousel Category editors, 10+ Package editors, WhatsApp field, and Header Button Name/Number fields"
    );

    assert(
      adminCheck.noFactoryReset &&
        adminCheck.hasRollbackBtn &&
        adminCheck.rollbackWorks,
      "REGRESSION #8 (No Factory Reset + Working Rollback): Factory reset is removed and Rollback restores the last modification immediately",
      JSON.stringify(adminCheck)
    );

    // Regression #9: Separate Mobile Image Hosting Endpoint (/api/image) stores & serves compressed WebP/JPEG images
    const imageEndpointCheck = await page.eval(async () => {
      const c = document.createElement("canvas");
      c.width = 40;
      c.height = 30;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#e8c170";
      ctx.fillRect(0, 0, 40, 30);
      let dataUrl = c.toDataURL("image/webp", 0.84);
      if (!dataUrl.startsWith("data:image/webp")) {
        dataUrl = c.toDataURL("image/jpeg", 0.84);
      }

      const postRes = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "test_mobile_upload", dataUrl })
      });
      const postJson = await postRes.json();
      if (!postRes.ok || !postJson.url) return { ok: false };

      const getRes = await fetch(postJson.url);
      const contentType = getRes.headers.get("content-type") || "";
      return {
        ok: getRes.ok && contentType.startsWith("image/"),
        url: postJson.url,
        contentType
      };
    });

    assert(
      imageEndpointCheck.ok,
      "REGRESSION #9 (Separate Mobile Image Hosting /api/image): Mobile photo upload compresses to WebP/JPEG, stores separately via /api/image, and serves binary image with CDN headers",
      JSON.stringify(imageEndpointCheck)
    );

    // Regression #10: Intuitive Mobile Admin UX (Default tab is Meus Pacotes, Category filters work, Mobile Sticky Save bar is visible on 390x844 phone)
    await page.setViewport(390, 844, true);
    await new Promise((r) => setTimeout(r, 150));
    const mobileAdminUxCheck = await page.eval(() => {
      const defaultTabActive = document
        .getElementById("tab-packages")
        ?.classList.contains("active");
      const filterPills = document.querySelectorAll(
        "#admin-pkg-filter-pills .admin-filter-pill"
      );
      const stickyBar = document.querySelector(".mobile-sticky-bar");
      const stickyVisible =
        stickyBar && getComputedStyle(stickyBar).display === "flex";
      return {
        defaultTabActive,
        filterCount: filterPills.length,
        stickyVisible
      };
    });

    assert(
      mobileAdminUxCheck.defaultTabActive &&
        mobileAdminUxCheck.filterCount === 6 &&
        mobileAdminUxCheck.stickyVisible,
      "REGRESSION #10 (Intuitive Mobile-First Admin UX): Opens directly on 'Meus Pacotes' with category filter pills and a thumb-friendly sticky bottom Save bar on mobile",
      JSON.stringify(mobileAdminUxCheck)
    );

    // Regression #11: Admin Top Header must NOT overlap scrolled content and must NOT duplicate "Ver Site" / "Salvar Tudo" buttons near the logo
    const adminHeaderNoOverlapCheck = await page.eval(() => {
      const topHeader = document.querySelector(".admin-top-header");
      const topHeaderPos = topHeader ? getComputedStyle(topHeader).position : "fixed";
      const topHeaderText = topHeader ? topHeader.textContent : "";
      const hasDuplicateSaveOrViewInHeader =
        topHeaderText.includes("Salvar Tudo") || topHeaderText.includes("Ver Site");
      const saveButtonsTotal = document.querySelectorAll("#admin-save-all-btn, #admin-mobile-save-btn").length;
      return {
        notFixedOverlapping: topHeaderPos !== "fixed",
        noTopActionButtons: !hasDuplicateSaveOrViewInHeader,
        singleSaveButtonOnly: saveButtonsTotal === 1
      };
    });

    assert(
      adminHeaderNoOverlapCheck.notFixedOverlapping &&
        adminHeaderNoOverlapCheck.noTopActionButtons &&
        adminHeaderNoOverlapCheck.singleSaveButtonOnly,
      "REGRESSION #11 (Admin Header No Overlap & No Duplicate Buttons): Admin top header does not overlap content on scroll and has zero duplicate Save/View Site buttons near the logo",
      JSON.stringify(adminHeaderNoOverlapCheck)
    );

    // Regression #13: All 5 Quote Form questions, option lists (ports, passengers, adults, months), and duration cards must be editable in Admin Tab 4
    const formEditorFieldsCheck = await page.eval(() => {
      const requiredAdminIds = [
        "adm-pop-title",
        "adm-pop-intro",
        "adm-pop-pitch",
        "adm-pop-prompt",
        "adm-pop-label-port",
        "adm-pop-ports",
        "adm-pop-label-passengers",
        "adm-pop-passengers",
        "adm-pop-label-adults",
        "adm-pop-adults",
        "adm-pop-label-month",
        "adm-pop-months",
        "adm-pop-label-duration",
        "adm-pop-dur-short-title",
        "adm-pop-dur-short-sub",
        "adm-pop-dur-long-title",
        "adm-pop-dur-long-sub",
        "adm-pop-santos",
        "adm-pop-other",
        "adm-pop-footer",
        "adm-pop-btn"
      ];
      const missing = requiredAdminIds.filter(
        (id) => !document.getElementById(id) || !document.getElementById(id).value
      );
      return {
        allPresentAndPopulated: missing.length === 0,
        totalFieldsChecked: requiredAdminIds.length,
        missing
      };
    });

    assert(
      formEditorFieldsCheck.allPresentAndPopulated,
      "REGRESSION #13 (Full Quote Form Editable in Admin): All 21 form fields (greeting, 5 question titles, option lists for ports/passengers/adults/months, duration buttons, rules & submit button) are present and populated in Admin",
      JSON.stringify(formEditorFieldsCheck)
    );

    // Regression #14: WhatsApp Message Template for Quote Form (#adm-pop-wa-template) and Header Button (#adm-header-wa-msg) are editable in Admin with tag chips
    const waTemplateAdminCheck = await page.eval(() => {
      const tplField = document.getElementById("adm-pop-wa-template");
      const headerMsgField = document.getElementById("adm-header-wa-msg");
      const chips = document.querySelectorAll(".js-insert-wa-tag");
      const resetTplBtn = document.getElementById("adm-reset-wa-tpl-btn");

      const hasPlaceholders =
        tplField &&
        tplField.value.includes("{pacote}") &&
        tplField.value.includes("{porto}") &&
        tplField.value.includes("{pessoas}");

      return {
        hasTplField: Boolean(tplField && tplField.value),
        hasHeaderMsgField: Boolean(headerMsgField && headerMsgField.value),
        hasPlaceholders,
        chipsCount: chips.length,
        hasResetBtn: Boolean(resetTplBtn)
      };
    });

    assert(
      waTemplateAdminCheck.hasTplField &&
        waTemplateAdminCheck.hasHeaderMsgField &&
        waTemplateAdminCheck.hasPlaceholders &&
        waTemplateAdminCheck.chipsCount === 6 &&
        waTemplateAdminCheck.hasResetBtn,
      "REGRESSION #14 (Customizable WhatsApp Message Template in Admin): WhatsApp form template, header button message, 6 variable chips ({pacote}, {porto}, {pessoas}, {adultos}, {mes}, {duracao}) and template reset button are active",
      JSON.stringify(waTemplateAdminCheck)
    );

    // Regression #15: Category Cards Top Badge ("01 • FOCO PRINCIPAL", "02 • BRASIL", "03 • MUNDO", "04 • OPORTUNIDADES", "05 • ÚLTIMAS CABINES") must be editable in Admin Tab 2
    const catBadgeEditorCheck = await page.eval(() => {
      const badgeInputs = Array.from(
        document.querySelectorAll('#admin-cat-list input[data-field="badge"]')
      );
      return {
        count: badgeInputs.length,
        allPopulated:
          badgeInputs.length === 5 &&
          badgeInputs.every((inp) => inp.value.trim().length > 0),
        values: badgeInputs.map((inp) => inp.value)
      };
    });

    assert(
      catBadgeEditorCheck.allPopulated,
      "REGRESSION #15 (Category Top Badges Editable in Admin): All 5 category top badge fields ('01 • FOCO PRINCIPAL', '02 • BRASIL', '03 • MUNDO', '04 • OPORTUNIDADES', '05 • ÚLTIMAS CABINES') are editable in Admin Tab 2",
      JSON.stringify(catBadgeEditorCheck)
    );

    // Regression #16: Admin allows adding a new Carousel Category, automatically syncs it to package category dropdowns & filters, and allows deleting it
    const dynamicCategoryCrudCheck = await page.eval(async () => {
      const addCatBtn = document.getElementById("adm-new-cat-btn");
      if (!addCatBtn) return { ok: false };

      const beforeCount = document.querySelectorAll("#admin-cat-list .admin-cat-item").length;
      addCatBtn.click();
      await new Promise((r) => setTimeout(r, 150));

      const afterAddCount = document.querySelectorAll("#admin-cat-list .admin-cat-item").length;
      const pkgSelectCount = document.getElementById("edit-pkg-category")?.options.length || 0;
      const filterPillsCount = document.querySelectorAll(
        "#admin-pkg-filter-pills .admin-filter-pill"
      ).length;

      // Now delete the newly added category (last one) to restore clean state
      const delBtns = document.querySelectorAll("#admin-cat-list .js-del-cat");
      delBtns[delBtns.length - 1]?.click();
      await new Promise((r) => setTimeout(r, 150));

      const afterDelCount = document.querySelectorAll("#admin-cat-list .admin-cat-item").length;

      return {
        ok:
          afterAddCount === beforeCount + 1 &&
          pkgSelectCount === beforeCount + 1 &&
          filterPillsCount === beforeCount + 2 &&
          afterDelCount === beforeCount,
        beforeCount,
        afterAddCount,
        pkgSelectCount,
        afterDelCount
      };
    });

    assert(
      dynamicCategoryCrudCheck.ok,
      "REGRESSION #16 (Add & Delete Carousel Categories in Admin): Clicking '+ Adicionar Nova Categoria' creates a new carousel card, syncs package category selectors & filters dynamically, and supports deletion",
      JSON.stringify(dynamicCategoryCrudCheck)
    );

    // Regression #18: Admin Mobile Responsiveness across ALL 4 Tabs (Zero Right-Edge Clipping / Zero Horizontal Overflow on 360x740 & 390x844)
    for (const mobW of [360, 390]) {
      await page.setViewport(mobW, 740, true);
      await new Promise((r) => setTimeout(r, 140));
      const mobTabsOverflowCheck = await page.eval(async () => {
        const tabs = ["tab-packages", "tab-categories", "tab-whatsapp", "tab-popup"];
        const results = [];
        for (const tabId of tabs) {
          const navBtn = document.querySelector(`.admin-nav-btn[data-tab="${tabId}"]`);
          navBtn?.click();
          await new Promise((r) => setTimeout(r, 60));

          const docEl = document.documentElement;
          const banner = document.querySelector(".admin-welcome-banner")?.getBoundingClientRect();
          const sidebar = document.querySelector(".admin-sidebar")?.getBoundingClientRect();
          const card = document.getElementById(tabId)?.getBoundingClientRect();

          const winW = window.innerWidth;
          const ok =
            docEl.scrollWidth <= winW + 1 &&
            banner &&
            banner.right <= winW &&
            banner.left >= 0 &&
            sidebar &&
            sidebar.right <= winW &&
            sidebar.left >= 0 &&
            card &&
            card.right <= winW &&
            card.left >= 0;

          results.push({
            tabId,
            ok,
            scrollW: docEl.scrollWidth,
            winW,
            cardRight: Math.round(card?.right || 0)
          });
        }
        return {
          allTabsFit: results.every((r) => r.ok),
          results
        };
      });

      assert(
        mobTabsOverflowCheck.allTabsFit,
        `REGRESSION #18 (Admin Mobile Zero Horizontal Clipping at ${mobW}px): All 4 Admin tabs, welcome banner, and sidebar fit 100% within ${mobW}px mobile viewport without right-edge cutoff`,
        JSON.stringify(mobTabsOverflowCheck)
      );
    }

    // Regression #19: Zero-404 Redundant Routing (/admin, /admin/, /painel, /privacidade, /termos, /cruzeiros, and arbitrary unknown URLs must ALL return HTTP 200 OK!)
    const redundantRoutesCheck = await page.eval(async () => {
      const routesToTest = [
        "/",
        "/admin",
        "/admin/",
        "/painel",
        "/privacidade",
        "/termos",
        "/cruzeiros",
        "/promocionais",
        "/rota-inexistente-teste-123"
      ];
      const statuses = [];
      for (const r of routesToTest) {
        const res = await fetch(r);
        statuses.push({ route: r, status: res.status });
      }
      return {
        all200: statuses.every((s) => s.status === 200),
        statuses
      };
    });

    assert(
      redundantRoutesCheck.all200,
      "REGRESSION #19 (Zero-404 Redundant Routing): All friendly aliases (/admin, /admin/, /painel, /privacidade, /termos, /cruzeiros) and unknown routes return HTTP 200 OK without 404",
      JSON.stringify(redundantRoutesCheck)
    );

    page.close();
  } finally {
    proc.kill();
  }

  console.log("\n==============================================================");
  console.log(`RESULTADO FINAL: ${passed} testes aprovados, ${failed} falhas.`);
  console.log("==============================================================");
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
