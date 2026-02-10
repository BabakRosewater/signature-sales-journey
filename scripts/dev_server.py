#!/usr/bin/env python3
"""
Local dev server with SPA fallback (index.html) for no-build SPA.

Run from repo root:
  python scripts/dev_server.py

Open:
  http://localhost:8787/

Any unknown route -> index.html, so refresh on /module/<slug> works.
"""

from __future__ import annotations
import http.server
import socketserver
from pathlib import Path
from urllib.parse import urlparse, unquote

REPO_ROOT = Path(__file__).resolve().parents[1]
PORT = 8787

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def _fs_path(self) -> Path:
        # Strip query + fragment
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        rel = path.lstrip("/") or "index.html"
        return REPO_ROOT / rel

    def do_GET(self):
        target = self._fs_path()

        # Serve file if it exists
        if target.is_file():
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

        # SPA fallback
        self.path = "/index.html"
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

def main():
    if not (REPO_ROOT / "index.html").is_file():
        print("ERROR: index.html not found. Run this from the repo root.")
        raise SystemExit(2)

    with socketserver.TCPServer(("0.0.0.0", PORT), SPAHandler) as httpd:
        print(f"✅ Serving at http://localhost:{PORT}/ (SPA fallback enabled)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    main()
