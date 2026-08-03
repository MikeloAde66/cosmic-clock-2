import html
import re
import feedparser
from datetime import datetime
from supabase import create_client, Client

# --- CONFIGURATION ---
SUPABASE_URL = "https://fvktqmcuqgasljcgkojd.supabase.co"
import os

# Masked or retrieved via environment variable instead of hardcoding
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "YOUR_KEY_HERE")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Topic Taxonomy Rules
TAXONOMY_RULES = {
    "Gnostic Studies": [
        "gnostic", "gnosticism", "nag hammadi", "gospel of thomas", 
        "gospel of philip", "pistis sophia", "demiurge", "archon", "sophia"
    ],
    "Precession & Archaeoastronomy": [
        "precession", "equinox", "great year", "axial precession", 
        "zodiacal", "solstice", "dendera zodiac"
    ],
    "Antediluvian & Cataclysmic History": [
        "pre-flood", "antediluvian", "younger dryas", "megalithic", 
        "atlantis", "cataclysm", "gobekli tepe", "gunung padang"
    ],
    "Ancient Cosmology & Hermeticism": [
        "hermetica", "corpus hermeticum", "sacred geometry", 
        "as above so below", "monad", "emerald tablet"
    ]
}

def classify_content(title: str, summary: str):
    combined = f"{title} {summary}".lower()
    matched = set()
    scores = {cat: 0 for cat in TAXONOMY_RULES}

    for cat, keywords in TAXONOMY_RULES.items():
        for kw in keywords:
            if re.search(rf"\b{re.escape(kw)}\b", combined):
                scores[cat] += 1
                matched.add(kw)

    best_category = max(scores, key=lambda k: scores[k])
    if scores[best_category] == 0:
        best_category = "Public Lectures & Archives"

    return best_category, list(matched)

def ingest_podcast(rss_url: str):
    print(f"📡 Fetching feed: {rss_url}")
    feed = feedparser.parse(rss_url)
    show_title = feed.feed.get("title", "Unknown Show")

    for entry in feed.entries:
        # Extract audio stream
        media_url = None
        if hasattr(entry, 'enclosures') and len(entry.enclosures) > 0:
            media_url = entry.enclosures[0].get('href')

        if not media_url:
            continue

        title = entry.get('title', 'Untitled Episode')
        summary = entry.get('summary') or entry.get('description') or ""
        summary_text = html.unescape(summary)
        clean_summary = re.sub(r'<[^<]+?>', '', summary_text).replace('\xa0', ' ').replace('&nbsp;', ' ').strip()

        category, keywords = classify_content(title, clean_summary)

        pub_date = None
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            pub_date = datetime(*entry.published_parsed[:6]).isoformat()

        payload = {
            "category": category,
            "content_type": "podcast_episode",
            "title": title,
            "content": clean_summary,
            "media_url": media_url,
            "rss_feed_url": rss_url,
            "published_at": pub_date,
            "speaker_or_host": entry.get("author", show_title),
            "references_list": keywords,
            "raw_keywords": keywords,
            "metadata": {"show_title": show_title}
        }

        try:
            supabase.table("media_archives").upsert(payload, on_conflict="media_url").execute()
            print(f"  ✅ Saved: {title[:40]}... [{category}]")
        except Exception as e:
            print(f"  ❌ Error: {e}")

if __name__ == "__main__":
    # Test with any feed URL
    ingest_podcast("https://www.nasa.gov/rss/dyn/curious-universe.rss")