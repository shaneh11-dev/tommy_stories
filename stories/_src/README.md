# Story files

Each `.txt` file here becomes a story page for a Facebook post
(`python3 tools/build_stories.py`; see the main README, "Story pages for
Facebook"). This folder isn't served on the website.

```
title: A true story about Billy Rodgers, his son John, and their 1959 MGA Roadster
slug: mga
date: 2026-11-23
image: mga.jpg
image_alt: Billy Rodgers' restored red 1959 MGA Roadster outside his barn
credit: Photo: Rodgers family
source: This story was featured on Car SOS, first shown on National Geographic in March 2018.
---
For nearly forty years, a little British sports car had been sitting in a barn...
(one paragraph per line)
~~~
(the rest of the story, after where the Facebook post stops)
```

- `slug`: the short link, tommystories.com/s/<slug>. Lowercase letters,
  numbers and dashes; each one used once.
- `image`, `image_alt`, `credit`: optional. The photo goes in `images/`.
  Only photos we have the right to use (our own, a reader's with
  permission, or licensed).
- `source`: optional, shown under the story (where it was first told).
- `~~~`: optional, on its own line where the Facebook post stops. The page
  then offers "Skip to where you left off" and marks the spot.
- `description`: optional; otherwise the opening lines are used for link
  previews.
