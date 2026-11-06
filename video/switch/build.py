"""Writes index.html and compositions/*.html for the Switch-focused Ashgrave film.

The output is ordinary HyperFrames HTML that Studio edits directly; re-running this
script overwrites hand edits.
"""
from pathlib import Path

PLAY = "assets/footage/play.mp4"   # the full playthrough (1920x1080)
GAME = "assets/footage/game.mp4"   # game window, recorded beside chat (1280x1440)
CHAT = "assets/footage/chat.mp4"   # Mattermost, recorded beside the game (1280x1440)


def vt(mark, k=1.0133, c=0.4):
    """Screencasts run ~1.3% slow against the capture clock; map a capture mark to video time."""
    return round(k * mark + c, 2)


def st(mark):
    """Same mapping for the side-by-side recordings, which started with the marks clock."""
    return round(1.0133 * mark, 2)


VOICE = {"w1": 8.171, "w2": 7.104, "w3": 7.595, "w4": 9.621, "w5": 6.549, "w6": 7.424,
         "w7": 8.021, "w8": 7.125, "w9": 5.205, "w10": 6.677, "w11": 1.984}
SFX_LEN = {"chime.mp3": 0.324, "rubber-stamp.wav": 1.12, "whoosh.mp3": 2.0, "impact.mp3": 2.624,
           "pop.mp3": 0.489, "ui-click.mp3": 0.6, "thunder-rumble.mp3": 2.785, "paper-rustle.mp3": 3.971}

# id, duration, voice lines (id, at), sfx (file, at, volume)
SCENES = [
    dict(id="hook", dur=9.0, voice=[("w1", 0.3)], sfx=[("thunder-rumble.mp3", 0.0, 0.35), ("chime.mp3", 3.62, 0.5), ("pop.mp3", 3.95, 0.45)]),
    dict(id="whyit", dur=7.9, voice=[("w2", 0.3)]),
    dict(id="arch", dur=18.5, voice=[("w3", 0.3), ("w4", 8.4)], sfx=[("whoosh.mp3", 14.95, 0.3)]),
    dict(id="address", dur=7.4, voice=[("w5", 0.3)], sfx=[("pop.mp3", 5.3, 0.45)]),
    dict(id="rooms", dur=8.2, voice=[("w6", 0.3)], sfx=[("whoosh.mp3", 3.95, 0.25)]),
    dict(id="secrets", dur=8.8, voice=[("w7", 0.3)], sfx=[("rubber-stamp.wav", 5.4, 0.5)]),
    dict(id="both", dur=10.4, voice=[("w8", 0.3)], sfx=[("rubber-stamp.wav", 8.55, 0.55)]),
    dict(id="play", dur=6.0, voice=[("w9", 0.3)], sfx=[("impact.mp3", 4.6, 0.45)]),
    dict(id="impact", dur=7.5, voice=[("w10", 0.3)]),
    dict(id="endcard", dur=6.0, voice=[("w11", 0.6)]),
]

FONTS = """
    @font-face { font-family: "IM Fell English SC"; src: url("assets/fonts/im-fell-sc.woff2") format("woff2"); }
    @font-face { font-family: "IM Fell English"; font-style: italic; src: url("assets/fonts/im-fell-italic.woff2") format("woff2"); }
    @font-face { font-family: "Courier Prime"; font-weight: 700; src: url("assets/fonts/courier-prime-bold.woff2") format("woff2"); }"""

BASE_CSS = """
    #root { position: absolute; inset: 0; overflow: hidden; background: #0d100f; }
    .shot { position: absolute; inset: 0; }
    .full { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; object-fit: cover; }
    .slip { position: absolute; left: 110px; bottom: 110px; z-index: 20; }
    .slip-in { position: relative; padding: 24px 44px 26px; background: linear-gradient(#ecdfbf, #d8c59c); color: #2b2419;
      border: 2px solid #8a5a20; border-radius: 2px; box-shadow: 0 18px 40px #000a, inset 0 0 40px #8a5a2033; }
    .slip-in h2 { margin: 0; font: 400 70px/1.05 "IM Fell English SC", serif; white-space: nowrap; }
    .slip-in p { margin: 10px 0 0; font: italic 34px/1.2 "IM Fell English", serif; color: #5a4630; }
    .pin { position: absolute; top: -12px; left: 50%; width: 26px; height: 26px; margin-left: -13px; border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #ff9a8a, #9c2a20 70%); box-shadow: 0 4px 6px #0009; }
    .pane { position: absolute; top: 0; width: 960px; height: 1080px; overflow: hidden; }
    .pane video { position: absolute; left: 0; top: 0; width: 960px; height: 1080px; object-fit: cover; }
    .pane.left { left: 0; } .pane.right { left: 960px; }
    .seam { position: absolute; left: 957px; top: 0; width: 6px; height: 1080px; background: #e0a95c; z-index: 5; }
    .tag { position: absolute; top: 28px; z-index: 6; padding: 8px 16px; background: #0d100fe6; color: #e2d6bb;
      font: 700 28px/1 "Courier Prime", monospace; letter-spacing: 0.04em; border-left: 4px solid #e0a95c; }
    .cork { position: absolute; inset: 0; background-color: #6b4a2b;
      background-image: radial-gradient(#0003 1px, transparent 1.6px), radial-gradient(#ffffff14 1px, transparent 1.4px);
      background-size: 6px 6px, 9px 9px; background-position: 0 0, 3px 4px; box-shadow: inset 0 0 160px #000a; }"""


def slip(sid, j, text, at, end, sub=None):
    sub_html = f'\n        <p id="{sid}-slip{j}-sub">{sub}</p>' if sub else ""
    html = f"""    <div id="{sid}-slip{j}" class="slip clip" data-start="{at}" data-duration="{end - at:.2f}">
      <div id="{sid}-slip{j}-in" class="slip-in">
        <span class="pin"></span>
        <h2 id="{sid}-slip{j}-text">{text}</h2>{sub_html}
      </div>
    </div>"""
    tw = [f'tl.fromTo("#{sid}-slip{j}-in", {{ opacity: 0, y: -40, rotation: -6, scale: 1.06 }}, {{ opacity: 1, y: 0, rotation: -2, scale: 1, duration: 0.35, ease: "back.out(2)" }}, {at});']
    return html, tw


def push(sel, a, b, start, dur, ease="none"):
    return f'tl.fromTo("{sel}", {{ scale: {a} }}, {{ scale: {b}, duration: {dur}, ease: "{ease}" }}, {start});'


def split(sid, n, start, media_game, media_chat, dur):
    """Game window left, Mattermost right, the same seconds of both recordings."""
    html = f"""    <div id="{sid}-pg{n}" class="pane left"><video id="{sid}-g{n}" class="clip" src="{GAME}" data-start="{start}" data-duration="{dur}" data-media-start="{media_game}" muted playsinline></video></div>
    <div id="{sid}-pc{n}" class="pane right"><video id="{sid}-c{n}" class="clip" src="{CHAT}" data-start="{start}" data-duration="{dur}" data-media-start="{media_chat}" muted playsinline></video></div>"""
    return html


def scene(sid, dur, body, tweens, css=""):
    tw = "\n    ".join(tweens)
    return f"""<template>
  <style>{FONTS}{BASE_CSS}{css}
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


def build_hook():
    sid, dur = "hook", 9.0
    body = [split(sid, 1, 0, st(9.6), st(9.6), dur),
            '    <div class="seam"></div>',
            f'    <div id="{sid}-tag1" class="tag" style="left: 40px">The game window</div>',
            f'    <div id="{sid}-tag2" class="tag" style="left: 1000px">Your team\'s Mattermost</div>',
            f"""    <div id="{sid}-hero" class="hero clip" data-start="5.2" data-duration="3.8">
      <h1 id="{sid}-hero-text">One move. Both places.</h1>
    </div>"""]
    tw = [push(f"#{sid}-pc1", 1.0, 1.0, 0, dur),
          f'tl.fromTo("#{sid}-hero-text", {{ opacity: 0, scale: 1.06 }}, {{ opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" }}, 5.2);']
    css = """
    .pane.right video { object-position: 50% 100%; }
    .hero { position: absolute; left: 0; right: 0; bottom: 120px; z-index: 20; text-align: center; }
    .hero h1 { display: inline-block; margin: 0; padding: 18px 48px; font: 400 96px/1 "IM Fell English SC", serif; color: #2b2419;
      background: linear-gradient(#ecdfbf, #d8c59c); border: 2px solid #8a5a20; box-shadow: 0 18px 40px #000a; }"""
    return scene(sid, dur, "\n".join(body), tw, css)


def build_whyit():
    sid, dur = "whyit", 7.9
    body = [f"""    <div id="{sid}-shot" class="shot" style="transform-origin: 6% 30%">
      <img id="{sid}-img" class="full clip" src="assets/footage/mattermost.png" data-start="0" data-duration="{dur}" alt="Mattermost with the Ashgrave channels" />
    </div>"""]
    h, t = slip(sid, 1, "No new app. No new login.", 3.6, dur, "The game runs in the chat you already use")
    body.append(h)
    tw = [push(f"#{sid}-shot", 1.0, 1.7, 0, dur, "power2.inOut")] + t
    return scene(sid, dur, "\n".join(body), tw)


AGENTS = [  # id, label, art, x, y (card centre)
    ("gm", "Game Master", "title", 1290, 290),
    ("thomas", "Thomas Reed", "thomas", 1500, 290),
    ("clara", "Clara Ashgrave", "clara", 1710, 290),
    ("vale", "Dr. Vale", "vale", 1290, 610),
    ("holloway", "Mrs. Holloway", "holloway", 1500, 610),
    ("ghost", "The Ghost", "ghost", 1710, 610),
    ("lab", "Forensics Lab", "lab", 1395, 900),
    ("clerk", "Evidence Clerk", "study", 1605, 900),
]
AGENT_AT = {"gm": 8.6, "thomas": 10.4, "clara": 10.55, "vale": 10.7, "holloway": 10.85, "ghost": 11.9, "lab": 12.6, "clerk": 13.4}


def build_arch():
    sid, dur = "arch", 18.5
    sw = (870, 520)       # Switch card centre
    mm = (330, 520)       # Mattermost card centre
    parts = [f'    <div id="{sid}-cork" class="cork"></div>']
    # strings: Mattermost -> Switch, Switch -> each agent
    paths = [f'<path id="{sid}-s-mm" d="M{mm[0] + 190},{mm[1]} Q{(mm[0] + sw[0]) / 2},{mm[1] + 60} {sw[0] - 190},{sw[1]}" />']
    for aid, _, _, x, y in AGENTS:
        paths.append(f'<path id="{sid}-s-{aid}" d="M{sw[0] + 190},{sw[1]} Q{(sw[0] + x) / 2},{(sw[1] + y) / 2 + 50} {x - 85},{y}" />')
    parts.append(f'    <svg id="{sid}-strings" class="strings" width="1920" height="1080" viewBox="0 0 1920 1080">{"".join(paths)}</svg>')
    parts.append(f"""    <div id="{sid}-mm" class="note mm" style="left: {mm[0] - 190}px; top: {mm[1] - 170}px">
      <span class="pin"></span>
      <h3>Mattermost</h3>
      <p class="sub">your team's chat</p>
      <ul>
        <li id="{sid}-ch1"># conservatory</li>
        <li id="{sid}-ch2">&#128274; clues-detective</li>
      </ul>
    </div>""")
    parts.append(f"""    <div id="{sid}-sw" class="note sw" style="left: {sw[0] - 190}px; top: {sw[1] - 190}px">
      <span class="pin"></span>
      <h3>Switch</h3>
      <ul>
        <li id="{sid}-r1">rooms</li>
        <li id="{sid}-r2">events</li>
        <li id="{sid}-r3">@addressing</li>
      </ul>
    </div>""")
    for aid, label, art, x, y in AGENTS:
        parts.append(f"""    <div id="{sid}-a-{aid}" class="polaroid" style="left: {x - 85}px; top: {y - 120}px">
      <span class="pin"></span>
      <img src="assets/art/{art}.webp" alt="" />
      <b>{label}</b>
    </div>""")
    parts.append(f'    <div id="{sid}-on" class="onstamp">8 agents &middot; always on</div>')
    parts.append(f"""    <div id="{sid}-proof" class="shot proof" style="transform-origin: 55% 25%">
      <img id="{sid}-proof-img" class="full clip" src="assets/footage/gw-agents.png" data-layout-allow-occlusion data-start="15.4" data-duration="3.1" alt="The Switch Gateway listing the eight Ashgrave agents" />
    </div>""")
    h, t = slip(sid, 1, "The real agents, live in Switch", 15.7, dur)
    parts.append(h)

    tw = [
        f'tl.fromTo("#{sid}-sw", {{ opacity: 0, y: -50, rotation: -4 }}, {{ opacity: 1, y: 0, rotation: -1, duration: 0.45, ease: "back.out(1.8)" }}, 0.5);',
        f'tl.fromTo("#{sid}-mm", {{ opacity: 0, y: -50, rotation: 4 }}, {{ opacity: 1, y: 0, rotation: 1.5, duration: 0.45, ease: "back.out(1.8)" }}, 2.6);',
        f'tl.fromTo("#{sid}-s-mm", {{ strokeDashoffset: 900 }}, {{ strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut" }}, 3.3);',
        f'tl.fromTo("#{sid}-ch1, #{sid}-ch2, #{sid}-r1", {{ backgroundColor: "rgba(224,169,92,0)" }}, {{ backgroundColor: "rgba(224,169,92,0.45)", duration: 0.3, stagger: 0.15 }}, 4.0);',
        f'tl.fromTo("#{sid}-r2, #{sid}-r3", {{ backgroundColor: "rgba(224,169,92,0)" }}, {{ backgroundColor: "rgba(224,169,92,0.45)", duration: 0.3, stagger: 0.15 }}, 5.8);',
    ]
    for i, (aid, *_rest) in enumerate(AGENTS):
        tw.append(f'tl.fromTo("#{sid}-s-{aid}", {{ strokeDashoffset: 900 }}, {{ strokeDashoffset: 0, duration: 0.7, ease: "power2.out" }}, {5.6 + i * 0.08:.2f});')
        at = AGENT_AT[aid]
        rot = [-3, 2, -1.5, 2.5, -2, 1.5, -2.5, 2][i]
        tw.append(f'tl.fromTo("#{sid}-a-{aid}", {{ opacity: 0, y: -40, scale: 1.1, rotation: {rot * 2} }}, {{ opacity: 1, y: 0, scale: 1, rotation: {rot}, duration: 0.4, ease: "back.out(2)" }}, {at});')
    tw.append(f'tl.fromTo("#{sid}-on", {{ opacity: 0, scale: 2.2, rotation: -14 }}, {{ opacity: 1, scale: 1, rotation: -8, duration: 0.35, ease: "back.out(1.6)" }}, 14.4);')
    tw.append(push(f"#{sid}-proof", 1.0, 1.25, 15.4, 3.1, "power1.inOut"))
    tw += t
    css = """
    .strings { position: absolute; left: 0; top: 0; z-index: 2; overflow: visible; }
    .strings path { fill: none; stroke: #c0392b; stroke-width: 4; stroke-dasharray: 900; stroke-dashoffset: 900; }
    .note { position: absolute; z-index: 3; width: 380px; padding: 30px 34px; background: #fdf6dc; color: #2b2419; box-shadow: 0 14px 30px #000a; }
    .note.sw { height: 380px; background: #f1e3bd; border: 3px solid #8a5a20; }
    .note h3 { margin: 0; font: 400 60px/1 "IM Fell English SC", serif; }
    .note .sub { margin: 6px 0 0; font: italic 32px/1.2 "IM Fell English", serif; color: #5a4630; }
    .note ul { list-style: none; margin: 22px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .note li { font: 700 30px/1.3 "Courier Prime", monospace; padding: 4px 10px; border-radius: 3px; }
    .polaroid { position: absolute; z-index: 3; width: 190px; padding: 8px 8px 10px; background: #f1e8d4; color: #2b2419; text-align: center;
      box-shadow: 0 10px 24px #000a; font: 400 28px/1.1 "IM Fell English SC", serif; }
    .polaroid img { display: block; width: 174px; height: 170px; object-fit: cover; object-position: top; margin-bottom: 6px; }
    .onstamp { position: absolute; left: 690px; top: 760px; z-index: 6; padding: 6px 18px; color: #d8443a; border: 4px double #d8443a;
      background: #f1e8d4e6; font: 400 40px/1 "IM Fell English SC", serif; }
    .proof { z-index: 10; }"""
    return scene(sid, dur, "\n".join(parts), tw, css)


def build_address():
    sid, dur = "address", 7.4
    body = [f"""    <div id="{sid}-shot" class="shot" style="transform-origin: 45% 92%">
      <video id="{sid}-v" class="chatfull clip" src="{CHAT}" data-start="0" data-duration="{dur}" data-media-start="{st(17.4)}" muted playsinline></video>
    </div>"""]
    h, t = slip(sid, 1, "Only who you @mention answers", 0.5, dur)
    body.append(h)
    tw = [push(f"#{sid}-shot", 1.0, 1.12, 0, dur, "power1.inOut")] + t
    css = """
    .chatfull { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; object-fit: cover; object-position: 50% 100%; }
    .slip { left: auto; right: 110px; bottom: auto; top: 110px; }"""
    return scene(sid, dur, "\n".join(body), tw, css)


def build_rooms():
    sid, dur = "rooms", 8.2
    body = [f"""    <div id="{sid}-shot1" class="shot" style="transform-origin: 40% 40%">
      <video id="{sid}-v" class="chatfull clip" src="{CHAT}" data-start="0" data-duration="4.4" data-media-start="{st(47.6)}" muted playsinline></video>
    </div>
    <div id="{sid}-shot2" class="shot" style="transform-origin: 20% 13%">
      <img id="{sid}-img" class="full clip" src="assets/footage/gw-rooms.png" data-start="4.4" data-duration="3.8" alt="Switch Gateway rooms: conservatory and the private clues-detective room" />
    </div>"""]
    h, t = slip(sid, 1, "A private room per detective", 0.5, dur)
    body.append(h)
    tw = [push(f"#{sid}-shot1", 1.0, 1.08, 0, 4.4), push(f"#{sid}-shot2", 1.2, 1.9, 4.4, 3.8, "power2.out")] + t
    css = """
    .chatfull { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; object-fit: cover; object-position: 50% 0%; }"""
    return scene(sid, dur, "\n".join(body), tw, css)


def build_secrets():
    sid, dur = "secrets", 8.8
    sus = [("thomas", "Thomas Reed"), ("clara", "Clara Ashgrave"), ("vale", "Dr. Vale"), ("holloway", "Mrs. Holloway")]
    parts = [f'    <div id="{sid}-cork" class="cork"></div>']
    for i, (a, n) in enumerate(sus):
        x = 250 + i * 380
        parts.append(f"""    <div id="{sid}-p-{a}" class="polaroid" style="left: {x}px; top: 150px">
      <span class="pin"></span>
      <img src="assets/art/{a}.webp" alt="" />
      <b>{n}</b>
      <span id="{sid}-seal-{a}" class="seal">own secret only</span>
    </div>""")
    parts.append(f"""    <div id="{sid}-vault" class="vault">
      <span class="pin"></span>
      <h3>The solution</h3>
      <p>kept by the game engine, never sent to an agent</p>
    </div>""")
    tw = []
    for i, (a, _) in enumerate(sus):
        tw.append(f'tl.fromTo("#{sid}-p-{a}", {{ opacity: 0, y: -40, rotation: {(-1) ** i * 5} }}, {{ opacity: 1, y: 0, rotation: {(-1) ** i * 2}, duration: 0.4, ease: "back.out(2)" }}, {0.4 + i * 0.25:.2f});')
        tw.append(f'tl.fromTo("#{sid}-seal-{a}", {{ opacity: 0, scale: 2 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.6)" }}, {1.8 + i * 0.3:.2f});')
    tw.append(f'tl.fromTo("#{sid}-vault", {{ opacity: 0, y: 60 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }}, 4.6);')
    css = """
    .polaroid { position: absolute; width: 300px; padding: 12px 12px 16px; background: #f1e8d4; color: #2b2419; text-align: center;
      box-shadow: 0 14px 30px #000a; font: 400 34px/1.15 "IM Fell English SC", serif; }
    .polaroid img { display: block; width: 276px; height: 300px; object-fit: cover; object-position: top; margin-bottom: 8px; }
    .seal { position: absolute; left: 50%; top: 150px; margin-left: -120px; width: 240px; padding: 6px 0; color: #d8443a; border: 4px double #d8443a;
      background: #f1e8d4e6; font: 400 30px/1 "IM Fell English SC", serif; transform: rotate(-10deg); }
    .vault { position: absolute; left: 460px; top: 700px; width: 1000px; padding: 28px 40px; text-align: center; background: #2a1d12; color: #e2d6bb;
      border: 3px solid #e0a95c; box-shadow: 0 18px 40px #000c; }
    .vault h3 { margin: 0; font: 400 64px/1 "IM Fell English SC", serif; }
    .vault p { margin: 10px 0 0; font: italic 36px/1.2 "IM Fell English", serif; color: #e0a95c; }"""
    return scene(sid, dur, "\n".join(parts), tw, css)


def build_both():
    sid, dur = "both", 10.4
    body = [split(sid, 1, 0, st(30.6), st(30.6), 4.4),
            split(sid, 2, 4.4, st(38.2), st(38.2), 6.0),
            '    <div class="seam"></div>',
            f'    <div id="{sid}-tag1" class="tag" style="left: 40px">The game window</div>',
            f'    <div id="{sid}-tag2" class="tag" style="left: 1000px">Your team\'s Mattermost</div>']
    h, t = slip(sid, 1, "Ask in chat. Catch it in the game.", 0.5, dur)
    body.append(h)
    css = """
    .pane.right video { object-position: 50% 100%; }"""
    return scene(sid, dur, "\n".join(body), t, css)


def build_play():
    sid, dur = "play", 6.0
    cuts = [(36.9, 1.5, "50% 55%"), (64.4, 1.5, "55% 45%"), (94.9, 1.4, "50% 40%"), (158.7, 1.6, "50% 45%")]
    body, tw, t = [], [], 0.0
    for i, (m, d, o) in enumerate(cuts, 1):
        body.append(f"""    <div id="{sid}-shot{i}" class="shot" style="transform-origin: {o}">
      <video id="{sid}-v{i}" class="full clip" src="{PLAY}" data-start="{t:.2f}" data-duration="{d}" data-media-start="{vt(m)}" muted playsinline></video>
    </div>""")
        tw.append(push(f"#{sid}-shot{i}", 1.04, 1.12, round(t, 2), d))
        t += d
    return scene(sid, dur, "\n".join(body), tw)


def build_impact():
    sid, dur = "impact", 7.5
    body = [f"""    <div id="{sid}-shot" class="shot" style="transform-origin: 76% 74%">
      <img id="{sid}-img" class="full clip" src="assets/footage/gw-ecosystem.png" data-start="0" data-duration="{dur}" alt="Switch ecosystem graph: Mattermost, Switch and the Ashgrave agents" />
    </div>"""]
    h, t = slip(sid, 1, "AI agents run the session", 0.5, dur, "Your team does the thinking, together")
    body.append(h)
    tw = [push(f"#{sid}-shot", 1.0, 2.4, 0, dur, "power2.inOut")] + t
    return scene(sid, dur, "\n".join(body), tw)


def build_end():
    sid, dur = "endcard", 6.0
    body = f"""    <img id="{sid}-art" class="full clip" src="assets/art/title.webp" data-start="0" data-duration="{dur}" alt="" />
    <div class="shade"></div>
    <div class="card">
      <h1 id="{sid}-name">Ashgrave</h1>
      <p id="{sid}-sub" class="sub">The Midnight Inquest</p>
      <p id="{sid}-line" class="line">Built on Switch &middot; played in Mattermost</p>
      <p id="{sid}-how" class="how">8 AI agents &middot; private clue rooms &middot; solo or with your team</p>
    </div>"""
    tw = [push(f"#{sid}-art", 1.0, 1.08, 0, dur),
          f'tl.fromTo("#{sid}-name", {{ clipPath: "inset(0 100% 0 0)" }}, {{ clipPath: "inset(0 0% 0 0)", duration: 1.0, ease: "power3.inOut" }}, 0.2);',
          f'tl.fromTo("#{sid}-sub", {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }}, 0.9);',
          f'tl.fromTo("#{sid}-line", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.5 }}, 1.3);',
          f'tl.fromTo("#{sid}-how", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.5 }}, 1.7);']
    css = """
    #endcard-art { transform-origin: 70% 50%; }
    .shade { position: absolute; inset: 0; background: linear-gradient(90deg, #0d100ff2 0%, #0d100fcc 38%, #0d100f00 70%); }
    .card { position: absolute; left: 150px; top: 290px; width: 1100px; }
    .card h1 { margin: 0; font: 400 220px/0.9 "IM Fell English SC", serif; color: #e2d6bb; }
    .card .sub { margin: 18px 0 0; font: italic 64px/1 "IM Fell English", serif; color: #e0a95c; }
    .card .line { margin: 46px 0 0; font: italic 44px/1.25 "IM Fell English", serif; color: #e2d6bb; }
    .card .how { margin: 22px 0 0; font: 700 28px/1.4 "Courier Prime", monospace; letter-spacing: 0.04em; color: #a99f89; }"""
    return scene(sid, dur, body, tw, css)


BUILDERS = {"hook": build_hook, "whyit": build_whyit, "arch": build_arch, "address": build_address, "rooms": build_rooms,
            "secrets": build_secrets, "both": build_both, "play": build_play, "impact": build_impact, "endcard": build_end}


def main():
    root = Path(__file__).parent
    (root / "compositions").mkdir(exist_ok=True)
    hosts, audio, t = [], [], 0.0
    for z, s in enumerate(SCENES, 1):
        (root / "compositions" / f"{s['id']}.html").write_text(BUILDERS[s["id"]]())
        hosts.append(f"""      <div id="{s['id']}" class="clip" data-composition-id="{s['id']}" data-composition-src="compositions/{s['id']}.html"
        data-start="{t:.2f}" data-duration="{s['dur']}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080" style="z-index: {z}"></div>""")
        for vid, at in s["voice"]:
            audio.append(f"""      <audio id="vo-{vid}" class="clip" src="assets/voice/{vid}.wav" data-start="{t + at:.2f}" data-duration="{VOICE[vid]}" data-track-index="2" data-volume="1"></audio>""")
        for k, (f, at, vol) in enumerate(s.get("sfx", []), 1):
            audio.append(f"""      <audio id="fx-{s['id']}-{k}" class="clip" src="assets/sfx/{f}" data-start="{t + at:.2f}" data-duration="{SFX_LEN[f]}" data-track-index="{3 + k}" data-volume="{vol}" data-fade-out="0.3"></audio>""")
        t += s["dur"]
    total = round(t, 2)
    audio.insert(0, f"""      <audio id="music" class="clip" src="assets/bgm/bed.wav" data-start="0" data-duration="{total}" data-track-index="3" data-volume="0.14" data-fade-out="2.5"></audio>""")
    (root / "index.html").write_text(f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Ashgrave on Switch</title>
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
    print("total", total)


main()
