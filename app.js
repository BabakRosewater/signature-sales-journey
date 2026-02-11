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
  const tabs = useMemo(() => buildTabsFromMeta(meta), [meta]);

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
      setAiModel(m.ai?.model || "gemini-2.0-flash");
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
      {/* Header (LOGO ONLY — bigger, and NO /module/... badge) */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="Signature Sales Journey Training Hub"
              className="h-12 w-auto max-w-[420px] sm:h-14 md:h-16"
            />
          </div>
          <div className="hidden rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 lg:block">
            Training Hub
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
                {modules.length}
              </span>
            </div>

            <div className="max-h-[70vh] overflow-auto pr-1">
              {modules.map((m) => {
                const isActive = m.slug === slug;
                return (
                  <button
                    key={m.slug}
                    onClick={() => navigateToModule(m.slug)}
                    className={`w-full rounded-2xl border px-3 py-2.5 text-left transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-sm font-semibold">{m.title}</div>
                    <div className={`text-xs ${isActive ? "text-white/80" : "text-slate-500"}`}>
                      {m.description || ""}
                    </div>
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
              <div className="text-xl font-extrabold">{currentTitle}</div>
              {meta?.description ? <div className="mt-1 text-sm text-slate-600">{meta.description}</div> : null}
              {meta?.objective ? (
                <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                  <span className="font-semibold text-slate-900">Objective:</span> {meta.objective}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {meta?.estimated_time_minutes ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 ring-1 ring-slate-200">
                    ~{meta.estimated_time_minutes} min
                  </span>
                ) : null}
                {activeTabIndex >= 0 ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 ring-1 ring-slate-200">
                    Tab {activeTabIndex + 1} of {tabs.length}
                  </span>
                ) : null}
                {activeTab?.type === "markdown" ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 ring-1 ring-slate-200">
                    Reading progress {readingProgress}%
                  </span>
                ) : null}
              </div>
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

              <Button kind="secondary" onClick={() => copyCurrentTab(activeTab)}>
                Copy tab
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
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
