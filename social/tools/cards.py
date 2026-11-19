"""Picture cards for Facebook posts, in the booklet's navy and gold.

Every card is 1080 x 1350 (Facebook's tallest feed size, and fine on
Instagram). Describe the card in a small JSON file and run:

    python3 social/tools/cards.py social/cards/2026-11-26-0900-name-that-car.json

The picture is saved in social/posts/images/ under the "out" name. Kinds:

  name-that-car   clues worth 3, 2 and 1 points, over a car under a cover
                  {"card": "name-that-car", "out": "x.png",
                   "clues": [[3, "..."], [2, "..."], [1, "..."]]}
  answer          the Name That Car answer, with facts
                  {"card": "answer", "out": "x.png", "answer": "Chevrolet Corvair",
                   "years": "Built 1960 to 1969", "facts": ["...", "...", "..."],
                   "ask": "Did your family have a Corvair? Tell us about it in the comments."}
  question        one big question to get comments
                  {"card": "question", "out": "x.png", "question": "What was the first car you ever drove?",
                   "kicker": "Tell us in the comments"}
  remember        Do You Remember? prices or facts from one year
                  {"card": "remember", "out": "x.png", "year": "1965",
                   "rows": [["A new Ford Mustang", "$2,368"], ["A gallon of gas", "31 cents"]],
                   "ask": "What did you pay for your first car?"}
  quote           a few lines from a printed story
                  {"card": "quote", "out": "x.png", "quote": "...",
                   "byline": "Harold B., Ohio", "title": "The Christmas We Got Stuck"}

Text can use <i>...</i> for titles. Keep it short: these are read on phones
by people who like large print. The script warns if anything runs into the
footer; shorten the text if it does.

Needs Python's Playwright (installed in Claude's workspace).
"""
import html
import json
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
FONTS_DIR = ROOT / "assets" / "fonts"
OUT_DIR = ROOT / "social" / "posts" / "images"

NAVY, GOLD, GOLD_DEEP, CREAM = "#004185", "#D4B06A", "#A8833B", "#F4EBD6"


def fonts():
    f = lambda name: (FONTS_DIR / name).as_uri()
    return f"""
@font-face {{ font-family: "Bodoni Moda"; src: url("{f('bodoni-moda-latin-800-normal.woff2')}"); font-weight: 800; }}
@font-face {{ font-family: "Libre Caslon Text"; src: url("{f('libre-caslon-text-latin-400-normal.woff2')}"); font-weight: 400; }}
@font-face {{ font-family: "Libre Caslon Text"; src: url("{f('libre-caslon-text-latin-700-normal.woff2')}"); font-weight: 700; }}
@font-face {{ font-family: "Libre Caslon Text"; src: url("{f('libre-caslon-text-latin-400-italic.woff2')}"); font-style: italic; }}
@font-face {{ font-family: "Yellowtail"; src: url("{f('yellowtail-latin-400-normal.woff2')}"); }}
"""


CSS = """
html, body { margin: 0; width: 1080px; height: 1350px; overflow: hidden; }
body {
  position: relative; box-sizing: border-box; padding: 64px 84px 0;
  background: #004185 repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 4px, transparent 4px 13px);
  color: #fff; font-family: "Libre Caslon Text", Georgia, serif;
}
.frame { position: absolute; inset: 26px; border: 3px solid #D4B06A; pointer-events: none; }
.brand { margin: 0; text-align: center; font-weight: 700; font-size: 24px; letter-spacing: 0.32em; color: #D4B06A; }
h1 { margin: 12px 0 0; text-align: center; font: 800 112px/1 "Bodoni Moda", Didot, serif; }
.day { margin: -10px 0 0; text-align: center; font: 104px/1 "Yellowtail", cursive; color: #D4B06A; transform: rotate(-4deg); }
.art { display: block; width: 912px; height: auto; margin: 0; }
.clues { margin: 8px 0 0; padding: 0; list-style: none; }
.clues li { display: grid; grid-template-columns: 112px 1fr; gap: 26px; align-items: center; padding: 15px 0; border-top: 2px solid rgba(212,176,106,0.55); }
.pts { width: 104px; height: 104px; border-radius: 50%; background: #D4B06A; color: #004185; text-align: center; }
.pts b { display: block; padding-top: 10px; font: 800 52px/1 "Bodoni Moda", serif; }
.pts span { display: block; font-size: 17px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.clues p { margin: 0; font-size: 37px; line-height: 1.28; }
.foot { position: absolute; left: 84px; right: 84px; bottom: 64px; padding-top: 22px; border-top: 3px solid #D4B06A; text-align: center; }
.foot p { margin: 0; font-style: italic; font-size: 38px; color: #F4EBD6; }
.foot .site { margin-top: 8px; font-style: normal; font-weight: 700; font-size: 28px; letter-spacing: 0.06em; color: #fff; }
.label { margin: 24px 0 0; text-align: center; font-weight: 700; font-size: 28px; letter-spacing: 0.24em; text-transform: uppercase; color: #D4B06A; }
.answer { margin: 14px 0 0; text-align: center; font: 800 96px/1.05 "Bodoni Moda", Didot, serif; }
.years { margin: 16px 0 0; text-align: center; font-style: italic; font-size: 40px; color: #F4EBD6; }
.facts { margin: 26px 0 0; padding: 0; list-style: none; }
.facts li { position: relative; padding: 14px 0 14px 52px; border-top: 2px solid rgba(212,176,106,0.55); font-size: 38px; line-height: 1.3; }
.facts li::before { content: ""; position: absolute; left: 6px; top: 30px; width: 18px; height: 18px; border-radius: 50%; background: #D4B06A; }
.ask { margin: 22px 0 0; padding: 18px 28px; border: 3px dashed #D4B06A; border-radius: 14px; background: rgba(0,0,0,0.12); text-align: center; font-style: italic; font-size: 38px; line-height: 1.3; color: #F4EBD6; }

/* question */
.q-body { position: absolute; left: 84px; right: 84px; top: 150px; bottom: 260px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
.q-icon { width: 260px; height: auto; margin-bottom: 40px; }
.q-kicker { margin: 0 0 22px; font-weight: 700; font-size: 30px; letter-spacing: 0.22em; text-transform: uppercase; color: #D4B06A; }
.q-text { margin: 0; font: 800 88px/1.12 "Bodoni Moda", Didot, serif; }

/* remember */
.year { margin: 6px 0 0; text-align: center; font: 150px/1 "Yellowtail", cursive; color: #D4B06A; transform: rotate(-4deg); }
.rows { margin: 34px 0 0; padding: 0; list-style: none; }
.rows li { display: flex; justify-content: space-between; align-items: baseline; gap: 24px; padding: 18px 0; border-top: 2px solid rgba(212,176,106,0.55); font-size: 40px; line-height: 1.25; }
.rows li b { flex: none; font: 800 54px/1 "Bodoni Moda", serif; color: #D4B06A; }

/* quote */
.mark { margin: 0 0 -60px; text-align: center; font: 800 260px/1 "Bodoni Moda", serif; color: #D4B06A; }
.quote { margin: 0; text-align: center; font-style: italic; font-size: 50px; line-height: 1.32; }
.by { margin: 40px 0 0; text-align: center; font-weight: 700; font-size: 32px; letter-spacing: 0.12em; text-transform: uppercase; color: #D4B06A; }
.from { margin: 10px 0 0; text-align: center; font-style: italic; font-size: 34px; color: #F4EBD6; }
"""

# A car under a cover, on the road, with a big question mark (the same flat
# style as the booklet cover: cream shapes, navy lines, gold accents).
MYSTERY = """
<svg class="art" viewBox="0 0 912 360" aria-hidden="true">
  <rect x="0" y="292" width="912" height="56" fill="#001d3d"/>
  <path d="M0 292H912M0 348H912" stroke="#F4EBD6" stroke-width="3"/>
  <line x1="0" y1="320" x2="912" y2="320" stroke="#D4B06A" stroke-width="5" stroke-dasharray="34 26"/>
  <ellipse cx="456" cy="300" rx="380" ry="16" fill="#000d1c" opacity="0.55"/>
  <circle cx="246" cy="282" r="44" fill="#0b1626" stroke="#F4EBD6" stroke-width="3"/>
  <circle cx="676" cy="282" r="44" fill="#0b1626" stroke="#F4EBD6" stroke-width="3"/>
  <circle cx="246" cy="282" r="16" fill="#3b4a60"/>
  <circle cx="676" cy="282" r="16" fill="#3b4a60"/>
  <path d="M86 262 C 80 222, 92 196, 130 186 C 190 172, 250 168, 300 162 C 330 120, 360 92, 412 86
           L 560 84 C 612 88, 640 118, 668 158 C 728 162, 790 170, 822 184 C 846 196, 852 228, 846 262
           C 826 274, 810 262, 790 272 C 770 282, 750 266, 724 274 L 724 262 C 724 226, 628 226, 628 262
           L 628 274 C 560 266, 520 282, 456 274 C 392 266, 352 282, 294 274 L 294 262
           C 294 226, 198 226, 198 262 L 198 274 C 170 266, 150 282, 126 272 C 108 266, 96 276, 86 262 Z"
        fill="#F4EBD6" stroke="#16223A" stroke-width="4" stroke-linejoin="round"/>
  <g fill="none" stroke="#C9BFA7" stroke-width="4" stroke-linecap="round">
    <path d="M300 162 C 320 190, 330 220, 326 262"/><path d="M668 158 C 650 190, 640 222, 646 252"/>
    <path d="M140 200 C 170 214, 186 236, 190 256"/><path d="M800 196 C 776 210, 760 232, 752 256"/>
    <path d="M420 92 C 430 110, 436 130, 434 150"/>
  </g>
  <circle cx="486" cy="186" r="70" fill="#D4B06A" stroke="#A8833B" stroke-width="4"/>
  <text x="486" y="226" text-anchor="middle" font-family="Bodoni Moda, Didot, serif" font-weight="800" font-size="112" fill="#004185">?</text>
</svg>
"""

# A speech-bubble envelope for question cards.
ENVELOPE = """
<svg class="q-icon" viewBox="0 0 260 180" aria-hidden="true">
  <rect x="6" y="6" width="248" height="150" rx="12" fill="#F4EBD6" stroke="#16223A" stroke-width="5"/>
  <path d="M14 18 L130 98 L246 18" fill="none" stroke="#16223A" stroke-width="5" stroke-linejoin="round"/>
  <rect x="196" y="26" width="40" height="46" fill="#D4B06A" stroke="#A8833B" stroke-width="3"/>
  <path d="M40 156 L30 178 L70 156" fill="#F4EBD6" stroke="#16223A" stroke-width="5" stroke-linejoin="round"/>
</svg>
"""


def text(value):
    """Escapes text, keeping <i>...</i> for titles."""
    return html.escape(str(value), quote=False).replace("&lt;i&gt;", "<i>").replace("&lt;/i&gt;", "</i>")


def page(body, foot, site=True):
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>{fonts()}{CSS}</style></head>
<body>
<div class="frame"></div>
<p class="brand">TOMMY STORIES</p>
{body}
<div class="foot">
  <p>{text(foot)}</p>
  {'<p class="site">TOMMYSTORIES.COM</p>' if site else ''}
</div>
</body></html>"""


def name_that_car(spec):
    clues = "\n".join(
        f'<li><div class="pts"><b>{pts}</b><span>point{"s" if int(pts) > 1 else ""}</span></div><p>{text(clue)}</p></li>'
        for pts, clue in spec["clues"])
    return page(f'<h1>Name That Car</h1>\n<p class="day">{text(spec.get("day", "Thursday"))}</p>\n{MYSTERY}\n<ul class="clues">{clues}</ul>',
                spec.get("foot", "Comment your guess! Answer tomorrow."))


def answer(spec):
    facts = "".join(f"<li>{text(f)}</li>" for f in spec.get("facts", []))
    ask = f'<p class="ask">{text(spec["ask"])}</p>' if spec.get("ask") else ""
    return page(f'<h1>Name That Car</h1>\n<p class="label">The answer</p>\n<p class="answer">{text(spec["answer"])}</p>\n'
                f'<p class="years">{text(spec.get("years", ""))}</p>\n<ul class="facts">{facts}</ul>\n{ask}',
                spec.get("foot", "How many points did you score?"))


def question(spec):
    return page(f'<div class="q-body">{ENVELOPE}<p class="q-kicker">{text(spec.get("kicker", "Tell us in the comments"))}</p>'
                f'<p class="q-text">{text(spec["question"])}</p></div>',
                spec.get("foot", "True car stories in your mailbox every month."))


def remember(spec):
    rows = "".join(f"<li><span>{text(a)}</span><b>{text(b)}</b></li>" for a, b in spec["rows"])
    ask = f'<p class="ask">{text(spec["ask"])}</p>' if spec.get("ask") else ""
    return page(f'<h1>Do You Remember?</h1>\n<p class="year">{text(spec["year"])}</p>\n<ul class="rows">{rows}</ul>\n{ask}',
                spec.get("foot", "Prices are averages for that year."))


def quote(spec):
    title = f'<p class="from">from &ldquo;{text(spec["title"])}&rdquo;</p>' if spec.get("title") else ""
    return page(f'<div class="q-body"><p class="mark">&ldquo;</p>\n<p class="quote">{text(spec["quote"])}</p>\n<p class="by">{text(spec["byline"])}</p>\n{title}</div>',
                spec.get("foot", "True stories from readers, every month."))


KINDS = {"name-that-car": name_that_car, "answer": answer, "question": question, "remember": remember, "quote": quote}


def render(spec_path):
    spec = json.loads(pathlib.Path(spec_path).read_text())
    kind = spec.get("card")
    if kind not in KINDS:
        sys.exit(f"{spec_path}: card must be one of {', '.join(KINDS)}")
    out = OUT_DIR / spec["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as tmp:
        tmp.write(KINDS[kind](spec))
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page_ = browser.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=1)
        page_.goto(pathlib.Path(tmp.name).as_uri())
        page_.evaluate("document.fonts.ready")
        page_.wait_for_timeout(200)
        gap = page_.evaluate("""() => { const f = document.querySelector('.foot'); let l = f.previousElementSibling;
            while (l && l.classList.contains('frame')) l = l.previousElementSibling;
            return Math.round(f.getBoundingClientRect().top - l.getBoundingClientRect().bottom); }""")
        page_.screenshot(path=str(out))
        browser.close()
    pathlib.Path(tmp.name).unlink()
    note = "" if gap >= 16 else f"  WARNING: the text runs {16 - gap}px too close to the footer; shorten it"
    print(f"wrote {out.relative_to(ROOT)}{note}")
    return gap >= 16


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    ok = all([render(p) for p in sys.argv[1:]])
    sys.exit(0 if ok else 1)
