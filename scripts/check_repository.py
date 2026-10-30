#!/usr/bin/env python3
"""Check document links and required work-standard IDs; not semantic validation."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

def main():
    errors = []
    required = ["README.md", "README.en.md", "CONTRIBUTING.md", "LICENSE",
                "docs/pdf-reading-guide.md", "docs/operating-model.md",
                "docs/week-01-plan.md", "evaluation/README.md",
                "evaluation/cases.csv", "evaluation/runs.csv", "assets/hero.png",
                "reports/workflow-standards-v0.1.pdf"]
    for group in ("notes", "company-analysis"):
        required += [f"workflows/{group}/{name}.md" for name in
                     ("README", "sop", "prd", "map-of-work")]
    for name in required:
        if not (ROOT / name).is_file():
            errors.append(f"Missing: {name}")
    for path in ROOT.rglob("*.md"):
        if ".git" in path.parts:
            continue
        text = re.sub(r"```.*?```", "", path.read_text(encoding="utf-8"), flags=re.S)
        for target in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", text):
            target = target.strip().split(' "', 1)[0].strip("<>")
            url = urlsplit(target)
            if url.scheme or target.startswith(("#", "//")) or not url.path:
                continue
            dest = (path.parent / unquote(url.path)).resolve()
            if not dest.exists():
                errors.append(f"Broken link: {path.relative_to(ROOT)} -> {target}")
    for group, prefix, count in (("notes", "N", 12), ("company-analysis", "B", 14)):
        for filename, ids in (("sop", [f"{prefix}{i:02}" for i in range(1, count + 1)]),
                              ("prd", [f"PRD-{prefix}-{i:02}" for i in range(1, 13)])):
            path = ROOT / "workflows" / group / f"{filename}.md"
            text = path.read_text(encoding="utf-8") if path.exists() else ""
            for item in ids:
                if not re.search(r"(?<![A-Z0-9-])" + re.escape(item) + r"(?![0-9])", text):
                    errors.append(f"Missing ID: {path.relative_to(ROOT)} {item}")
    pdf = ROOT / "reports/workflow-standards-v0.1.pdf"
    if pdf.exists() and not pdf.read_bytes().startswith(b"%PDF-"):
        errors.append("Invalid PDF header")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("PASS: required files, relative document links, 26 SOP stages and 24 PRD IDs")
    print("Structural validation only; practitioner acceptance and business quality remain unmeasured.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
