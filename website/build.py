"""Stage only the files served by the download website."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parent
output = root / "dist"
output.mkdir(exist_ok=True)
for name in ("index.html", "style.css", "main.mjs"):
    shutil.copyfile(root / name, output / name)
