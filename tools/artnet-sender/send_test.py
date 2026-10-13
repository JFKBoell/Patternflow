#!/usr/bin/env python3
"""Send Art-Net test frames to a Patternflow panel running the Art-Net edition.

    python tools/artnet-sender/send_test.py 192.168.1.50                 # gradient, 30 fps
    python tools/artnet-sender/send_test.py pf.local --pattern grid --fps 15
    python tools/artnet-sender/send_test.py 192.168.1.50 --pattern bar --no-sync
    python tools/artnet-sender/send_test.py 192.168.1.50 --image photo.jpg   # needs Pillow
    python tools/artnet-sender/send_test.py 192.168.1.50 --text "HELLO"      # needs Pillow
    python tools/artnet-sender/send_test.py 192.168.1.50 --poll              # ArtPoll, list replies

Standard library only; Pillow is used for --image / --text when it is installed.

Patterns:
    gradient  hue across x, brightness down y, drifting
    bar       a white vertical bar sweeping left to right (tearing shows as a kink)
    grid      the mapping check: a red pixel at (0,0), green at (W-1,0), blue at
              (0,H-1), white at (W-1,H-1), grey grid every 8 px, and each universe's
              first pixel lit yellow - wrong rotation, mirror, serpentine or
              pixels-per-universe show up as misplaced corners or a staircase
    solid     the whole panel one colour (--color RRGGBB), for channel order

Each frame is sent as ArtDmx universes start..start+N-1 (N = ceil(W*H/ppu)),
then an ArtSync (broadcast) unless --no-sync. By default the universes go out
as one burst; --pace-us spreads them (e.g. --pace-us 300 spreads 49 packets
over ~15 ms), and --reverse sends them last-to-first. The achieved send rate is printed
once a second.

ArtSync goes to a broadcast address, as the spec asks: by default the /24
broadcast of the panel's address (192.168.4.255 for a panel at 192.168.4.1;
--broadcast to change it). Not 255.255.255.255: Windows sends that out of a
single interface, which need not be the one the panel is on. On a router,
the access point then relays broadcast at a basic rate without retries; if
the panel never reports "sync": true, try --sync-unicast (not what the spec
describes, but what gets through on many access points).

License: MIT
"""
from __future__ import annotations

import argparse
import colorsys
import math
import socket
import struct
import sys
import time

PORT = 6454
HEADER = b"Art-Net\x00"


def art_dmx(port_address: int, seq: int, data: bytes) -> bytes:
    if len(data) % 2:
        data += b"\x00"  # Length "should be an even number in the range 2 - 512"
    return (HEADER + struct.pack("<H", 0x5000) + bytes([0, 14, seq, 0,
            port_address & 0xFF, (port_address >> 8) & 0x7F])
            + struct.pack(">H", len(data)) + data)


def art_sync() -> bytes:
    return HEADER + struct.pack("<H", 0x5200) + bytes([0, 14, 0, 0])


def art_poll() -> bytes:
    return HEADER + struct.pack("<H", 0x2000) + bytes([0, 14, 0, 0])


# ── Frames: bytearray of W*H*3, row-major, top-left first ─────────────────
_gradient_rows = {}


def frame_gradient(w, h, t):
    # Rows are built once - hue across 2*w pixels, brightness per row - and
    # each frame is a slice of them, so pure Python keeps up at 30 fps.
    rows = _gradient_rows.get((w, h))
    if rows is None:
        rows = []
        for y in range(h):
            v = 1.0 - y / (h - 1) * 0.85
            row = bytearray()
            for x in range(2 * w):
                r, g, b = colorsys.hsv_to_rgb((x / w) % 1.0, 1.0, v)
                row += bytes((int(r * 255), int(g * 255), int(b * 255)))
            rows.append(bytes(row))
        _gradient_rows[(w, h)] = rows
    off = int(t * 0.1 * w) % w * 3
    return bytearray(b"".join(r[off:off + w * 3] for r in rows))


def frame_bar(w, h, t, speed=1.0):
    out = bytearray(w * h * 3)
    bx = int(t * speed * w) % w
    for y in range(h):
        for dx in range(3):
            i = (y * w + (bx + dx) % w) * 3
            out[i:i + 3] = b"\xff\xff\xff"
    return out


def frame_grid(w, h, ppu, t):
    out = bytearray(w * h * 3)
    for y in range(h):
        for x in range(w):
            if x % 8 == 0 or y % 8 == 0:
                i = (y * w + x) * 3
                out[i:i + 3] = b"\x30\x30\x30"
    # every universe's first pixel, in stream order
    for p in range(0, w * h, ppu):
        out[p * 3:p * 3 + 3] = b"\xff\xc0\x00"
    corners = {(0, 0): b"\xff\x00\x00", (w - 1, 0): b"\x00\xff\x00",
               (0, h - 1): b"\x00\x00\xff", (w - 1, h - 1): b"\xff\xff\xff"}
    for (x, y), c in corners.items():
        for dy in range(2):
            for dx in range(2):
                xx = x - dx if x else x + dx
                yy = y - dy if y else y + dy
                i = (yy * w + xx) * 3
                out[i:i + 3] = c
    return out


def frame_solid(w, h, rgb):
    return bytearray(bytes(rgb) * (w * h))


def load_image(path, w, h):
    try:
        from PIL import Image
    except ImportError:
        sys.exit("--image needs Pillow: pip install pillow")
    img = Image.open(path).convert("RGB").resize((w, h))
    return bytearray(img.tobytes())


def frame_text(text, w, h, t):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        sys.exit("--text needs Pillow: pip install pillow")
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default(size=h // 2)
    except TypeError:  # Pillow < 10.1 has no sized default font
        font = ImageFont.load_default()
    tw = d.textlength(text, font=font)
    x = w - int((t * 40) % (tw + w))
    r, g, b = colorsys.hsv_to_rgb((t * 0.2) % 1.0, 0.8, 1.0)
    d.text((x, h // 4), text, font=font, fill=(int(r * 255), int(g * 255), int(b * 255)))
    return bytearray(img.tobytes())


def do_poll(host, timeout=2.5):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    try:
        s.bind(("", PORT))  # replies come back to port 6454
    except OSError as e:
        sys.exit(f"cannot bind udp {PORT} for the replies ({e}) - is another Art-Net tool running?")
    s.settimeout(0.3)
    s.sendto(art_poll(), (host, PORT))
    end = time.time() + timeout
    n = 0
    while time.time() < end:
        try:
            pkt, src = s.recvfrom(1024)
        except socket.timeout:
            continue
        if len(pkt) < 207 or pkt[:8] != HEADER or struct.unpack("<H", pkt[8:10])[0] != 0x2100:
            continue
        n += 1
        short = pkt[26:44].split(b"\x00")[0].decode(errors="replace")
        long_ = pkt[44:108].split(b"\x00")[0].decode(errors="replace")
        report = pkt[108:172].split(b"\x00")[0].decode(errors="replace")
        pa = ((pkt[18] & 0x7F) << 8) | ((pkt[19] & 0x0F) << 4) | (pkt[190] & 0x0F)
        bind = pkt[211] if len(pkt) > 211 else 0
        print(f"{src[0]:15}  bind {bind:3}  universe {pa:5}  {short!r}  {long_!r}  {report!r}")
    print(f"{n} ArtPollReply packet(s)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("host", help="the panel's IP or name (unicast ArtDmx)")
    ap.add_argument("--pattern", default="gradient", choices=["gradient", "bar", "grid", "solid"])
    ap.add_argument("--image", help="send this image, scaled to the panel (Pillow)")
    ap.add_argument("--text", help="scroll this text (Pillow)")
    ap.add_argument("--color", default="ff0000", help="--pattern solid: RRGGBB")
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--universe", type=int, default=0, help="Port-Address of the first universe")
    ap.add_argument("--ppu", type=int, default=170, help="pixels per universe (16..170)")
    ap.add_argument("--width", type=int, default=128)
    ap.add_argument("--height", type=int, default=64)
    ap.add_argument("--no-sync", action="store_true", help="do not send ArtSync")
    ap.add_argument("--sync-unicast", action="store_true", help="send ArtSync to the panel instead of broadcast")
    ap.add_argument("--broadcast", default=None,
                    help="where ArtSync goes (default: the /24 broadcast of the panel's address, "
                         "e.g. 192.168.4.255 - Windows sends 255.255.255.255 out of one interface only)")
    ap.add_argument("--drop", type=float, default=0.0, help="drop this fraction of ArtDmx packets (test incomplete frames)")
    ap.add_argument("--pace-us", type=float, default=0.0,
                    help="wait this many microseconds between ArtDmx packets (0 = one burst per frame)")
    ap.add_argument("--reverse", action="store_true",
                    help="send the universes last-to-first (shows whether a burst loses its tail)")
    ap.add_argument("--seconds", type=float, default=0.0, help="stop after this long (0 = until Ctrl-C)")
    ap.add_argument("--poll", action="store_true", help="send one ArtPoll and print the replies, then exit")
    a = ap.parse_args()

    host = socket.gethostbyname(a.host)
    if a.poll:
        do_poll(host)
        return
    if not 1 <= a.ppu <= 170:
        sys.exit("--ppu must be 1..170")

    w, h = a.width, a.height
    universes = math.ceil(w * h / a.ppu)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    bcast = a.broadcast or ".".join(host.split(".")[:3] + ["255"])
    sync_to = (host if a.sync_unicast else bcast, PORT)
    still = load_image(a.image, w, h) if a.image else None
    solid = bytes.fromhex(a.color)

    import random
    print(f"-> {host}:{PORT}  {w}x{h}, {universes} universes from {a.universe}, "
          f"{a.ppu} px/universe, {a.fps:g} fps, ArtSync {'off' if a.no_sync else sync_to[0]}"
          + (f", {a.pace_us:g} us between packets" if a.pace_us else "")
          + (", universes last-to-first" if a.reverse else ""))
    period = 1.0 / a.fps
    pace = a.pace_us / 1e6
    if pace and pace * (universes - 1) >= period:
        print(f"note: {universes} packets x {a.pace_us:g} us do not fit in one frame at {a.fps:g} fps; "
              "the frame rate will drop")
    t0 = time.perf_counter()
    next_at = t0
    seq = 0
    sent_frames = sent_pkts = 0
    rate_at = t0
    try:
        while True:
            now = time.perf_counter()
            t = now - t0
            if a.seconds and t >= a.seconds:
                break
            if still is not None:
                frame = still
            elif a.text:
                frame = frame_text(a.text, w, h, t)
            elif a.pattern == "bar":
                frame = frame_bar(w, h, t, 0.5)
            elif a.pattern == "grid":
                frame = frame_grid(w, h, a.ppu, t)
            elif a.pattern == "solid":
                frame = frame_solid(w, h, solid)
            else:
                frame = frame_gradient(w, h, t)
            seq = seq % 255 + 1  # 1..255; 0 would switch sequencing off
            order = range(universes - 1, -1, -1) if a.reverse else range(universes)
            last_slot = None
            for k in order:
                if pace:
                    # Every universe gets its slot, sent or dropped, so --drop
                    # leaves a hole the size real loss would. Paced from the
                    # previous slot, not from the frame start: after a stall
                    # (a Windows time slice is 15-30 ms) the rest of the frame
                    # stays spaced instead of going out as a catch-up burst.
                    # Busy-wait: time.sleep() cannot do sub-millisecond steps.
                    if last_slot is not None:
                        while time.perf_counter() < last_slot + pace:
                            pass
                    last_slot = time.perf_counter()
                if a.drop and random.random() < a.drop:
                    continue
                lo = k * a.ppu * 3
                hi = min(lo + a.ppu * 3, len(frame))
                sock.sendto(art_dmx(a.universe + k, seq, bytes(frame[lo:hi])), (host, PORT))
                sent_pkts += 1
            if not a.no_sync:
                sock.sendto(art_sync(), sync_to)
            sent_frames += 1
            if now - rate_at >= 1.0:
                dt = now - rate_at
                print(f"\r{sent_frames / dt:5.1f} fps sent  {sent_pkts / dt:6.0f} packets/s", end="", flush=True)
                sent_frames = sent_pkts = 0
                rate_at = now
            next_at += period
            delay = next_at - time.perf_counter()
            if delay > 0:
                time.sleep(delay)
            else:
                next_at = time.perf_counter()  # cannot keep up: do not try to catch up in a burst
    except KeyboardInterrupt:
        pass
    print()


if __name__ == "__main__":
    main()
