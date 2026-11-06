"""Writes the combined film: Switch hook, how-to-play, under-the-hood, impact, one end card.

Scenes come from ../demo and ../switch (copied into compositions/). Their sound placements
are read from those projects' index.html and rebased onto this timeline. Re-running this
overwrites index.html and the two chapter-card scenes.
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent

FONTS = """
    @font-face { font-family: "IM Fell English SC"; src: url("assets/fonts/im-fell-sc.woff2") format("woff2"); }
    @font-face { font-family: "IM Fell English"; font-style: italic; src: url("assets/fonts/im-fell-italic.woff2") format("woff2"); }"""


def chapter_card(sid, num, title, sub, dur):
    return f"""<template>
  <style>{FONTS}
    #root {{ position: absolute; inset: 0; overflow: hidden; background-color: #6b4a2b;
      background-image: radial-gradient(#0003 1px, transparent 1.6px), radial-gradient(#ffffff14 1px, transparent 1.4px);
      background-size: 6px 6px, 9px 9px; background-position: 0 0, 3px 4px; box-shadow: inset 0 0 200px #000c; }}
    .card {{ position: absolute; left: 50%; top: 50%; width: 1100px; margin: -230px 0 0 -550px; padding: 60px 70px 64px; text-align: center;
      background: linear-gradient(#ecdfbf, #d8c59c); color: #2b2419; border: 3px solid #8a5a20; box-shadow: 0 30px 70px #000c; }}
    .card .num {{ margin: 0; font: italic 44px/1 "IM Fell English", serif; color: #8a5a20; }}
    .card h1 {{ margin: 16px 0 0; font: 400 130px/1 "IM Fell English SC", serif; }}
    .card p.sub {{ margin: 22px 0 0; font: italic 42px/1.25 "IM Fell English", serif; color: #5a4630; }}
    .pin {{ position: absolute; top: -16px; left: 50%; width: 34px; height: 34px; margin-left: -17px; border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #ff9a8a, #9c2a20 70%); box-shadow: 0 4px 6px #0009; }}
  </style>
  <div id="root" data-composition-id="{sid}" data-width="1920" data-height="1080">
    <div id="{sid}-card" class="card">
      <span class="pin"></span>
      <p id="{sid}-num" class="num">{num}</p>
      <h1 id="{sid}-title">{title}</h1>
      <p id="{sid}-sub" class="sub">{sub}</p>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    tl.fromTo("#{sid}-card", {{ opacity: 0, y: -60, rotation: -5, scale: 1.08 }}, {{ opacity: 1, y: 0, rotation: -1.5, scale: 1, duration: 0.5, ease: "back.out(1.8)" }}, 0.15);
    tl.fromTo("#{sid}-sub", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.4 }}, 0.7);
    tl.to("#{sid}-card", {{ opacity: 0, y: 40, duration: 0.3, ease: "power2.in" }}, {dur - 0.35:.2f});
    window.__timelines["{sid}"] = tl;
  </script>
</template>
"""


def sounds(project):
    """Each scene's sounds from a project's index.html, as (scene id, element html, offset into scene)."""
    html = (ROOT.parent / project / "index.html").read_text()
    hosts = [(m.group(1), float(m.group(2)), float(m.group(3))) for m in re.finditer(
        r'<div id="([\w-]+)" class="clip" data-composition-id="[\w-]+" data-composition-src="[^"]+"\s+data-start="([\d.]+)" data-duration="([\d.]+)"', html)]
    out = []
    for m in re.finditer(r'<audio id="((?:vo|fx)-[^"]+)"[^>]*data-start="([\d.]+)"[^>]*></audio>', html):
        start = float(m.group(2))
        sid = next(h for h, s, d in hosts if s <= start + 1e-6 < s + d)
        offset = start - next(s for h, s, d in hosts if h == sid)
        out.append((sid, m.group(0), offset))
    return {h: d for h, s, d in hosts}, out


def main():
    d_dur, d_snd = sounds("demo")
    s_dur, s_snd = sounds("switch")
    dur = {**d_dur, **s_dur, "card-play": 3.4, "card-hood": 6.8}
    snd = d_snd + s_snd
    (ROOT / "compositions" / "card-play.html").write_text(chapter_card("card-play", "Part one", "How to play", "One case, start to finish", 3.4))
    (ROOT / "compositions" / "card-hood.html").write_text(chapter_card("card-hood", "Part two", "Under the hood", "How Switch runs the whole game", 6.8))
    extra = {"card-play": [("x1", 0.5, 1.493)], "card-hood": [("x2", 0.5, 5.952)]}

    order = ["hook", "whyit", "card-play", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8",
             "card-hood", "arch", "address", "rooms", "secrets", "both", "impact", "endcard"]
    hosts, audio, t = [], [], 0.0
    for z, sid in enumerate(order, 1):
        hosts.append(f"""      <div id="{sid}" class="clip" data-composition-id="{sid}" data-composition-src="compositions/{sid}.html"
        data-start="{t:.2f}" data-duration="{dur[sid]}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080" style="z-index: {z}"></div>""")
        for owner, tag, off in snd:
            if owner == sid:
                audio.append("      " + re.sub(r'data-start="[\d.]+"', f'data-start="{t + off:.2f}"', tag))
        for vid, at, length in extra.get(sid, []):
            audio.append(f'      <audio id="vo-{vid}" class="clip" src="assets/voice/{vid}.wav" data-start="{t + at:.2f}" data-duration="{length}" data-track-index="2" data-volume="1"></audio>')
        t += dur[sid]
    total = round(t, 2)
    audio.insert(0, f'      <audio id="music" class="clip" src="assets/bgm/long.wav" data-start="0" data-duration="{total}" data-track-index="3" data-volume="0.14" data-fade-out="3"></audio>')
    (ROOT / "index.html").write_text(f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Ashgrave: the full demo</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 1920px; height: 1080px; overflow: hidden; background: #0d100f; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1920" data-height="1080">
{chr(10).join(hosts)}
{chr(10).join(audio)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
""")
    print("total", total, "sounds", len(audio))


main()
