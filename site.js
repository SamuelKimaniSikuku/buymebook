/* ------------------------------------------------------------
           Data source: Supabase (Postgres + Row Level Security).
           The anon key is public by design — RLS ensures it can only
           read approved/gifted/received requests and insert pending
           ones. Approvals happen in the Supabase dashboard.
           ------------------------------------------------------------ */
const SUPA_URL = "https://kejhukkyuksdgbvdmkmf.supabase.co";
const SUPA_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlamh1a2t5dWtzZGdidmRta21mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjIzODYsImV4cCI6MjEwMjA5ODM4Nn0.-HrRbarzUv5fZgi1QXTsbJJkQIv4aP85tR-wgL0JRbM";
const supaHeaders = {
  apikey: SUPA_ANON,
  Authorization: "Bearer " + SUPA_ANON,
  "Content-Type": "application/json",
};

let bookRequests = [];
let currentFilter = "all";
let bookSearchTerm = "";

/* ------------------------------------------------------------
           Reading Lists — curated thematic shelves.
           Edit this array to add or change lists. Each list has:
             title — the shelf name
             intro — a short editorial paragraph
             books — array of { title, author, amazonLink, note }
           Amazon links are auto-tagged with the platform's affiliate
           code at render time; covers come from the same ASIN logic
           as request cards.
           ------------------------------------------------------------ */
const READING_LISTS = [
  {
    title: "Where to start: habits & self-direction",
    intro:
      "Books for anyone trying to change a pattern — small ones, big ones, lifelong ones. Read in any order; revisit when you need them.",
    books: [
      {
        title: "Atomic Habits",
        author: "James Clear",
        amazonLink: "https://www.amazon.com/dp/B07D23CFGR",
        note: "Small habits compound into outsized change. The most actionable book on the subject.",
      },
      {
        title: "Mindset",
        author: "Carol S. Dweck",
        amazonLink: "https://www.amazon.com/dp/B000FCKPHG",
        note: "Why some people see ability as fixed and others as growable — and what that does to a life.",
      },
      {
        title: "Deep Work",
        author: "Cal Newport",
        amazonLink: "https://www.amazon.com/dp/B00X47ZVXM",
        note: "Focus is a scarce resource. Here's how to defend and cultivate yours.",
      },
      {
        title: "The 7 Habits of Highly Effective People",
        author: "Stephen R. Covey",
        amazonLink: "https://www.amazon.com/dp/B00GH7N7OY",
        note: "A classic for a reason — principles that translate across every decade of work and life.",
      },
    ],
  },
  {
    title: "Memoirs that move you",
    intro:
      "Lives lived out loud. These five made us see the world a little differently.",
    books: [
      {
        title: "Educated",
        author: "Tara Westover",
        amazonLink: "https://www.amazon.com/dp/B072BLVM83",
        note: "From a survivalist Idaho childhood without schooling to a Cambridge PhD. Disquieting and hopeful.",
      },
      {
        title: "When Breath Becomes Air",
        author: "Paul Kalanithi",
        amazonLink: "https://www.amazon.com/dp/B00XSSYR50",
        note: "A young neurosurgeon's reflections on meaning, mortality, and what makes a life worth living.",
      },
      {
        title: "Born a Crime",
        author: "Trevor Noah",
        amazonLink: "https://www.amazon.com/dp/B01DHWACVY",
        note: "Growing up under apartheid as the son of a Black mother and white father — funny and unflinching at once.",
      },
      {
        title: "The Glass Castle",
        author: "Jeannette Walls",
        amazonLink: "https://www.amazon.com/dp/B000OCXIWS",
        note: "A nomadic, often hungry childhood with brilliant, troubled parents — and what she made of it.",
      },
    ],
  },
  {
    title: "Big ideas: thinking, history, & the long view",
    intro:
      "Books that re-wire how you see the world. Read slowly — these reward a second pass.",
    books: [
      {
        title: "Thinking, Fast and Slow",
        author: "Daniel Kahneman",
        amazonLink: "https://www.amazon.com/dp/B00555X8OA",
        note: "Two systems, one mind — a tour of how we actually think (and where we're predictably fooled).",
      },
      {
        title: "Sapiens",
        author: "Yuval Noah Harari",
        amazonLink: "https://www.amazon.com/dp/B00ICN066A",
        note: "70,000 years of human history in one accessible volume. Big claims, vivid storytelling.",
      },
      {
        title: "The Greatest Minds and Ideas of All Time",
        author: "Will Durant",
        amazonLink: "https://www.amazon.com/dp/B0036QVP1I",
        note: "Durant on the philosophers, scientists, and writers who shaped how we think. A wise survey.",
      },
      {
        title: "Why We Sleep",
        author: "Matthew Walker",
        amazonLink: "https://www.amazon.com/dp/B0752XRB5F",
        note: "Sleep is the third pillar of health — and most of us are starving it. The science behind why it matters.",
      },
    ],
  },
];

// Map Supabase rows -> book request objects. Keeps a numeric id for
// the existing onclick wiring; the uuid rides along for API calls.
function supaRowsToBooks(rows) {
  return (rows || [])
    .filter((r) => r.is_demo !== true)
    .map((r, i) => {
      const rawPrice = String(r.price || "").trim();
      const price = rawPrice
        ? /^[0-9]+(\.[0-9]+)?$/.test(rawPrice)
          ? "$" + rawPrice
          : rawPrice
        : "Check Amazon";
      return {
        id: i + 1,
        uuid: r.id,
        title: String(r.title || "").trim(),
        author: String(r.author || "").trim() || "Unknown",
        requester: String(r.requester || "").trim() || "A reader",
        reason: String(r.reason || "").trim(),
        amazonLink: String(r.amazon_link || "").trim(),
        price: price,
        email: String(r.email || "").trim(),
        confirmCode: String(r.confirm_code || "")
          .trim()
          .toUpperCase(),
        fulfilled: r.status === "gifted" || r.status === "received",
        received: r.status === "received",
        isDemo: r.is_demo === true,
      };
    });
}

let requestLoadState = "loading";
let dataLoading = false;
async function fetchRead(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: supaHeaders,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("Could not load data");
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error("Unexpected response");
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

async function loadData() {
  if (dataLoading) return false;
  dataLoading = true;
  try {
    const rows = await fetchRead(
      SUPA_URL +
        "/rest/v1/book_requests" +
        "?select=id,title,author,requester,email,reason,amazon_link,price,status,confirm_code,is_demo" +
        "&order=created_at.asc",
    );
    bookRequests = supaRowsToBooks(rows);
    requestLoadState = "ready";
    saveData();
    return true;
  } catch (e) {
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem("bookCache") || "null");
    } catch (ignore) {}
    // Older caches can contain sample requests without the isDemo field.
    if (Array.isArray(cached)) {
      bookRequests = cached.filter((b) => b && b.uuid && b.isDemo === false);
    }
    requestLoadState = bookRequests.length ? "cached" : "error";
    return false;
  } finally {
    dataLoading = false;
  }
}

// Cache the current list so the site still works offline.
function saveData() {
  try {
    localStorage.setItem("bookCache", JSON.stringify(bookRequests));
  } catch (e) {}
}

/* ================= Book reviews ================= */
let bookReviews = [];
let reviewRating = 0;

let reviewLoadState = "idle";
async function loadReviews() {
  reviewLoadState = "loading";
  renderReviews();
  try {
    bookReviews = await fetchRead(
      SUPA_URL +
        "/rest/v1/book_reviews" +
        "?select=id,created_at,title,author,reviewer,rating,review,amazon_link&order=created_at.desc",
    );
    reviewLoadState = "ready";
  } catch (e) {
    reviewLoadState = "error";
  }
  renderReviews();
}

function starsHtml(rating) {
  const r = Math.max(0, Math.min(5, parseInt(rating, 10) || 0));
  if (!r) return "";
  return (
    '<div class="review-stars">' +
    "★".repeat(r) +
    '<span class="star-empty">' +
    "★".repeat(5 - r) +
    "</span></div>"
  );
}

function renderReviews() {
  const list = document.getElementById("reviewsList");
  if (!list) return;
  if (reviewLoadState === "idle" || reviewLoadState === "loading") {
    list.innerHTML = '<p class="empty-state">Loading reviews…</p>';
    return;
  }
  if (reviewLoadState === "error") {
    list.innerHTML =
      '<div class="empty-state"><p>We couldn’t load reviews. Check your connection and try again.</p><button class="btn btn-secondary" onclick="loadReviews()">Try again</button></div>';
    return;
  }
  if (!bookReviews.length) {
    list.innerHTML =
      '<div style="text-align:center;padding:2.5rem;color:var(--sepia);">' +
      '<h3 style="color:var(--gold);margin-bottom:0.75rem;">No reviews yet</h3>' +
      "<p>Be the first — the form below takes two minutes.</p></div>";
    return;
  }
  list.innerHTML = bookReviews
    .map((r) => {
      const coverUrl = getBookCoverUrl({ amazonLink: r.amazon_link });
      const cover = coverUrl
        ? '<img class="review-cover" src="' +
          coverUrl +
          '" alt="" loading="lazy" onload="if(this.naturalWidth<50)this.style.display=\'none\'" onerror="this.style.display=\'none\'">'
        : "";
      const when = new Date(r.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      return (
        '<article class="review-card">' +
        cover +
        '<div class="review-body">' +
        '<div class="review-title">' +
        escapeHtmlGlobal(r.title) +
        "</div>" +
        '<div class="review-author">by ' +
        escapeHtmlGlobal(r.author || "Unknown") +
        "</div>" +
        starsHtml(r.rating) +
        '<p class="review-text">' +
        escapeHtmlGlobal(r.review) +
        "</p>" +
        '<p class="review-meta">Reviewed by <strong>' +
        escapeHtmlGlobal(r.reviewer) +
        "</strong> · " +
        when +
        "</p>" +
        "</div></article>"
      );
    })
    .join("");
}

function setReviewRating(n) {
  reviewRating = n;
  document.querySelectorAll("#starInput .star-btn").forEach((b) => {
    b.classList.toggle("lit", parseInt(b.getAttribute("data-star"), 10) <= n);
    b.setAttribute(
      "aria-pressed",
      String(parseInt(b.getAttribute("data-star"), 10) === n),
    );
  });
}

async function submitReview(event) {
  event.preventDefault();
  if (document.getElementById("revWebsite").value) {
    showNotification("Thank you! Your review has been submitted for checking.");
    document.getElementById("reviewForm").reset();
    return;
  }
  if (!reviewRating) {
    showNotification("Please tap a star rating before submitting.");
    return;
  }
  const btn = document.getElementById("reviewSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Submitting…";
  try {
    const res = await fetch(SUPA_URL + "/rest/v1/book_reviews", {
      method: "POST",
      headers: Object.assign({ Prefer: "return=minimal" }, supaHeaders),
      body: JSON.stringify({
        title: document.getElementById("revTitle").value.trim(),
        author: document.getElementById("revAuthor").value.trim(),
        reviewer: document.getElementById("revName").value.trim(),
        rating: reviewRating,
        review: document.getElementById("revText").value.trim(),
        amazon_link: document.getElementById("revLink").value.trim() || null,
        status: "pending",
      }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    document.getElementById("reviewForm").reset();
    setReviewRating(0);
    showNotification(
      "⭐ Review submitted! It will appear once checked — usually within a day or two.",
    );
  } catch (e) {
    console.warn("Review submission failed", e);
    showNotification(
      "Something went wrong submitting your review. Please try again in a moment.",
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit review";
  }
}

// Submit a new request straight into Supabase (status=pending;
// it stays invisible until the owner approves it).
function showRequestFeedback(message, error = false) {
  const feedback = document.getElementById("requestFeedback");
  feedback.classList.toggle("error", error);
  feedback.innerHTML = message;
  feedback.hidden = false;
  feedback.focus();
}

function safeAmazonLink(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const amazon =
      /(^|\.)amazon\.(com|co\.uk|co\.za|com\.au|com\.br|com\.mx|com\.be|co\.jp|ca|de|fr|it|es|in|nl|se|pl|ae|sa|eg|sg|ie)$/.test(
        host,
      );
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (amazon || host === "amzn.to" || host === "a.co")
      ? url.href
      : "";
  } catch (e) {
    return "";
  }
}

function affiliateLink(value) {
  const safe = safeAmazonLink(value);
  if (!safe) return "";
  const url = new URL(safe);
  if (url.hostname !== "amzn.to" && url.hostname !== "a.co")
    url.searchParams.set("tag", "samuelkimanis-20");
  return url.href;
}

async function submitRequest(event) {
  event.preventDefault();
  const form = document.getElementById("requestForm");
  const btn = document.getElementById("requestSubmitBtn");
  if (btn.disabled) return;
  if (document.getElementById("reqWebsite").value) {
    showRequestFeedback(
      "Thank you. Your request has been submitted for review.",
    );
    form.reset();
    return;
  }
  const link = safeAmazonLink(document.getElementById("reqLink").value.trim());
  if (!link) {
    showRequestFeedback(
      "Please paste a secure Amazon book link, such as https://www.amazon.com/dp/…",
      true,
    );
    return;
  }
  const field = (id) => document.getElementById(id).value.trim();
  if (
    ["reqTitle", "reqAuthor", "reqName", "reqEmail", "reqReason"].some(
      (id) => !field(id),
    )
  ) {
    showRequestFeedback(
      "Please complete each field before sending your request.",
      true,
    );
    return;
  }
  btn.disabled = true;
  btn.textContent = "Sending your request…";
  document.getElementById("requestFeedback").hidden = true;
  const title = field("reqTitle");
  const code =
    "BOOK-" +
    Math.random().toString(36).slice(2, 8).toUpperCase() +
    "-" +
    title
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 8);
  try {
    const res = await fetch(SUPA_URL + "/rest/v1/book_requests", {
      method: "POST",
      headers: Object.assign({ Prefer: "return=minimal" }, supaHeaders),
      body: JSON.stringify({
        title,
        author: field("reqAuthor"),
        requester: field("reqName"),
        email: field("reqEmail"),
        reason: field("reqReason"),
        amazon_link: link,
        status: "pending",
        confirm_code: code,
      }),
    });
    if (!res.ok) throw new Error("Submission failed");
    form.reset();
    showRequestFeedback(
      "<strong>Your request is sent.</strong><p>We’ll review it before it appears on the site. Save this code to confirm receipt if your book is gifted:</p><code>" +
        escapeHtmlGlobal(code) +
        '</code><p>A gift isn’t guaranteed. While you wait, <a href="#free">find something free to read →</a></p>',
    );
  } catch (e) {
    showRequestFeedback(
      "<strong>We couldn’t confirm your request was sent.</strong><p>Your answers are still here. Check your connection and try again.</p>",
      true,
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Send my request";
  }
}

// Render the Recommendations tab as a clean bullet list of titles + authors.
// Each title links to its Amazon page (with affiliate tag) when available.
function renderRecommendList() {
  const container = document.getElementById("recommendList");
  if (!container) return;
  if (!bookRequests.length) {
    container.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: var(--sepia);">
                        <h3 style="color: var(--gold); margin-bottom: 1rem;">📚 No books yet</h3>
                        <p>Approved book requests will appear here as soon as the first one lands.</p>
                    </div>
                `;
    return;
  }
  // Append the affiliate tag so clicks here still support the platform.
  const withAffiliate = affiliateLink;
  const escapeHtml = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const items = bookRequests
    .map((book) => {
      const title = escapeHtml(book.title);
      const author = escapeHtml(book.author);
      const titleHtml = safeAmazonLink(book.amazonLink)
        ? `<a class="book-link" href="${escapeHtml(withAffiliate(book.amazonLink))}" target="_blank" rel="noopener">${title}</a>`
        : `<span class="book-title-plain">${title}</span>`;
      return `<li>${titleHtml}<span class="by-author">by ${author}</span></li>`;
    })
    .join("");

  container.innerHTML = `<ul class="recommend-list">${items}</ul>`;
}

function renderAll() {
  updateStats();
  renderBookList();
  renderGiftedBookList();
  renderAllRequestsList(currentFilter);
  renderConfirmBookList(document.getElementById("searchBookInput").value);
  renderRecommendList();
  updateFilterCounts();
}

async function init() {
  document.getElementById("footerYear").textContent = new Date().getFullYear();
  initReaderSettings();
  showSection(location.hash.slice(1) || "home", false);
  window.addEventListener("hashchange", () =>
    showSection(location.hash.slice(1) || "home", true),
  );
  document.addEventListener("click", (event) => {
    const menu = document.getElementById("moreNav");
    if (!menu.contains(event.target)) menu.open = false;
  });
  await loadData();
  renderAll();
}

/* ================= Kindle-style reader controls ================= */
const READER_THEMES = ["paper", "sepia", "dark"];
const READER_SIZES = [1, 1.1, 1.22, 1.38]; // scale multipliers for html font-size

function readerPrefs() {
  try {
    return JSON.parse(localStorage.getItem("readerPrefs") || "{}") || {};
  } catch (e) {
    return {};
  }
}
function saveReaderPrefs(p) {
  try {
    localStorage.setItem("readerPrefs", JSON.stringify(p));
  } catch (e) {}
}

function setReaderTheme(theme) {
  if (READER_THEMES.indexOf(theme) === -1) theme = "paper";
  const body = document.body;
  READER_THEMES.forEach((t) => body.classList.remove("reader-" + t));
  if (theme !== "paper") body.classList.add("reader-" + theme);
  // update active state on buttons
  document.querySelectorAll(".reader-panel [data-theme]").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-theme") === theme);
  });
  const p = readerPrefs();
  p.theme = theme;
  saveReaderPrefs(p);
}

function setReaderSize(idx) {
  idx = Math.max(0, Math.min(READER_SIZES.length - 1, parseInt(idx, 10) || 0));
  document.documentElement.style.setProperty(
    "--reader-scale",
    READER_SIZES[idx],
  );
  document.querySelectorAll(".reader-panel [data-size]").forEach((b) => {
    b.classList.toggle(
      "active",
      parseInt(b.getAttribute("data-size"), 10) === idx,
    );
  });
  const p = readerPrefs();
  p.size = idx;
  saveReaderPrefs(p);
}

function setReaderBrightness(val) {
  const v = Math.max(30, Math.min(100, parseInt(val, 10) || 100));
  // 100 -> 0 opacity, 30 -> 0.5 opacity (mild dim, keeps readability)
  const dim = (100 - v) / 140;
  const dimmer = document.getElementById("readerDim");
  if (dimmer) dimmer.style.opacity = dim.toFixed(3);
  const input = document.getElementById("readerBrightness");
  if (input && parseInt(input.value, 10) !== v) input.value = v;
  const p = readerPrefs();
  p.brightness = v;
  saveReaderPrefs(p);
}

function toggleReaderPanel(force) {
  const panel = document.getElementById("readerPanel");
  const fab = document.getElementById("readerFab");
  if (!panel) return;
  const show = typeof force === "boolean" ? force : panel.hidden;
  panel.hidden = !show;
  if (fab) fab.setAttribute("aria-expanded", show ? "true" : "false");
}

function initReaderSettings() {
  const p = readerPrefs();
  setReaderTheme(p.theme || "paper");
  setReaderSize(typeof p.size === "number" ? p.size : 0);
  setReaderBrightness(typeof p.brightness === "number" ? p.brightness : 100);
  // Click-outside + Esc to close the panel.
  document.addEventListener("click", function (e) {
    const panel = document.getElementById("readerPanel");
    const fab = document.getElementById("readerFab");
    if (!panel || panel.hidden) return;
    if (panel.contains(e.target) || (fab && fab.contains(e.target))) return;
    toggleReaderPanel(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      const panel = document.getElementById("readerPanel");
      if (panel && !panel.hidden) toggleReaderPanel(false);
    }
  });
}

async function refreshFromSheet() {
  if (dataLoading) return;
  showNotification("Refreshing requests…");
  const success = await loadData();
  renderAll();
  showNotification(
    success
      ? "Requests updated."
      : "Couldn’t refresh. Check your connection and try again.",
  );
}

function showSection(name, focus = true) {
  if (name === "main") {
    document.getElementById("main").focus();
    return;
  }
  if (name === "donate") name = "browse";
  const allowed = [
    "home",
    "browse",
    "request",
    "free",
    "how",
    "about",
    "gifted",
    "all-requests",
    "confirm",
    "recommend",
    "lists",
    "reviews",
  ];
  if (!allowed.includes(name)) name = "home";
  const panelName = name === "home" ? "browse" : name;
  document
    .querySelectorAll(".tab-content")
    .forEach((panel) =>
      panel.classList.toggle("active", panel.id === panelName),
    );
  document.getElementById("homeHero").hidden = name !== "home";
  document.body.dataset.section = name;
  document.querySelectorAll(".primary-nav .nav-link").forEach((link) => {
    const active = link.dataset.section === name;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.getElementById("moreNav").open = false;
  if (name === "reviews" && reviewLoadState === "idle") loadReviews();
  if (
    name === "lists" &&
    !document.getElementById("readingListsContainer").dataset.loaded
  ) {
    renderReadingLists();
    document.getElementById("readingListsContainer").dataset.loaded = "true";
  }
  if (focus) {
    const heading =
      name === "home"
        ? document.querySelector("h1")
        : document.querySelector("#" + panelName + " h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

function goToTab(name) {
  if (location.hash === "#" + name) showSection(name);
  else location.hash = name;
}
function switchTab(name) {
  goToTab(name);
}
function goToRequestTab() {
  goToTab("request");
}

function getStats() {
  return {
    totalRequests: bookRequests.length,
    totalFulfilled: bookRequests.filter((b) => b.fulfilled).length,
    totalReceived: bookRequests.filter((b) => b.received).length,
  };
}

function updateStats() {
  const stats = getStats();
  document.getElementById("totalRequests").textContent = stats.totalRequests;
  document.getElementById("totalFulfilled").textContent = stats.totalFulfilled;
  document.getElementById("totalReceived").textContent = stats.totalReceived;
}

// Small HTML-safe helper used by several renderers.
// Pull the ASIN out of an Amazon URL. Returns null if no ASIN can be found.
function getAsinFromAmazonUrl(url) {
  if (!url) return null;
  const m = String(url).match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

// Build the Amazon-CDN cover URL for a book if its Amazon link includes an ASIN.
function getBookCoverUrl(book) {
  const asin = getAsinFromAmazonUrl(book && book.amazonLink);
  return asin
    ? "https://images-na.ssl-images-amazon.com/images/P/" +
        asin +
        ".01._SCLZZZZZZZ_SX200_.jpg"
    : "";
}

// Build the cover HTML fragment used inside book cards. Empty string when
// no cover URL is available; falls back to a small placeholder otherwise.
function bookCoverHtml(book) {
  const url = getBookCoverUrl(book);
  if (!url) return "";
  const title =
    book && book.title ? escapeHtmlGlobal(book.title) : "Book cover";
  return (
    '<div class="book-cover-wrap">' +
    '<img class="book-cover" src="' +
    url +
    '" alt="' +
    title +
    ' cover" loading="lazy" ' +
    'onload="handleCoverImg(this)" onerror="hideCoverImg(this)">' +
    "</div>"
  );
}

// Hide tiny placeholder images Amazon returns when it has no cover for an ASIN
// (those come back as a ~1x1 spacer, ~43 bytes).
function handleCoverImg(img) {
  if (img && (img.naturalWidth < 50 || img.naturalHeight < 50)) {
    const wrap = img.parentNode;
    if (wrap) wrap.style.display = "none";
  }
}

// Hide the cover wrapper if Amazon errored on the image entirely.
function hideCoverImg(img) {
  const wrap = img && img.parentNode;
  if (wrap) wrap.style.display = "none";
}

// Build the reading-list-sized cover HTML (smaller variant). Empty
// string when no ASIN; auto-hides on placeholder/404 same as the
// request-card cover.
function listCoverHtml(book) {
  const url = getBookCoverUrl(book);
  if (!url) return "";
  const titleSafe = escapeHtmlGlobal(book.title || "Book");
  return (
    '<div class="reading-list-card-cover-wrap">' +
    '<img class="reading-list-card-cover" src="' +
    url +
    '" alt="' +
    titleSafe +
    ' cover" loading="lazy" ' +
    'onload="handleCoverImg(this)" onerror="hideCoverImg(this)">' +
    "</div>"
  );
}

// Render every curated reading list with its intro + book grid.
function renderReadingLists() {
  const container = document.getElementById("readingListsContainer");
  if (!container) return;
  if (!Array.isArray(READING_LISTS) || !READING_LISTS.length) {
    container.innerHTML =
      '<p style="text-align:center;color:var(--sepia);padding:2rem;">No reading lists yet.</p>';
    return;
  }
  const sections = READING_LISTS.map((list) => {
    const books = (list.books || [])
      .map((book) => {
        const link = book.amazonLink
          ? book.amazonLink +
            (book.amazonLink.indexOf("?") !== -1 ? "&" : "?") +
            "tag=samuelkimanis-20"
          : "#";
        return (
          "" +
          '<a class="reading-list-card" href="' +
          escapeHtmlGlobal(link) +
          '" target="_blank" rel="noopener">' +
          listCoverHtml(book) +
          '<div class="reading-list-card-text">' +
          '<div class="reading-list-card-title">' +
          escapeHtmlGlobal(book.title || "") +
          "</div>" +
          '<div class="reading-list-card-author">by ' +
          escapeHtmlGlobal(book.author || "Unknown") +
          "</div>" +
          '<p class="reading-list-card-note">' +
          escapeHtmlGlobal(book.note || "") +
          "</p>" +
          "</div>" +
          "</a>"
        );
      })
      .join("");
    return (
      "" +
      '<section class="reading-list-section">' +
      "<h3>" +
      escapeHtmlGlobal(list.title || "") +
      "</h3>" +
      '<p class="reading-list-intro">' +
      escapeHtmlGlobal(list.intro || "") +
      "</p>" +
      '<div class="reading-list-grid">' +
      books +
      "</div>" +
      "</section>"
    );
  }).join("");
  container.innerHTML = sections;
}

function escapeHtmlGlobal(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bookMatchesSearch(book) {
  if (!bookSearchTerm) return true;
  const hay = (
    (book.title || "") +
    " " +
    (book.author || "") +
    " " +
    (book.requester || "")
  ).toLowerCase();
  return hay.indexOf(bookSearchTerm) !== -1;
}

function searchBooks(term) {
  bookSearchTerm = (term || "").toLowerCase().trim();
  renderBookList();
}

function emptyBooks(message) {
  return '<div class="empty-state"><p>' + message + "</p></div>";
}

function bookCardHtml(book, receipt = false) {
  const esc = escapeHtmlGlobal;
  const reason = book.reason || "";
  const reasonHtml =
    reason.length > 150
      ? '<details class="reason-detail"><summary>' +
        esc(reason.slice(0, 120)) +
        "… <span>Read more</span></summary><p>" +
        esc(reason) +
        "</p></details>"
      : '<p class="reason-quote">“' + esc(reason) + "”</p>";
  const status = book.received ? "Received" : book.fulfilled ? "Gifted" : "";
  let action = "";
  if (receipt) {
    action =
      '<button class="amazon-btn" onclick="confirmReceipt(' +
      book.id +
      ')">I received this book</button>';
  } else if (!book.fulfilled) {
    action =
      safeAmazonLink(book.amazonLink) && book.email
        ? '<button class="amazon-btn" onclick="giftBook(' +
          book.id +
          ')">Give this book <span aria-hidden="true">→</span></button>'
        : '<p class="book-privacy">Gifting details aren’t available yet.</p>';
  }
  const price =
    book.price && book.price !== "Check Amazon"
      ? "Listed at " + esc(book.price) + " · check current price"
      : "Price shown on Amazon";
  return (
    '<article class="book-item">' +
    (status ? '<span class="fulfilled-badge">' + status + "</span>" : "") +
    '<div class="book-top">' +
    bookCoverHtml(book) +
    '<div class="book-info"><h3 class="book-title">' +
    esc(book.title) +
    '</h3><div class="book-author">by ' +
    esc(book.author) +
    '</div><p class="book-requester">Requested by ' +
    esc(book.requester) +
    "</p></div></div>" +
    reasonHtml +
    (!book.fulfilled ? '<div class="book-price">' + price + "</div>" : "") +
    action +
    "</article>"
  );
}

function renderBookList() {
  const list = document.getElementById("bookList");
  list.setAttribute("aria-busy", "false");
  const notice = document.getElementById("loadNotice");
  notice.hidden = requestLoadState === "ready";
  notice.innerHTML =
    requestLoadState === "cached"
      ? 'You’re seeing saved requests. They may have changed. <button onclick="refreshFromSheet()">Try again</button>'
      : 'We couldn’t load requests. Check your connection. <button onclick="refreshFromSheet()">Try again</button>';
  const open = bookRequests.filter((b) => !b.fulfilled);
  document.getElementById("openRequestCount").textContent =
    requestLoadState === "error"
      ? "Requests unavailable"
      : open.length + (open.length === 1 ? " open request" : " open requests");
  const visible = open.filter(bookMatchesSearch);
  if (visible.length)
    list.innerHTML = visible.map((b) => bookCardHtml(b)).join("");
  else if (requestLoadState === "error")
    list.innerHTML = emptyBooks(
      'You can still <a href="#request">request a book</a> or <a href="#free">find free books to read</a>.',
    );
  else if (bookSearchTerm)
    list.innerHTML = emptyBooks(
      "No requests match “" +
        escapeHtmlGlobal(bookSearchTerm) +
        "”. Try a different title or author.",
    );
  else
    list.innerHTML = emptyBooks(
      'No open requests right now. <a href="#request">Request a book</a> or explore our <a href="#free">free libraries</a>.',
    );
}

function renderGiftedBookList() {
  const books = bookRequests.filter((b) => b.fulfilled);
  document.getElementById("giftedCount").textContent =
    requestLoadState === "error" ? "—" : books.length;
  const priced = books.filter((b) => /^\$[0-9]+(?:\.[0-9]+)?$/.test(b.price));
  document.getElementById("giftedValue").textContent = priced.length
    ? "$" +
      priced.reduce((sum, b) => sum + Number(b.price.slice(1)), 0).toFixed(2)
    : "—";
  document.getElementById("giftedBookList").innerHTML =
    requestLoadState === "error"
      ? unavailableBooks()
      : books.length
        ? books.map((b) => bookCardHtml(b)).join("")
        : emptyBooks(
            'No books have been marked as gifted yet. <a href="#browse">Help a reader get their next book →</a>',
          );
}

function unavailableBooks() {
  return emptyBooks(
    'We couldn’t load requests. <button class="text-link" onclick="refreshFromSheet()">Try again</button>',
  );
}

function renderAllRequestsList(filter = "all") {
  const books = bookRequests.filter((b) =>
    filter === "active"
      ? !b.fulfilled
      : filter === "fulfilled"
        ? b.fulfilled
        : true,
  );
  document.getElementById("allRequestsList").innerHTML =
    requestLoadState === "error"
      ? unavailableBooks()
      : books.length
        ? books.map((b) => bookCardHtml(b)).join("")
        : emptyBooks("No requests in this view yet.");
}

function updateFilterCounts() {
  document.getElementById("countAll").textContent = bookRequests.length;
  document.getElementById("countActive").textContent = bookRequests.filter(
    (b) => !b.fulfilled,
  ).length;
  document.getElementById("countFulfilled").textContent = bookRequests.filter(
    (b) => b.fulfilled,
  ).length;
}

function filterRequests(filter) {
  currentFilter = filter;
  renderAllRequestsList(filter);

  document
    .querySelectorAll(".filter-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .getElementById("filter" + filter.charAt(0).toUpperCase() + filter.slice(1))
    .classList.add("active");
}

// The book currently being gifted via the modal.
let giftingBookId = null;
let giftFocusReturn = null;

function giftBook(bookId) {
  const book = bookRequests.find((b) => b.id === bookId);
  if (!book || !safeAmazonLink(book.amazonLink) || book.fulfilled) return;
  if (book.isDemo) {
    showNotification(
      "This is a sample request — it can't be gifted. Browse the real ones!",
    );
    return;
  }

  giftingBookId = bookId;
  giftFocusReturn = document.activeElement;
  document.getElementById("giftModalFeedback").hidden = true;
  const recipientEmail =
    book.email || "No email on file — contact the platform";

  document.getElementById("giftModalBookTitle").textContent = book.title;
  document.getElementById("giftModalBookAuthor").textContent = book.author
    ? "by " + book.author
    : "";
  document.getElementById("giftModalRequester").textContent =
    book.requester || "a reader";
  document.getElementById("giftModalEmail").textContent = recipientEmail;

  // Load the cover; hide its wrapper until we know it actually rendered.
  const coverWrap = document.getElementById("giftModalCoverWrap");
  const coverImg = document.getElementById("giftModalCover");
  const coverUrl = getBookCoverUrl(book);
  if (coverUrl) {
    coverImg.alt = (book.title || "Book") + " cover";
    coverImg.src = coverUrl;
    coverWrap.hidden = false;
  } else {
    coverImg.removeAttribute("src");
    coverWrap.hidden = true;
  }

  const copyBtn = document.getElementById("giftModalCopyBtn");
  copyBtn.textContent = "Copy";
  copyBtn.classList.remove("copied");

  document.getElementById("giftModalActions1").hidden = false;
  document.getElementById("giftModalStage2").hidden = true;

  const modal = document.getElementById("giftModal");
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  document.querySelector("#giftModal .modal-close").focus();
}

// Hide the modal cover if Amazon returned a placeholder (≈1×1) for this ASIN.
function handleModalCoverImg(img) {
  if (img && (img.naturalWidth < 50 || img.naturalHeight < 50)) {
    const wrap = document.getElementById("giftModalCoverWrap");
    if (wrap) wrap.hidden = true;
  }
}

function hideModalCoverImg() {
  const wrap = document.getElementById("giftModalCoverWrap");
  if (wrap) wrap.hidden = true;
}

function closeGiftModal() {
  const modal = document.getElementById("giftModal");
  modal.hidden = true;
  document.body.style.overflow = "";
  giftingBookId = null;
  if (giftFocusReturn && giftFocusReturn.isConnected) giftFocusReturn.focus();
}

function openGiftOnAmazon() {
  const book = bookRequests.find((b) => b.id === giftingBookId);
  const link = book && affiliateLink(book.amazonLink);
  if (!link) return;
  window.open(link, "_blank", "noopener");
  document.getElementById("giftModalActions1").hidden = true;
  document.getElementById("giftModalStage2").hidden = false;
  document.getElementById("confirmGiftedBtn").focus();
}

function copyGiftEmail() {
  const email = document.getElementById("giftModalEmail").textContent;
  const btn = document.getElementById("giftModalCopyBtn");
  const done = () => {
    btn.textContent = "Copied ✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copy";
      btn.classList.remove("copied");
    }, 2200);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(email)
      .then(done, () => fallbackCopy(email, done));
  } else {
    fallbackCopy(email, done);
  }
}

function fallbackCopy(text, after) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (e) {}
  document.body.removeChild(ta);
  if (copied && after) after();
  else
    showNotification(
      "Copy isn’t available here. Select the email and copy it manually.",
    );
}

async function confirmGifted() {
  const book = bookRequests.find((b) => b.id === giftingBookId);
  const btn = document.getElementById("confirmGiftedBtn");
  if (!book || !book.uuid || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "Saving…";
  const feedback = document.getElementById("giftModalFeedback");
  feedback.hidden = true;
  try {
    const res = await fetch(SUPA_URL + "/rest/v1/rpc/mark_gifted", {
      method: "POST",
      headers: supaHeaders,
      body: JSON.stringify({ req_id: book.uuid }),
    });
    if (!res.ok) throw new Error("Status not saved");
    book.fulfilled = true;
    saveData();
    renderAll();
    closeGiftModal();
    showNotification(
      "Your gift is marked as sent. Thank you for helping a reader.",
    );
  } catch (e) {
    feedback.textContent =
      "We couldn’t save the gifted status. If you already paid on Amazon, don’t buy the book again. Retry saving here.";
    feedback.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Yes, mark as gifted";
  }
}

document.addEventListener("keydown", (event) => {
  const modal = document.getElementById("giftModal");
  if (event.key === "Escape") {
    if (!modal.hidden) closeGiftModal();
    const more = document.getElementById("moreNav");
    if (more.open) {
      more.open = false;
      more.querySelector("summary").focus();
    }
  }
  if (event.key === "Tab" && !modal.hidden) {
    const items = Array.from(
      modal.querySelectorAll("button:not(:disabled), a[href]"),
    ).filter((el) => el.getClientRects().length);
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

function showNotification(message) {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.style.display = "block";

  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);
}

function renderConfirmBookList(searchTerm = "") {
  const term = searchTerm.toLowerCase();
  const books = bookRequests.filter(
    (b) =>
      b.fulfilled &&
      !b.received &&
      (!term ||
        b.title.toLowerCase().includes(term) ||
        b.requester.toLowerCase().includes(term)),
  );
  document.getElementById("confirmBookList").innerHTML =
    requestLoadState === "error"
      ? unavailableBooks()
      : books.length
        ? books.map((b) => bookCardHtml(b, true)).join("")
        : emptyBooks(
            term
              ? "No gifted books match your search. Try your name or another part of the title."
              : "No books are waiting for receipt confirmation.",
          );
}

function searchGiftedBooks() {
  const searchTerm = document.getElementById("searchBookInput").value;
  renderConfirmBookList(searchTerm);
}

function confirmReceiptByCode() {
  const code = document
    .getElementById("confirmCodeInput")
    .value.trim()
    .toUpperCase();
  if (!code) {
    showNotification("Please enter a confirmation code.");
    return;
  }

  const book = bookRequests.find((b) => b.confirmCode.toUpperCase() === code);
  if (!book) {
    showNotification(
      "That code doesn't match any book. Please check and try again.",
    );
    return;
  }

  if (!book.fulfilled) {
    showNotification(
      "This book hasn't been gifted yet — please check back later.",
    );
    return;
  }

  if (book.received) {
    showNotification("This book is already marked as received.");
    return;
  }

  confirmReceipt(book.id);
}

let receiptSaving = false;
async function confirmReceipt(bookId) {
  const book = bookRequests.find((b) => b.id === bookId);
  if (
    !book ||
    !book.uuid ||
    !book.confirmCode ||
    !book.fulfilled ||
    book.received ||
    receiptSaving
  )
    return;
  if (
    !confirm(
      "Have you redeemed “" +
        book.title +
        "” on Amazon? Confirm only after it is in your Kindle library.",
    )
  )
    return;
  receiptSaving = true;
  try {
    const res = await fetch(SUPA_URL + "/rest/v1/rpc/confirm_received", {
      method: "POST",
      headers: supaHeaders,
      body: JSON.stringify({ req_id: book.uuid, code: book.confirmCode }),
    });
    if (!res.ok) throw new Error("Receipt not saved");
    book.received = true;
    saveData();
    renderAll();
    document.getElementById("confirmCodeInput").value = "";
    document.getElementById("searchBookInput").value = "";
    showNotification("Thanks! Your book is marked as received.");
  } catch (e) {
    showNotification(
      "We couldn’t save your confirmation. Check your connection and try again.",
    );
  } finally {
    receiptSaving = false;
  }
}

function exportData() {
  const data = {
    bookRequests: bookRequests.map(({ email, confirmCode, ...book }) => book),
    stats: getStats(),
    exportDate: new Date().toISOString(),
  };

  const dataStr = JSON.stringify(data, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `buymeabook-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showNotification("💾 Data exported successfully!");
}

init();
