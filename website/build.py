"""Stage only the files served by the download website."""
import argparse
from http.client import HTTPException
import json
from pathlib import Path
import shutil

from gallery import fetch_public_cards

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--refresh-gallery", action="store_true", help="Fetch public game metadata for the cover rails.")
args = parser.parse_args()

root = Path(__file__).resolve().parent
output = root / "dist"
output.mkdir(exist_ok=True)
for name in ("index.html", "style.css", "main.mjs"):
    shutil.copyfile(root / name, output / name)
shutil.copyfile(root.parent / "docs" / "images" / "joiner-arcade.png", output / "joiner-arcade.png")

cards = []
if args.refresh_gallery:
    try:
        cards = fetch_public_cards()
    except (HTTPException, OSError, ValueError):
        pass
    print(f"Staged {len(cards)} gallery cards." if cards else "Public gallery unavailable. The site will show example covers.")
(output / "gallery.json").write_text(json.dumps(cards, ensure_ascii=False), encoding="utf-8")
