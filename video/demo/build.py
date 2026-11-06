"""Writes index.html and compositions/*.html from the cut list below.

The output is ordinary HyperFrames HTML that Studio can edit directly; this script is
just how the first draft was laid out. Re-running it overwrites hand edits.
"""
import json
from pathlib import Path

FOOT = "assets/footage/play.mp4"

# Each scene: duration, voice id, shots (media start, length, rate, push from->to, origin), slips, sfx.
SCENES = [
    dict(id="s1", dur=11.0, voice_at=0.6, shots=[
        dict(m=0.2, d=3.8, push=(1.0, 1.06), o="50% 45%"),
        dict(m=32.7, d=3.8, push=(1.0, 1.06), o="40% 55%"),
        dict(m=36.6, d=3.4, push=(1.02, 1.10), o="50% 50%"),
    ], hero=dict(text="Who killed Lady Verity?", at=6.3),
       sfx=[("thunder-rumble.mp3", 0.0, 0.45), ("chime.mp3", 8.42, 0.5)]),
    dict(id="s2", dur=7.2, shots=[
        dict(m=26.9, d=4.2, push=(1.0, 1.04), o="50% 40%"),
        dict(m=31.1, d=3.0, push=(1.0, 1.55), o="0% 0%", ease="power2.inOut"),
    ], slips=[("Three chapters, clear goals", 0.8, None)],
       sfx=[("church-bell.mp3", 0.0, 0.30)]),
    dict(id="s3", dur=8.4, shots=[
        dict(m=40.0, d=8.4, rate=1.25, push=(1.0, 1.10), o="35% 55%"),
    ], slips=[("Search by lantern", 0.6, None)]),
    dict(id="s4", dur=8.6, shots=[
        dict(m=55.0, d=4.6, push=(1.05, 1.15), o="30% 62%"),
        dict(m=61.9, d=4.0, push=(1.0, 1.08), o="55% 45%"),
    ], slips=[("Test it at the lab", 0.6, None)],
       sfx=[("bubbling-liquid.mp3", 3.95, 0.35)]),
    dict(id="s5", dur=6.4, shots=[
        dict(m=82.0, d=4.4, rate=2.2, push=(1.1, 1.18), o="50% 40%"),
        dict(m=94.6, d=2.0, push=(1.0, 1.06), o="50% 40%"),
    ], slips=[("Piece the letter together", 0.5, None)],
       sfx=[("paper-rustle.mp3", 0.2, 0.40)]),
    dict(id="s6", dur=9.4, shots=[
        dict(m=101.9, d=2.6, push=(1.25, 1.30), o="78% 22%"),
        dict(m=114.7, d=6.8, push=(1.15, 1.30), o="72% 30%"),
    ], slips=[("Catch the lie", 0.6, None)],
       sfx=[("rubber-stamp.wav", 6.62, 0.6)]),
    dict(id="s7", dur=7.4, shots=[
        dict(m=137.4, d=3.6, push=(1.1, 1.18), o="62% 35%"),
        dict(m=146.7, d=3.8, push=(1.0, 1.08), o="50% 50%"),
    ], slips=[("Stuck? Ask the ghost", 0.5, 3.45), ("Read the evidence board", 3.85, None)],
       sfx=[("whoosh.mp3", 2.98, 0.35)]),
    dict(id="s8", dur=7.2, shots=[
        dict(m=152.1, d=4.0, push=(1.0, 1.06), o="50% 60%"),
        dict(m=158.5, d=3.2, push=(1.0, 1.10), o="50% 40%"),
    ], slips=[("Name the killer", 0.5, 3.8)],
       sfx=[("impact.mp3", 4.1, 0.5)]),
    dict(id="s9", dur=6.8, image="assets/footage/mattermost.png", push=(1.0, 1.18), o="40% 60%",
         slips=[("Live in your team chat", 0.6, None)], sub="#conservatory in Mattermost, run by Switch",
         sfx=[("pop.mp3", 0.62, 0.4)]),
    dict(id="s10", dur=6.0, end=True),
]

SFX_LEN = {"thunder-rumble.mp3": 2.785, "chime.mp3": 0.324, "church-bell.mp3": 6.5, "bubbling-liquid.mp3": 3.435,
           "paper-rustle.mp3": 3.971, "rubber-stamp.wav": 1.12, "whoosh.mp3": 2.0, "impact.mp3": 2.624, "pop.mp3": 0.489}

VOICE = {f"s{i}": d for i, d in zip(range(1, 11), [10.197, 6.485, 7.659, 7.659, 5.675, 8.683, 6.656, 6.528, 6.123, 3.627])}

FONTS = """
    @font-face { font-family: "IM Fell English SC"; src: url("assets/fonts/im-fell-sc.woff2") format("woff2"); }
    @font-face { font-family: "IM Fell English"; font-style: italic; src: url("assets/fonts/im-fell-italic.woff2") format("woff2"); }
    @font-face { font-family: "Courier Prime"; font-weight: 700; src: url("assets/fonts/courier-prime-bold.woff2") format("woff2"); }"""

SLIP_CSS = """
    .slip { position: absolute; left: 110px; bottom: 120px; z-index: 20; }
    .slip-in { position: relative; padding: 26px 46px 28px; background: linear-gradient(#ecdfbf, #d8c59c); color: #2b2419;
      border: 2px solid #8a5a20; border-radius: 2px; box-shadow: 0 18px 40px #000a, inset 0 0 40px #8a5a2033; }
    .slip-in h2 { margin: 0; font: 400 76px/1 "IM Fell English SC", serif; white-space: nowrap; }
    .slip-in p { margin: 10px 0 0; font: italic 34px/1.2 "IM Fell English", serif; color: #5a4630; }
    .pin { position: absolute; top: -12px; left: 50%; width: 26px; height: 26px; margin-left: -13px; border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #ff9a8a, #9c2a20 70%); box-shadow: 0 4px 6px #0009; }"""


# The screencast runs ~1.3% slow against the wall clock the capture marks were taken on.
def vt(mark):
    return round(1.0133 * mark + 0.4, 2)


def scene_html(s):
    sid = s["id"]
    parts, tweens = [], []
    t = 0.0
    if s.get("end"):
        parts.append(f"""    <img id="{sid}-art" class="clip" src="assets/art/title.webp" data-start="0" data-duration="{s['dur']}" alt="" />
    <div id="{sid}-shade" class="shade"></div>
    <div id="{sid}-card" class="card">
      <h1 id="{sid}-name">Ashgrave</h1>
      <p id="{sid}-sub" class="sub">The Midnight Inquest</p>
      <p id="{sid}-line" class="line">A murder mystery your team solves together</p>
      <p id="{sid}-how" class="how">Play solo or with your team &middot; about 15 minutes &middot; AI suspects on Switch</p>
    </div>""")
        tweens += [
            f'tl.fromTo("#{sid}-art", {{ scale: 1.0 }}, {{ scale: 1.08, duration: {s["dur"]}, ease: "none" }}, 0);',
            f'tl.fromTo("#{sid}-name", {{ clipPath: "inset(0 100% 0 0)" }}, {{ clipPath: "inset(0 0% 0 0)", duration: 1.0, ease: "power3.inOut" }}, 0.2);',
            f'tl.fromTo("#{sid}-sub", {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }}, 1.0);',
            f'tl.fromTo("#{sid}-line", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.5, ease: "power1.out" }}, 1.5);',
            f'tl.fromTo("#{sid}-how", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.5, ease: "power1.out" }}, 2.0);',
        ]
        extra_css = """
    #s10-art { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; object-fit: cover; transform-origin: 70% 50%; }
    .shade { position: absolute; inset: 0; background: linear-gradient(90deg, #0d100ff2 0%, #0d100fcc 38%, #0d100f00 70%); }
    .card { position: absolute; left: 150px; top: 300px; width: 1000px; }
    .card h1 { margin: 0; font: 400 220px/0.9 "IM Fell English SC", serif; color: #e2d6bb; }
    .card .sub { margin: 18px 0 0; font: italic 64px/1 "IM Fell English", serif; color: #e0a95c; }
    .card .line { margin: 46px 0 0; font: italic 42px/1.25 "IM Fell English", serif; color: #e2d6bb; }
    .card .how { margin: 22px 0 0; font: 700 28px/1.4 "Courier Prime", monospace; letter-spacing: 0.06em; color: #a99f89; }"""
    elif s.get("image"):
        parts.append(f"""    <div id="{sid}-shot1" class="shot" style="transform-origin: {s['o']}">
      <img id="{sid}-img" class="clip" src="{s['image']}" data-start="0" data-duration="{s['dur']}" alt="The #conservatory channel in Mattermost" />
    </div>""")
        a, b = s["push"]
        tweens.append(f'tl.fromTo("#{sid}-shot1", {{ scale: {a} }}, {{ scale: {b}, duration: {s["dur"]}, ease: "power1.inOut" }}, 0);')
        extra_css = ""
    else:
        for i, sh in enumerate(s["shots"], 1):
            rate = sh.get("rate", 1)
            rate_attr = f' data-playback-rate="{rate}"' if rate != 1 else ""
            parts.append(f"""    <div id="{sid}-shot{i}" class="shot" style="transform-origin: {sh['o']}">
      <video id="{sid}-v{i}" class="clip" src="{FOOT}" data-start="{t:.2f}" data-duration="{sh['d']}" data-media-start="{vt(sh['m'])}"{rate_attr} muted playsinline></video>
    </div>""")
            a, b = sh["push"]
            tweens.append(f'tl.fromTo("#{sid}-shot{i}", {{ scale: {a} }}, {{ scale: {b}, duration: {sh["d"]}, ease: "{sh.get("ease", "none")}" }}, {t:.2f});')
            t += sh["d"]
        extra_css = ""

    if s.get("hero"):
        h = s["hero"]
        parts.append(f"""    <div id="{sid}-hero" class="hero clip" data-start="{h['at']}" data-duration="{s['dur'] - h['at']:.2f}">
      <h1 id="{sid}-hero-text">{h['text']}</h1>
    </div>""")
        tweens.append(f'tl.fromTo("#{sid}-hero-text", {{ opacity: 0, scale: 1.06 }}, {{ opacity: 1, scale: 1, duration: 0.7, ease: "power3.out" }}, {h["at"]});')
        extra_css += """
    .hero { position: absolute; left: 0; right: 0; top: 190px; z-index: 20; text-align: center; }
    .hero h1 { margin: 0; font: 400 120px/1 "IM Fell English SC", serif; color: #e2d6bb; text-shadow: 0 6px 30px #000, 0 2px 4px #000; }"""

    for j, (text, at, out) in enumerate(s.get("slips", []), 1):
        end = out if out else s["dur"]
        sub = f'\n        <p id="{sid}-slip{j}-sub">{s["sub"]}</p>' if s.get("sub") and j == 1 else ""
        parts.append(f"""    <div id="{sid}-slip{j}" class="slip clip" data-start="{at}" data-duration="{end - at:.2f}">
      <div id="{sid}-slip{j}-in" class="slip-in">
        <span class="pin"></span>
        <h2 id="{sid}-slip{j}-text">{text}</h2>{sub}
      </div>
    </div>""")
        tweens.append(f'tl.fromTo("#{sid}-slip{j}-in", {{ opacity: 0, y: -40, rotation: -6, scale: 1.06 }}, {{ opacity: 1, y: 0, rotation: -2, scale: 1, duration: 0.35, ease: "back.out(2)" }}, {at});')
        if out:
            tweens.append(f'tl.to("#{sid}-slip{j}-in", {{ opacity: 0, y: 30, duration: 0.25, ease: "power2.in" }}, {out - 0.27:.2f});')

    body = "\n".join(parts)
    tw = "\n    ".join(tweens)
    return f"""<template>
  <style>{FONTS}
    #root {{ position: absolute; inset: 0; overflow: hidden; background: #0d100f; }}
    .shot {{ position: absolute; inset: 0; }}
    .shot video, .shot img {{ position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; object-fit: cover; }}{SLIP_CSS}{extra_css}
  </style>
  <div id="root" data-composition-id="{sid}" data-width="1920" data-height="1080" data-layout-allow-overflow>
{body}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    {tw}
    window.__timelines["{sid}"] = tl;
  </script>
</template>
"""


def main():
    root = Path(__file__).parent
    (root / "compositions").mkdir(exist_ok=True)
    hosts, audio = [], []
    t = 0.0
    z = 1
    for s in SCENES:
        (root / "compositions" / f"{s['id']}.html").write_text(scene_html(s))
        hosts.append(f"""      <div id="{s['id']}" class="clip" data-composition-id="{s['id']}" data-composition-src="compositions/{s['id']}.html"
        data-start="{t:.2f}" data-duration="{s['dur']}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080" style="z-index: {z}"></div>""")
        v_at = t + s.get("voice_at", 0.3)
        audio.append(f"""      <audio id="vo-{s['id']}" class="clip" src="assets/voice/{s['id']}.wav" data-start="{v_at:.2f}" data-duration="{VOICE[s['id']]}" data-track-index="2" data-volume="1"></audio>""")
        for k, (f, at, vol) in enumerate(s.get("sfx", []), 1):
            audio.append(f"""      <audio id="fx-{s['id']}-{k}" class="clip" src="assets/sfx/{f}" data-start="{t + at:.2f}" data-duration="{SFX_LEN[f]}" data-track-index="4" data-volume="{vol}" data-fade-out="0.4"></audio>""")
        t += s["dur"]
        z += 1
    total = round(t, 2)
    audio.insert(0, f"""      <audio id="music" class="clip" src="assets/bgm/bed.wav" data-start="0" data-duration="{total}" data-track-index="3" data-volume="0.16" data-fade-out="2.5"></audio>""")
    index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Ashgrave: how to play</title>
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
"""
    (root / "index.html").write_text(index)
    print("total", total)


main()
