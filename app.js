const { useEffect, useMemo, useRef, useState } = React;
const { createRoot } = ReactDOM;   // or ReactDOM.createRoot(...)

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

/** ---------- UI ---------- */
function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {children}
    </span>
  );
}

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
  const [tabHtml, setTabHtml] = useState("");

  // AI state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSystem, setAiSystem] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const aiAbortRef = useRef(null);

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

  // Load module_meta.json when slug changes
  useEffect(() => {
    if (!slug) return;
    (async () => {
      setMeta(null);
      setTabError("");
      setTabHtml("");
      const m = await jsonFetch(`/content/${slug}/module_meta.json`);
      setMeta(m);

      // Default tab
      const firstTab = (m.tabs && m.tabs[0] && m.tabs[0].id) ? m.tabs[0].id : "overview";
      setActiveTabId(firstTab);

      // Seed AI settings
      setAiSystem(m.ai?.system || "You are a dealership sales trainer. Be concise, specific, and usable.");
      setAiModel(m.ai?.model || "gemini-2.0-flash");
      setAiPrompt(m.ai?.starterPrompt || "");
      setAiResult("");
    })().catch((e) => {
      console.error(e);
      setTabError(`Failed to load module meta for "${slug}": ${e.message}`);
    });
  }, [slug]);

  const activeTab = useMemo(() => {
    if (!meta?.tabs?.length) return null;
    return meta.tabs.find((t) => t.id === activeTabId) || meta.tabs[0];
  }, [meta, activeTabId]);

  // Load tab content (markdown) when active tab changes
  useEffect(() => {
    if (!slug || !activeTab) return;
    if (activeTab.type !== "markdown") {
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
        setTabHtml(renderMarkdownSafe(md));
      } catch (e) {
        setTabError(`Could not load ${activeTab.file}. ${e.message}`);
      } finally {
        setTabLoading(false);
      }
    })();
  }, [slug, activeTabId, activeTab?.type]);

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
          model: aiModel
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `${res.status} ${res.statusText}`);
      }

      setAiResult(data?.text || "(No text returned)");
    } catch (e) {
      setAiResult(`Error: ${e.message}`);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-slate-900"></div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">Signature Sales Journey</div>
              <div className="text-xs text-slate-500">Training Hub</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{slug ? `/module/${slug}` : "loading…"}</Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-4 px-4 py-4">
        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Modules</div>
              <span className="text-xs text-slate-500">{modules.length}</span>
            </div>

            <div className="max-h-[70vh] overflow-auto pr-1">
              {modules.map((m) => {
                const active = m.slug === slug;
                return (
                  <button
                    key={m.slug}
                    onClick={() => navigateToModule(m.slug)}
                    className={`w-full rounded-xl px-3 py-2 text-left transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "bg-white hover:bg-slate-50 text-slate-900"
                    }`}
                  >
                    <div className="text-sm font-semibold">{m.title}</div>
                    <div className={`text-xs ${active ? "text-white/80" : "text-slate-500"}`}>
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
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3">
              <div className="text-xl font-extrabold">{currentTitle}</div>
              {meta?.description ? (
                <div className="mt-1 text-sm text-slate-600">{meta.description}</div>
              ) : null}
            </div>

            {/* Tabs */}
            <div className="mb-4 flex flex-wrap gap-2">
              {(meta?.tabs || []).map((t) => {
                const active = t.id === activeTabId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTabId(t.id)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition ${
                      active
                        ? "bg-slate-900 text-white ring-slate-900"
                        : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
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
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: tabHtml }}
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

            {!activeTab ? (
              <div className="text-sm text-slate-500">Select a module…</div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
