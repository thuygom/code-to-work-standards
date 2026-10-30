#!/usr/bin/env python3
"""Package only public website assets; no dependencies or network requests."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]

def main():
    target = ROOT / 'dist'
    target.mkdir(exist_ok=True)
    for name in ('index.html', 'style.css', 'app.mjs', 'contribution.mjs', 'favicon.svg'):
        shutil.copy2(ROOT / 'website' / name, target / name)
    assets = target / 'assets'
    assets.mkdir(exist_ok=True)
    shutil.copy2(ROOT / 'assets/hero.png', assets / 'hero.png')
    for name in ('NanumGothic-Regular.ttf', 'NanumGothic-Bold.ttf', 'OFL.txt'):
        shutil.copy2(ROOT / 'reports/tex/fonts' / name, assets / name)
    (target / 'robots.txt').write_text('User-agent: *\nAllow: /\n', encoding='utf-8')
    print('Built dist/: website, original illustration, local fonts and font license.')

if __name__ == '__main__':
    main()
