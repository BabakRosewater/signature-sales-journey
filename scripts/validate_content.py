#!/usr/bin/env python3
"""
Content Integrity Checker (No-Build Training App)

Validates:
- content/modules.json parses and contains unique slugs
- each module folder exists at content/<slug>/
- each module has module_meta.json and it parses
- referenced markdown files exist (supports:
    - legacy tabs[].file
    - modern files[] as strings OR objects containing {file:"..."}
    - repo-relative paths beginning with "content/"
)
- warns if overview.csv is missing (optional convention)
"""

from __future__ import annotations
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = REPO_ROOT / "content"
MODULES_FILE = CONTENT_DIR / "modules.json"

def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        raise ValueError(f"Failed to parse JSON: {path} :: {e}") from e

def norm_path(p: str) -> str:
    return p.strip().lstrip("/").replace("\\", "/")

def is_file_repo_relative(p: str) -> bool:
    return norm_path(p).startswith("content/")

def extract_module_list(modules_json: Any) -> List[Dict[str, Any]]:
    # Support either top-level array OR { modules: [...] }
    if isinstance(modules_json, list):
        return [m for m in modules_json if isinstance(m, dict)]
    if isinstance(modules_json, dict):
        if isinstance(modules_json.get("modules"), list):
            return [m for m in modules_json["modules"] if isinstance(m, dict)]
    return []

def extract_references(meta: Dict[str, Any]) -> List[str]:
    refs: List[str] = []

    # Legacy tabs
    tabs = meta.get("tabs")
    if isinstance(tabs, list):
        for t in tabs:
            if isinstance(t, dict) and isinstance(t.get("file"), str):
                refs.append(t["file"])

    # Modern files (strings OR objects with file)
    files = meta.get("files")
    if isinstance(files, list):
        for f in files:
            if isinstance(f, str):
                refs.append(f)
            elif isinstance(f, dict) and isinstance(f.get("file"), str):
                refs.append(f["file"])

    # Optional additional keys people sometimes use
    for key in ("overview", "overviewMd", "overviewCSV", "overviewCsv"):
        v = meta.get(key)
        if isinstance(v, str):
            refs.append(v)

    # Deduplicate preserving order
    seen = set()
    out: List[str] = []
    for r in refs:
        rp = norm_path(r)
        if rp and rp not in seen:
            seen.add(rp)
            out.append(rp)
    return out

def main() -> int:
    errors: List[str] = []
    warnings: List[str] = []

    if not MODULES_FILE.is_file():
        print(f"ERROR: Missing {MODULES_FILE}")
        return 2

    try:
        modules_json = load_json(MODULES_FILE)
    except ValueError as e:
        print(f"ERROR: {e}")
        return 2

    modules = extract_module_list(modules_json)
    if not modules:
        errors.append(
            "content/modules.json did not look like either:\n"
            " - a top-level array: [ {slug,title,...}, ... ]\n"
            " - or { \"modules\": [ ... ] }\n"
        )

    # Validate slugs
    slugs: List[str] = []
    for i, m in enumerate(modules):
        slug = m.get("slug")
        if not isinstance(slug, str) or not slug.strip():
            errors.append(f"modules[{i}] missing/invalid slug: {m}")
            continue
        slugs.append(slug.strip())

    dupes = sorted({s for s in slugs if slugs.count(s) > 1})
    if dupes:
        errors.append(f"Duplicate slugs in modules.json: {dupes}")

    # Validate each module folder/meta/files
    for slug in slugs:
        module_dir = CONTENT_DIR / slug
        if not module_dir.is_dir():
            errors.append(f"Missing module folder: content/{slug}/")
            continue

        meta_path = module_dir / "module_meta.json"
        if not meta_path.is_file():
            errors.append(f"Missing module_meta.json: content/{slug}/module_meta.json")
            continue

        try:
            meta = load_json(meta_path)
        except ValueError as e:
            errors.append(str(e))
            continue

        if not isinstance(meta, dict):
            errors.append(f"module_meta.json must be an object: content/{slug}/module_meta.json")
            continue

        refs = extract_references(meta)
        if not refs:
            warnings.append(f"[{slug}] No referenced files found in module_meta.json (tabs/files).")

        for ref in refs:
            if is_file_repo_relative(ref):
                # repo-relative
                abs_path = REPO_ROOT / ref
                if not abs_path.is_file():
                    errors.append(f"[{slug}] Missing referenced file: {ref}")
            else:
                # module-relative
                abs_path = module_dir / ref
                if not abs_path.is_file():
                    errors.append(f"[{slug}] Missing referenced file: content/{slug}/{ref}")

        # Optional convention check: overview.csv
        if not (module_dir / "overview.csv").is_file():
            warnings.append(f"[{slug}] overview.csv missing (warn only).")

    # Print results
    if warnings:
        print("\nWARNINGS:")
        for w in warnings:
            print(f" - {w}")

    if errors:
        print("\nERRORS:")
        for e in errors:
            print(f" - {e}")
        return 1

    print("✅ Content validation passed.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
