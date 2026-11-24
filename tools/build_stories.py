#!/usr/bin/env python3
"""Builds the story pages for Facebook posts.

Each story is a short text file in stories/_src/ (see stories/_src/README.md
for the format). For each one this writes:

  stories/<slug>/index.html   the full story, one photo, and Tommy Stories'
                              offer underneath (not linked anywhere on the
                              site, and kept out of search engines)
  stories/<slug>/photo.jpg    the photo, resized for the web (if there is one)

and rewrites the short links in _redirects, so that

  https://tommystories.com/s/<slug>

opens the story with Google Analytics tags already on it
(utm_source=facebook, utm_medium=social, utm_campaign=<slug>).

The site header and footer are copied from the home page each time, so
rebuilding picks up any change to them.

Usage:
  python3 tools/build_stories.py            build every story
  python3 tools/build_stories.py mga        build one story (by slug)
  python3 tools/build_stories.py --check    report problems, write nothing

Needs Python 3.9+ and Pillow (for photos).
"""

from __future__ import annotations

import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "stories" / "_src"
OUT = ROOT / "stories"
SITE = "https://tommystories.com"
GA_ID = "G-FNPRVNVL46"
CSS_VERSION_RE = re.compile(r"/assets/styles\.css\?v=[0-9a-z]+")

# Paths the short links must never shadow (pages and links that already exist).
RESERVED = {"join", "gift", "friend", "share", "write", "about", "questions", "terms",
            "privacy", "welcome", "order-form", "manage", "subscribe", "assets", "stories"}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MARKER = "~~~"  # in a story file: where the Facebook half ends

REDIRECTS_BEGIN = "# BEGIN story links (written by tools/build_stories.py; don't edit by hand)"
REDIRECTS_END = "# END story links"


class StoryError(Exception):
    pass


def esc(text: str) -> str:
    return html.escape(text, quote=True)


# ---------- Reading a story file ----------

def read_story(path: Path) -> dict:
    """Settings lines ("title: ...") up to a line with just ---, then the
    story: one paragraph per line (blank lines are ignored), and an optional
    line with just ~~~ where the Facebook half ends."""
    raw = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    if "\n---\n" not in raw:
        raise StoryError(f"{path.name}: needs a line with just --- between the settings and the story")
    head, body = raw.split("\n---\n", 1)
    settings = {}
    for line in head.split("\n"):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = re.match(r"^\s*([a-z_]+)\s*:\s*(.*?)\s*$", line)
        if not m:
            raise StoryError(f"{path.name}: can't read the setting line {line!r}")
        settings[m.group(1)] = m.group(2)

    slug = settings.get("slug") or path.stem
    if not SLUG_RE.match(slug):
        raise StoryError(f"{path.name}: slug {slug!r} must be lowercase letters, numbers and dashes")
    if slug in RESERVED:
        raise StoryError(f"{path.name}: slug {slug!r} is already used by the website")
    if not settings.get("title"):
        raise StoryError(f"{path.name}: missing title:")

    before, after, seen_marker = [], [], False
    for line in body.split("\n"):
        text = line.strip()
        if not text:
            continue
        if text == MARKER:
            if seen_marker:
                raise StoryError(f"{path.name}: only one {MARKER} line, please")
            seen_marker = True
            continue
        (after if seen_marker else before).append(text)
    if not before:
        raise StoryError(f"{path.name}: the story is empty")

    image = settings.get("image", "")
    if image and not (SRC / "images" / image).is_file():
        raise StoryError(f"{path.name}: photo {image!r} isn't in stories/_src/images/")
    if image and not settings.get("image_alt"):
        raise StoryError(f"{path.name}: add image_alt: (a short description of the photo, for readers who can't see it)")

    return {
        "file": path.name,
        "slug": slug,
        "title": settings["title"],
        "date": settings.get("date", ""),
        "image": image,
        "image_alt": settings.get("image_alt", ""),
        "credit": settings.get("credit", ""),
        "source": settings.get("source", ""),
        "description": settings.get("description", ""),
        "before": before,
        "after": after,
        "split": seen_marker,
    }


# ---------- Pieces copied from the home page ----------

def site_parts() -> dict:
    home = (ROOT / "index.html").read_text(encoding="utf-8")

    def between(start: str, end: str) -> str:
        a = home.index(start)
        b = home.index(end, a) + len(end)
        return home[a:b]

    header = between('  <a class="skip-link"', "  </header>")
    header = header.replace(' aria-current="page"', "")
    footer = between('  <footer class="site-footer">', "  </footer>")
    envelope = between('<svg class="envelope"', "          </svg>")
    css = CSS_VERSION_RE.search(home)
    menu = re.search(r'<script src="/assets/menu\.js\?v=[0-9a-z]+" defer></script>', home)
    if not css or not menu:
        raise StoryError("couldn't find the stylesheet or menu script on the home page")
    return {"header": header, "footer": footer, "envelope": envelope,
            "css": css.group(0), "menu": menu.group(0)}


# ---------- The photo ----------

def make_photo(story: dict, out_dir: Path) -> tuple[int, int] | None:
    if not story["image"]:
        return None
    from PIL import Image, ImageOps  # only needed when a story has a photo

    with Image.open(SRC / "images" / story["image"]) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((1400, 1400))
        out_dir.mkdir(parents=True, exist_ok=True)
        im.save(out_dir / "photo.jpg", "JPEG", quality=82, optimize=True, progressive=True)
        return im.size


# ---------- The page ----------

def describe(story: dict) -> str:
    if story["description"]:
        return story["description"]
    text = " ".join(story["before"])
    if len(text) <= 160:
        return text
    cut = text[:157].rsplit(" ", 1)[0]
    return cut.rstrip(",;:") + "..."


def render(story: dict, parts: dict, photo_size: tuple[int, int] | None) -> str:
    slug = story["slug"]
    url = f"{SITE}/stories/{slug}/"
    title = story["title"]
    description = describe(story)
    share_url = f"{url}?utm_source=facebook&utm_medium=share&utm_campaign={slug}"
    fb_share = "https://www.facebook.com/sharer/sharer.php?u=" + re.sub(
        r"[^A-Za-z0-9._~-]", lambda m: "%%%02X" % ord(m.group(0)), share_url)

    if photo_size:
        og_image = f"{url}photo.jpg"
        og_size = f'\n  <meta property="og:image:width" content="{photo_size[0]}">\n  <meta property="og:image:height" content="{photo_size[1]}">'
        og_alt = story["image_alt"]
    else:
        og_image = f"{SITE}/assets/share-preview.png"
        og_size = '\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">'
        og_alt = "Tommy Stories: car stories that touch life, family, and faith."

    paragraphs = [f"          <p>{esc(p)}</p>" for p in story["before"]]
    if story["split"]:
        paragraphs.append(
            '          <p class="story-left-off" id="left-off"><span>You left off on Facebook here</span></p>')
        paragraphs += [f"          <p>{esc(p)}</p>" for p in story["after"]]
    body = "\n".join(paragraphs)

    jump = ('\n        <p class="story-jump"><a href="#left-off">Coming from Facebook? '
            'Skip to where you left off</a></p>') if story["split"] else ""

    photo = ""
    if photo_size:
        credit = f"\n          <figcaption>{esc(story['credit'])}</figcaption>" if story["credit"] else ""
        photo = (f'\n        <figure class="story-photo">\n'
                 f'          <img src="photo.jpg" width="{photo_size[0]}" height="{photo_size[1]}" '
                 f'alt="{esc(story["image_alt"])}">{credit}\n        </figure>')

    source = f'\n        <p class="story-source">{esc(story["source"])}</p>' if story["source"] else ""

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Google Analytics (see README, "Google Analytics") -->
  <script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', '{GA_ID}');
  </script>
  <title>{esc(title)} | Tommy Stories</title>
  <meta name="robots" content="noindex">
  <meta name="description" content="{esc(description)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Tommy Stories">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{og_image}">{og_size}
  <meta property="og:image:alt" content="{esc(og_alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <meta name="theme-color" content="#004185">
  <link rel="preload" href="/assets/fonts/bodoni-moda-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/libre-caslon-text-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="{parts['css']}">
</head>
<body class="story-page" data-story="{slug}">
  <!-- A story page for a Facebook post (tools/build_stories.py, from
       stories/_src/{story['file']}). Not linked anywhere on the site. -->
{parts['header']}

  <main id="main">
    <article class="story">
      <div class="wrap story-wrap">
        <p class="story-kicker">A true story, retold by Tommy Stories</p>
        <h1>{esc(title)}</h1>{jump}{photo}
        <div class="story-body">
{body}
        </div>{source}
        <p class="story-end" aria-hidden="true"><span></span></p>
      </div>
    </article>

    <section class="section section--wash story-offer" id="tommy-stories" aria-labelledby="offer-title">
      <div class="wrap story-offer-grid">
        <div class="story-offer-text">
          <h2 id="offer-title">Four true stories like this one, in your mailbox every month</h2>
          <p class="lead">Tommy Stories is a large-print booklet of true car stories from real people, about the life, family and faith those cars carried. A new issue comes in the mail every month.</p>
          <ul class="check-list">
            <li>Four true stories, in large, easy-to-read print</li>
            <li>A Note from Tommy, Do You Remember?, Name That Car and a puzzle page</li>
            <li>A little surprise from Tommy in every envelope</li>
            <li>No outside advertisements, ever</li>
          </ul>
          <p class="price-line">$14.99 a month or $169.99 a year, shipping included.</p>
          <div class="actions">
            <a class="button button--primary" href="/join/">Start my subscription</a>
            <a class="button button--secondary" href="/gift/">Give it as a gift</a>
          </div>
        </div>
        <figure class="hero-art story-offer-art">
          {parts['envelope']}
        </figure>
      </div>
    </section>

    <section class="section story-more" aria-label="More from Tommy Stories">
      <div class="wrap story-more-grid">
        <div class="story-card">
          <h2>Have a car story of your own?</h2>
          <p>The stories in every issue come from readers. It doesn't have to be about the car; it only needs a car somewhere in it.</p>
          <a class="button button--secondary" href="/share/">Share your story</a>
        </div>
        <div class="story-card">
          <h2>Know someone who'd love this story?</h2>
          <p>Pass it along to a friend, or share it on Facebook.</p>
          <div class="story-share">
            <a class="button button--secondary" href="{esc(fb_share)}" target="_blank" rel="noopener">Share on Facebook</a>
            <button class="button button--secondary" type="button" data-copy-link="{url}">Copy the link</button>
          </div>
          <p class="story-share-status" role="status" aria-live="polite"></p>
        </div>
      </div>
    </section>
  </main>

{parts['footer']}

  <!-- Phones only: Subscribe and Give a gift stay at the bottom of the screen
       once the reader is into the story (assets/story.js). -->
  <div class="sticky-cta" data-sticky-cta>
    <a class="button button--primary" href="/join/">Subscribe</a>
    <a class="button button--secondary" href="/gift/">Give a gift</a>
  </div>
  {parts['menu']}
  <script src="/assets/story.js?v=20261123" defer></script>
</body>
</html>
"""


# ---------- Short links ----------

def write_redirects(stories: list[dict]) -> None:
    path = ROOT / "_redirects"
    text = path.read_text(encoding="utf-8")
    lines = [REDIRECTS_BEGIN,
             "# tommystories.com/s/<slug> opens the story with Google Analytics tags on it."]
    for s in sorted(stories, key=lambda s: s["slug"]):
        lines.append(f"/s/{s['slug']}  /stories/{s['slug']}/?utm_source=facebook&utm_medium=social&utm_campaign={s['slug']}  302")
    lines.append(REDIRECTS_END)
    block = "\n".join(lines)
    if REDIRECTS_BEGIN in text:
        start = text.index(REDIRECTS_BEGIN)
        end = text.index(REDIRECTS_END, start) + len(REDIRECTS_END)
        text = text[:start] + block + text[end:]
    else:
        anchor = "# Behind-the-scenes files in the repo aren't pages; don't serve them."
        text = text.replace(anchor, block + "\n\n" + anchor, 1)
    path.write_text(text, encoding="utf-8")


# ---------- Main ----------

def main(argv: list[str]) -> int:
    check_only = "--check" in argv
    wanted = [a for a in argv if not a.startswith("--")]
    files = sorted(p for p in SRC.glob("*.txt") if p.name.lower() != "readme.txt")
    stories, problems = [], []
    for f in files:
        try:
            stories.append(read_story(f))
        except StoryError as e:
            problems.append(str(e))
    seen = {}
    for s in stories:
        if s["slug"] in seen:
            problems.append(f"{s['file']}: slug {s['slug']!r} is also used by {seen[s['slug']]}")
        seen[s["slug"]] = s["file"]
    if problems:
        print("Problems:\n  " + "\n  ".join(problems))
        return 1
    if check_only:
        print(f"{len(stories)} stories, no problems")
        return 0

    parts = site_parts()
    built = []
    for s in stories:
        if wanted and s["slug"] not in wanted:
            continue
        out_dir = OUT / s["slug"]
        out_dir.mkdir(parents=True, exist_ok=True)
        size = make_photo(s, out_dir)
        if not size and (out_dir / "photo.jpg").exists():
            (out_dir / "photo.jpg").unlink()
        (out_dir / "index.html").write_text(render(s, parts, size), encoding="utf-8")
        built.append(s)
    write_redirects(stories)
    for s in built:
        print(f"{s['slug']}: {SITE}/s/{s['slug']}  (page: /stories/{s['slug']}/)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
