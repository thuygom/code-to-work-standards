#!/usr/bin/env bash
set -eu
repo_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$repo_dir/reports/tex"
xelatex -interaction=nonstopmode -halt-on-error main.tex
xelatex -interaction=nonstopmode -halt-on-error main.tex
printf '%s\n' 'Built reports/tex/main.pdf. Review the rendered pages before publishing a new version.'
