"""Build a small public catalog from the deployed GameVault gallery proxy."""
import json
import re
from urllib.request import Request, urlopen

PROXY = "https://gamevault.pcenthusiast.blog/gallery-api"
CATALOG = f"{PROXY}/api/games?limit=24"
MEDIA = f"{PROXY}/api/media/"
MAX_BYTES = 2 * 1024 * 1024
MAX_CARDS = 12
MEDIA_URL = re.compile(re.escape(MEDIA) + r"[A-Za-z0-9_-]{1,80}")


def clean_text(value, limit):
    if not isinstance(value, str):
        return ""
    text = " ".join(value.split())
    if len(text) > limit:
        return text[:limit - 1].rstrip() + "…"
    return text


def public_cards(payload):
    if isinstance(payload, dict):
        payload = next(
            (payload[key] for key in ("items", "data", "games") if isinstance(payload.get(key), list)),
            [],
        )
    if not isinstance(payload, list):
        return []

    cards = []
    seen = set()
    for item in payload:
        if not isinstance(item, dict):
            continue
        metadata = item.get("metadata")
        metadata = metadata if isinstance(metadata, dict) else {}
        title = clean_text(metadata.get("title"), 100) or clean_text(item.get("title"), 100)
        description = clean_text(metadata.get("description") or item.get("description"), 180)
        cover_url = item.get("coverUrl")
        if cover_url is None:
            cover = metadata.get("cover")
            media_id = str(cover.get("id", "")) if isinstance(cover, dict) else ""
            if re.fullmatch(r"[0-9]{1,20}", media_id):
                cover_url = MEDIA + media_id
        if not title or not isinstance(cover_url, str) or not MEDIA_URL.fullmatch(cover_url):
            continue
        if cover_url in seen:
            continue
        seen.add(cover_url)
        cards.append({"title": title, "description": description, "coverUrl": cover_url})
        if len(cards) == MAX_CARDS:
            break
    return cards


def fetch_public_cards():
    request = Request(CATALOG, headers={
        "Accept": "application/json",
        "User-Agent": "GameVaultJoiner",
    })
    with urlopen(request, timeout=8) as response:
        if response.geturl() != CATALOG or response.headers.get_content_type() != "application/json":
            return []
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        return []
    return public_cards(json.loads(raw))
