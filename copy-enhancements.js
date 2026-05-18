(function () {
  const COPY_SELECTOR = ".prose .script-line, .prose pre";
  const ENHANCED_FLAG = "copyEnhanced";

  function injectStyles() {
    if (document.getElementById("copy-enhancements-styles")) return;
    const style = document.createElement("style");
    style.id = "copy-enhancements-styles";
    style.textContent = `
      .prose .copyable-block {
        position: relative;
        padding-right: 4.25rem !important;
      }
      .prose .inline-copy-btn {
        position: absolute;
        top: 0.45rem;
        right: 0.45rem;
        z-index: 2;
        border: 1px solid rgba(15, 23, 42, 0.12);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.92);
        color: rgba(15, 23, 42, 0.78);
        padding: 0.22rem 0.55rem;
        font-size: 0.65rem;
        font-weight: 850;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
        transition: transform 0.12s ease, background 0.12s ease, color 0.12s ease;
      }
      .prose .inline-copy-btn:hover {
        transform: translateY(-1px);
        background: #0f172a;
        color: #ffffff;
      }
      .prose .inline-copy-btn.copied {
        background: #16a34a;
        border-color: #16a34a;
        color: #ffffff;
      }
      .copy-toast {
        position: fixed;
        left: 50%;
        bottom: 1.25rem;
        z-index: 80;
        transform: translateX(-50%) translateY(10px);
        opacity: 0;
        pointer-events: none;
        border-radius: 999px;
        background: #0f172a;
        color: #ffffff;
        padding: 0.55rem 0.9rem;
        font-size: 0.78rem;
        font-weight: 750;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.28);
        transition: opacity 0.18s ease, transform 0.18s ease;
      }
      .copy-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      @media print {
        .prose .inline-copy-btn,
        .copy-toast { display: none !important; }
        .prose .copyable-block { padding-right: inherit !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function cleanCopiedText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll(".inline-copy-btn").forEach((button) => button.remove());
    return (clone.innerText || clone.textContent || "").trim();
  }

  function showToast(message) {
    let toast = document.querySelector(".copy-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "copy-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1300);
  }

  async function copyText(text) {
    if (!text) return false;
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  }

  function enhanceCopyBlocks(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(COPY_SELECTOR).forEach((element) => {
      if (element.dataset[ENHANCED_FLAG] === "true") return;
      element.dataset[ENHANCED_FLAG] = "true";
      element.classList.add("copyable-block");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "inline-copy-btn";
      button.textContent = "Copy";
      button.setAttribute("aria-label", "Copy this training text");

      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const text = cleanCopiedText(element);
        try {
          const copied = await copyText(text);
          if (!copied) throw new Error("Copy command failed");
          button.textContent = "Copied";
          button.classList.add("copied");
          showToast("Copied to clipboard");
          window.setTimeout(() => {
            button.textContent = "Copy";
            button.classList.remove("copied");
          }, 1100);
        } catch (error) {
          console.error("Copy failed", error);
          showToast("Copy failed");
        }
      });

      element.appendChild(button);
    });
  }

  function start() {
    injectStyles();
    enhanceCopyBlocks(document);

    const target = document.getElementById("root") || document.body;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) enhanceCopyBlocks(node);
        });
      }
    });

    observer.observe(target, { childList: true, subtree: true });
    window.addEventListener("ssj:refresh-copy-buttons", () => enhanceCopyBlocks(document));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
