#!/usr/bin/env python3
import subprocess
from pathlib import Path
from PIL import Image

OUT = Path("/workspace/candidates_preview")
CHROME = "google-chrome"
PAGES = [
    "01-candidates-list.html",
    "02-candidate-record.html",
    "03-add-candidate.html",
    "04-interviews.html",
    "05-overview.html",
    "06-employers-list.html",
    "06b-vacancies-list.html",
    "07-employer-record.html",
    "08-activity-calendar.html",
    "09-actions.html",
    "10-reports.html",
    "11-due-for-review.html",
    "11b-delete-confirm.html",
    "12-inductions.html",
]

NAVY = (20, 24, 51)  # #141833 approximately

def close(a, b, tol=12):
    return all(abs(x - y) <= tol for x, y in zip(a, b))

def screenshot(html: Path, png: Path):
    tmp = png.with_suffix(".raw.png")
    url = html.resolve().as_uri()
    cmd = [
        CHROME,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=8000",
        "--window-size=1280,5000",
        f"--screenshot={tmp}",
        url,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout)
        print(r.stderr)
        raise SystemExit(f"chrome failed for {html.name}")
    im = Image.open(tmp).convert("RGB")
    w, h = im.size
    print(f"  raw {html.name}: {w}x{h}")
    # Find last navy pixel in the sidebar column (x=20 to x=40)
    last = 0
    px = im.load()
    for y in range(h - 1, -1, -1):
        # sample a few x positions in the sidebar
        if any(close(px[x, y], NAVY) for x in (8, 24, 40, 80, 140)):
            last = y
            break
    if last < 200:
        # fallback: last non-page-background in content area
        page = (245, 246, 248)
        for y in range(h - 1, -1, -1):
            if any(not close(px[x, y], page, tol=8) for x in range(300, 1200, 20)):
                last = y
                break
    crop_h = min(h, last + 24)
    cropped = im.crop((0, 0, 1280, crop_h))
    cropped.save(png, "PNG", optimize=True)
    tmp.unlink(missing_ok=True)
    print(f"  saved {png.name}: {cropped.size[0]}x{cropped.size[1]}")

def render_all():
    for name in PAGES:
        html = OUT / name
        png = OUT / name.replace(".html", ".png")
        print(f"rendering {name}")
        screenshot(html, png)


if __name__ == "__main__":
    render_all()
