#!/usr/bin/env python3
"""Check document links and required work-standard IDs; not semantic validation."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys
from workflow_registry import load_workflows

ROOT = Path(__file__).resolve().parents[1]

def main():
    errors = []
    try:
        workflows = load_workflows()
    except (OSError, ValueError) as exc:
        print(f"Invalid workflow registry: {exc}", file=sys.stderr)
        return 1
    required = ["README.md", "README.en.md", "CONTRIBUTING.md", "LICENSE",
                "docs/pdf-reading-guide.md", "docs/operating-model.md",
                "docs/week-01-plan.md", "evaluation/README.md",
                "evaluation/cases.csv", "evaluation/runs.csv", "assets/hero.png",
                "reports/workflow-standards-v0.1.pdf"]
    for workflow in workflows:
        group = workflow['slug']
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
    for workflow in workflows:
        group, prefix = workflow['slug'], workflow['prefix']
        for filename, ids in (("sop", [f"{prefix}{i:02}" for i in range(1, workflow['sop_stages'] + 1)]),
                              ("prd", [f"PRD-{prefix}-{i:02}" for i in range(1, workflow['prd_requirements'] + 1)])):
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
    stages = sum(item['sop_stages'] for item in workflows)
    requirements = sum(item['prd_requirements'] for item in workflows)
    print(f"PASS: required files, relative document links, {stages} SOP stages and {requirements} PRD IDs")
    print("Structural validation only; practitioner acceptance and business quality remain unmeasured.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
