const { useEffect, useMemo, useRef, useState } = React;
const { createRoot } = ReactDOM;

/** ---------- helpers ---------- */
const jsonFetch = async (url) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
};

const textFetch = async (url) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
};

const getSlugFromPath = () => {
  // Preferred: /module/<slug>
  const p = window.location.pathname || "/";
  const match = p.match(/^\/module\/([^\/?#]+)/);
  if (match && match[1]) return decodeURIComponent(match[1]);

  // Fallback: #/module/<slug>
  const h = window.location.hash || "";
  const m2 = h.match(/^#\/module\/([^\/?#]+)/);
  if (m2 && m2[1]) return decodeURIComponent(m2[1]);

  return null;
};

const navigateToModule = (slug) => {
  const next = `/module/${encodeURIComponent(slug)}`;
  window.history.pushState({}, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const renderMarkdownSafe = (md) => {
  const html = window.marked.parse(md || "");
  return window.DOMPurify.sanitize(html);
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightHtml = (html, query) => {
  if (!html || !query?.trim()) return html;
  const re = new RegExp(`(${escapeRegExp(query.trim())})`, "gi");
  const highlighted = html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
    if (tag) return tag;
    return text.replace(re, '<mark class="search-hit">$1</mark>');
  });
  return window.DOMPurify.sanitize(highlighted);
};

const inferTabLabel = (file) => {
  const map = {
    "1_overview.md": "Overview",
    "2_science.md": "Science",
    "2_the_science.md": "Science",
    "3_standards.md": "Standards",
    "4_scripts.md": "Scripts",
    "5_roleplay.md": "Role-Play",
    "5_role_play.md": "Role-Play",
    "6_worksheet.md": "Worksheet",
    "overview.md": "Overview",
  };
  return map[file] || file.replace(/\.md$/i, "").replace(/^[0-9]+_/, "");
};

const SUPPLEMENT_TRAINING_LINKS = {
  "power-greeting": "/supplement_training/module_1_greeting_and_first_impressions.html",
  "decision-point-building-value": "/supplement_training/module_5_decision_point_and_building_value.html",
};

/**
 * Per-tab UX label/subtitle, used by the Quick Start banner.
 * Keys match the labels returned by inferTabLabel / module_meta tab labels.
 * Modules whose labels aren't listed here fall back to the raw label.
 */
const TAB_UX = {
  "Overview":        { eyebrow: "Quick Start",     subtitle: "Objective, outcomes, and the flow for this step." },
  "Science":         { eyebrow: "Why It Works",    subtitle: "The principles behind trust + decision clarity." },
  "Standards":       { eyebrow: "Non-Negotiables", subtitle: "What great looks like — every time." },
  "Scripts":         { eyebrow: "Word Tracks",     subtitle: "Scenario language you can copy and run." },
  "Role-Play":       { eyebrow: "Practice Reps",   subtitle: "Scenarios + rubrics to build consistency fast." },
  "Worksheet":       { eyebrow: "Action Plan",     subtitle: "Capture your plan and use it in the showroom." },
  "Quick Reference": { eyebrow: "Quick Reference", subtitle: "Fast scan summary you can use in the moment." },
  "AI Lab":          { eyebrow: "AI Coach",        subtitle: "Live coaching backed by Gemini." },
};

/**
 * Sister-site links shown in the Master Hub drawer.
 * Only real, externally hosted Cloudflare Pages projects — no internal
 * placeholders that would 404 in this repo.
 */
const HUB_SECTIONS = [
  {
    title: "Central Launchpad",
    links: [
      { label: "Sales • Service • Parts Hub", href: "https://sales-service-parts-hub.pages.dev" },
    ],
  },
  {
    title: "Sales • Inventory • CRM",
    links: [
      { label: "Core Incentives Matrix",   href: "https://sales-battle-card.pages.dev/region_incentives/" },
      { label: "Inventory Finder",         href: "https://clark-inventory-finder.pages.dev" },
      { label: "Save-A-Deal Logic",        href: "https://save-a-deal-logic.pages.dev" },
      { label: "Activation Framework",     href: "https://sales-battle-card.pages.dev/daily_training/save-a-deal_activation_framework/" },
    ],
  },
  {
    title: "Training • Coaching",
    links: [
      { label: "Sales Journey Training (You are here)", href: "#", isCurrent: true },
    ],
  },
  {
    title: "Service Excellence",
    links: [
      { label: "Service Battle Cards", href: "https://service-battle-card.pages.dev/" },
    ],
  },
];

/**
 * Sidebar eyebrow label for a module: "Start Here" / "Module 01" / "Playbook".
 * Driven by the existing `order` field in /content/modules.json.
 */
const moduleSidebarLabel = (m) => {
  if (!m) return "";
  if (m.slug === "full-journey-script-playbook") return "Playbook";
  const order = typeof m.order === "number" ? m.order : null;
  if (order === 0) return "Start Here";
  if (order === null) return "Module";
  return `Module ${String(order).padStart(2, "0")}`;
};

const buildTabsFromMeta = (m) => {
  if (!m) return [];

  if (Array.isArray(m?.tabs) && m.tabs.length) {
    return m.tabs.map((t) => ({
      ...t,
      type: t.type || (t.file ? "markdown" : "ai"),
    }));
  }

  const fileTabs = Array.isArray(m?.files)
    ? m.files
        .filter((f) => typeof f === "string" && /\.md$/i.test(f))
        .map((file) => ({
          id: file.replace(/\.md$/i, ""),
          label: inferTabLabel(file),
          type: "markdown",
          file,
        }))
    : [];

  if (fileTabs.length) {
    return [...fileTabs, { id: "ai", label: "AI Lab", type: "ai" }];
  }

  return [{ id: "overview", label: "Overview", type: "markdown", file: "overview.md" }];
};

/** ---------- UI ---------- */
function Button({ children, onClick, kind = "primary", disabled = false }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition";
  const styles =
    kind === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300"
      : "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:text-slate-400";
  return (
    <button className={`${base} ${styles}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function App() {
  const [modules, setModules] = useState([]);
  const [slug, setSlug] = useState(getSlugFromPath() || "");
  const [meta, setMeta] = useState(null);
  const [activeTabId, setActiveTabId] = useState("overview");

  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState("");
  const [tabMarkdown, setTabMarkdown] = useState("");
  const [tabHtml, setTabHtml] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const contentRef = useRef(null);
  const [readingProgress, setReadingProgress] = useState(0);

  // AI state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSystem, setAiSystem] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const aiAbortRef = useRef(null);

  // Phase 2 UX state
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [hubOpen, setHubOpen] = useState(false);

  const tabs = useMemo(() => buildTabsFromMeta(meta), [meta]);

  const visibleModules = useMemo(() => {
    const q = sidebarFilter.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter((m) =>
      [m.title, m.description, moduleSidebarLabel(m), m.slug]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(q))
    );
  }, [modules, sidebarFilter]);

  useEffect(() => {
    const onPop = () => setSlug(getSlugFromPath() || "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Load modules list
  useEffect(() => {
    (async () => {
      const list = await jsonFetch("/content/modules.json");
      const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setModules(sorted);

      // If no slug in URL, default to first module
      if (!getSlugFromPath() && sorted.length) {
        navigateToModule(sorted[0].slug);
      }
    })().catch((e) => {
      console.error(e);
      setTabError(`Failed to load modules.json: ${e.message}`);
    });
  }, []);

  const showToast = (message) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 1400);
  };

  const copyCurrentTab = async (activeTab) => {
    if (!activeTab) return;
    const source = activeTab.type === "markdown" ? tabMarkdown : aiResult;
    if (!source) {
      showToast("Nothing to copy yet");
      return;
    }

    try {
      await navigator.clipboard.writeText(source);
      showToast("Copied");
    } catch (e) {
      console.error(e);
      showToast("Copy failed");
    }
  };

  // Load module_meta.json when slug changes
  useEffect(() => {
    if (!slug) return;
    (async () => {
      setMeta(null);
      setTabError("");
      setTabMarkdown("");
      setTabHtml("");
      setSearchQuery("");
      const m = await jsonFetch(`/content/${slug}/module_meta.json`);
      setMeta({ ...m, __slug: slug });

      // Default tab (prefer last opened tab for this module)
      const normalizedTabs = buildTabsFromMeta(m);
      const savedTabId = (() => {
        try {
          return window.localStorage.getItem(`ssj_tab_${slug}`);
        } catch {
          return null;
        }
      })();
      const firstTab =
        normalizedTabs.find((t) => t.id === savedTabId)?.id ||
        normalizedTabs[0]?.id ||
        "overview";
      setActiveTabId(firstTab);

      // Seed AI settings
      setAiSystem(
        m.ai?.system ||
          "You are a dealership sales trainer. Be concise, specific, and usable."
      );
      setAiModel(m.ai?.model || "gemini-2.5-flash");
      setAiPrompt(m.ai?.starterPrompt || "");
      setAiResult("");
    })().catch((e) => {
      console.error(e);
      setTabError(`Failed to load module meta for "${slug}": ${e.message}`);
    });
  }, [slug]);

  // Persist last-opened tab per module
  useEffect(() => {
    if (!slug || !activeTabId) return;
    try {
      window.localStorage.setItem(`ssj_tab_${slug}`, activeTabId);
    } catch {
      // ignore storage restrictions
    }
  }, [slug, activeTabId]);

  const activeTab = useMemo(() => {
    if (!tabs.length) return null;
    return tabs.find((t) => t.id === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  const activeTabIndex = useMemo(
    () => tabs.findIndex((t) => t.id === activeTabId),
    [tabs, activeTabId]
  );

  const visibleTabHtml = useMemo(
    () => highlightHtml(tabHtml, searchQuery),
    [tabHtml, searchQuery]
  );

  // Load tab content (markdown) when active tab changes
  useEffect(() => {
    if (!slug || !activeTab) return;
    if (!meta || meta.__slug !== slug) return;

    setSearchQuery("");

    if (activeTab.type !== "markdown") {
      setTabMarkdown("");
      setTabHtml("");
      setTabError("");
      setTabLoading(false);
      return;
    }

    (async () => {
      setTabLoading(true);
      setTabError("");
      try {
        const md = await textFetch(`/content/${slug}/${activeTab.file}`);
        setTabMarkdown(md);
        setTabHtml(renderMarkdownSafe(md));
      } catch (e) {
        setTabError(`Could not load ${activeTab.file}. ${e.message}`);
      } finally {
        setTabLoading(false);
      }
    })();
  }, [slug, activeTabId, activeTab?.type, activeTab?.file, meta]);

  // Reading progress indicator for markdown tabs
  useEffect(() => {
    if (activeTab?.type !== "markdown") {
      setReadingProgress(0);
      return;
    }

    const calcProgress = () => {
      const el = contentRef.current;
      if (!el) {
        setReadingProgress(0);
        return;
      }
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const total = Math.max(el.scrollHeight - viewport * 0.45, 1);
      const progressed = Math.min(Math.max(viewport * 0.35 - rect.top, 0), total);
      setReadingProgress(Math.max(0, Math.min(100, Math.round((progressed / total) * 100))));
    };

    calcProgress();
    window.addEventListener("scroll", calcProgress, { passive: true });
    window.addEventListener("resize", calcProgress);
    return () => {
      window.removeEventListener("scroll", calcProgress);
      window.removeEventListener("resize", calcProgress);
    };
  }, [activeTab?.type, activeTabId, visibleTabHtml]);

  const currentTitle = useMemo(() => {
    const m = modules.find((x) => x.slug === slug);
    return m?.title || meta?.title || "Signature Sales Journey";
  }, [modules, slug, meta]);

  const sendToGemini = async () => {
    if (!aiPrompt.trim()) {
      setAiResult("Type a prompt first.");
      return;
    }
    setAiBusy(true);
    setAiResult("");
    setTabError("");

    try {
      aiAbortRef.current?.abort?.();
      const controller = new AbortController();
      aiAbortRef.current = controller;

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: aiPrompt,
          system: aiSystem,
          model: aiModel,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`);

      setAiResult(data?.text || "(No text returned)");
    } catch (e) {
      setAiResult(`Error: ${e.message}`);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Branded header — book icon + "Sales Journey / TRAINING HUB" + chips */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <a href="/" className="flex items-center gap-3 no-underline">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-tight text-slate-900">Sales Journey</div>
              <div className="app-eyebrow">Training Hub</div>
            </div>
          </a>

          <div className="flex items-center gap-2">
            {activeTabIndex >= 0 && tabs.length > 0 ? (
              <span className="app-chip hidden sm:inline-flex">
                Section {activeTabIndex + 1}/{tabs.length}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setHubOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
              aria-haspopup="dialog"
              aria-expanded={hubOpen}
              aria-controls="master-hub-drawer"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12h18M12 3v18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" />
              </svg>
              Hub
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-5 px-4 py-5">
        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Modules</div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                {visibleModules.length}{sidebarFilter ? `/${modules.length}` : ""}
              </span>
            </div>

            <div className="mb-2">
              <input
                className="sidebar-filter"
                value={sidebarFilter}
                onChange={(e) => setSidebarFilter(e.target.value)}
                placeholder="Filter modules..."
                aria-label="Filter modules"
              />
            </div>

            <div className="max-h-[70vh] overflow-auto pr-1">
              {visibleModules.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-slate-500">
                  No modules match "{sidebarFilter}".
                </div>
              ) : null}
              {visibleModules.map((m) => {
                const isActive = m.slug === slug;
                const eyebrow = moduleSidebarLabel(m);
                return (
                  <button
                    key={m.slug}
                    onClick={() => navigateToModule(m.slug)}
                    className={`mb-1.5 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`app-eyebrow ${isActive ? "!text-white/70" : ""}`}>{eyebrow}</div>
                      <div className="truncate text-sm font-semibold">{m.title}</div>
                      <div className={`truncate text-xs ${isActive ? "text-white/75" : "text-slate-500"}`}>
                        {m.description || ""}
                      </div>
                    </div>
                    <svg
                      className={`h-4 w-4 shrink-0 transition ${isActive ? "text-white" : "text-slate-300"}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="col-span-12 lg:col-span-8">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4">
              {/* Breadcrumb */}
              {slug ? (
                <div className="mb-2 flex items-center gap-2">
                  <span className="app-eyebrow">{moduleSidebarLabel(modules.find((m) => m.slug === slug))}</span>
                  <span className="app-eyebrow !text-slate-300">•</span>
                  <span className="app-eyebrow">Training Module</span>
                </div>
              ) : null}

              <div className="text-2xl font-extrabold tracking-tight text-slate-900">{currentTitle}</div>
              {meta?.description ? <div className="mt-1 text-sm text-slate-600">{meta.description}</div> : null}
              {meta?.objective ? (
                <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                  <span className="font-semibold text-slate-900">Objective:</span> {meta.objective}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {meta?.estimated_time_minutes ? (
                  <span className="app-chip">~{meta.estimated_time_minutes} min</span>
                ) : null}
                {activeTabIndex >= 0 && tabs.length > 0 ? (
                  <span className="app-chip">Section {activeTabIndex + 1}/{tabs.length}</span>
                ) : null}
                {activeTab?.type === "markdown" ? (
                  <span className="app-chip">Reading {readingProgress}%</span>
                ) : null}
              </div>

              {/* Quick Start / tab-specific banner */}
              {activeTab && TAB_UX[activeTab.label] ? (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                  <div className="app-eyebrow">{TAB_UX[activeTab.label].eyebrow}</div>
                  <div className="mt-0.5 text-sm text-slate-700">{TAB_UX[activeTab.label].subtitle}</div>
                </div>
              ) : null}
            </div>

            {/* Tabs */}
            <div className="mb-3 flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200">
              {tabs.map((t) => {
                const isActive = t.id === activeTabId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTabId(t.id)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition ${
                      isActive
                        ? "bg-slate-900 text-white ring-slate-900"
                        : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeTab?.type === "markdown" ? (
                <input
                  className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in this tab..."
                />
              ) : (
                <div className="flex-1" />
              )}

              {SUPPLEMENT_TRAINING_LINKS[slug] ? (
                <a
                  href={SUPPLEMENT_TRAINING_LINKS[slug]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  Supplement Training ↗
                </a>
              ) : null}

              <Button kind="secondary" onClick={() => copyCurrentTab(activeTab)}>
                <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h11M8 11h11M8 15h11M5 7h.01M5 11h.01M5 15h.01M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
                </svg>
                COPY PAGE
              </Button>

              <Button
                kind="secondary"
                disabled={activeTabIndex <= 0}
                onClick={() => setActiveTabId(tabs[activeTabIndex - 1]?.id)}
              >
                ← Previous
              </Button>
              <Button
                kind="secondary"
                disabled={activeTabIndex < 0 || activeTabIndex >= tabs.length - 1}
                onClick={() => setActiveTabId(tabs[activeTabIndex + 1]?.id)}
              >
                Next →
              </Button>
              {activeTab?.type === "markdown" ? (
                <div
                  className="ml-auto h-2 w-40 overflow-hidden rounded-full bg-slate-200"
                  aria-label="Reading progress"
                >
                  <div className="h-full bg-slate-900 transition-all" style={{ width: `${readingProgress}%` }} />
                </div>
              ) : null}
            </div>

            {/* Content */}
            {tabError ? (
              <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
                {tabError}
              </div>
            ) : null}

            {activeTab?.type === "markdown" ? (
              tabLoading ? (
                <div className="text-sm text-slate-500">Loading…</div>
              ) : (
                <div
                  ref={contentRef}
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: visibleTabHtml }}
                />
              )
            ) : null}

            {activeTab?.type === "ai" ? (
              <div className="space-y-3">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-slate-600">System</label>
                  <textarea
                    className="min-h-[70px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400"
                    value={aiSystem}
                    onChange={(e) => setAiSystem(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-slate-600">Prompt</label>
                  <textarea
                    className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ask for a role-play script, objection response, coaching notes, etc."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={sendToGemini} disabled={aiBusy}>
                    {aiBusy ? "Running…" : "Run AI Coaching"}
                  </Button>
                  <Button kind="secondary" onClick={() => setAiResult("")} disabled={aiBusy}>
                    Clear
                  </Button>
                  <div className="ml-auto text-xs text-slate-500">
                    Uses server-side proxy at <code>/api/gemini</code>
                  </div>
                </div>

                {aiResult ? (
                  <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="mb-2 text-xs font-semibold text-slate-600">Result</div>
                    <pre className="whitespace-pre-wrap text-sm text-slate-900">{aiResult}</pre>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!activeTab ? <div className="text-sm text-slate-500">Select a module…</div> : null}
          </div>
        </main>
      </div>

      {toastMessage ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}

      {/* Master Hub drawer */}
      {hubOpen ? (
        <>
          <div className="app-drawer-overlay" onClick={() => setHubOpen(false)} aria-hidden="true" />
          <div
            id="master-hub-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Master Hub"
            className="app-drawer"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="app-eyebrow">Master Hub</div>
                <div className="text-base font-extrabold text-slate-900">Sister sites & tools</div>
              </div>
              <button
                type="button"
                onClick={() => setHubOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close Master Hub"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              {HUB_SECTIONS.map((section) => (
                <div key={section.title}>
                  <div className="app-eyebrow mb-2">{section.title}</div>
                  <ul className="space-y-1.5">
                    {section.links.map((link) => {
                      const isExternal = !link.isCurrent && /^https?:\/\//i.test(link.href);
                      return (
                        <li key={link.label}>
                          <a
                            href={link.href}
                            target={isExternal ? "_blank" : undefined}
                            rel={isExternal ? "noopener noreferrer" : undefined}
                            onClick={link.isCurrent ? (e) => { e.preventDefault(); setHubOpen(false); } : undefined}
                            aria-current={link.isCurrent ? "page" : undefined}
                            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition ${
                              link.isCurrent
                                ? "bg-slate-900 text-white ring-slate-900"
                                : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <span>{link.label}</span>
                            {isExternal ? (
                              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 3h7m0 0v7m0-7L10 14" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5" />
                              </svg>
                            ) : null}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="app-footer">v4.0 • Same-Origin Content Mode</div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
