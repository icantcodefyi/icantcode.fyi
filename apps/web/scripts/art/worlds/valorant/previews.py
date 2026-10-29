"""Offline PNG mockups using the same crop for every depth/color layer."""
from pathlib import Path
import argparse
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

HERE = Path(__file__).resolve().parent
WEB = HERE.parents[3]
STAGING = Path('/tmp/art-valorant')
OUT = WEB / 'public/lobby/val/stage'
FONT = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 22)
MODES = ('night', 'day')
parser = argparse.ArgumentParser()
parser.add_argument('--encoded', action='store_true')
args = parser.parse_args()


def composite(mode):
    result = Image.new('RGBA', (1600, 1800))
    for layer in ('sky', 'far', 'near'):
        path = OUT / f'{mode}-{layer}.avif' if args.encoded else STAGING / f'{mode}-{layer}.png'
        result = Image.alpha_composite(result, Image.open(path).convert('RGBA'))
    return result.convert('RGB')


def stage(mode, size, actual_agent=False):
    w, h = size
    art = ImageOps.fit(composite(mode), size, Image.Resampling.LANCZOS, centering=(0.42, 0.5))
    art = Image.blend(art, Image.new('RGB', size, '#ff4655'), .22 if mode == 'night' else .18)
    mask = Image.new('L', size)
    ImageDraw.Draw(mask).polygon([(w*.40, 0), (w, 0), (w, h), (w*.14, h)], fill=255)
    base = Image.new('RGB', size, '#14191c' if mode == 'night' else '#f2ede5')
    base.paste(art, (0, 0), mask)
    draw = ImageDraw.Draw(base)
    draw.polygon([(w*.364, 0), (w*.372, 0), (w*.112, h), (w*.104, h)], fill='#ff4655')
    # The existing Jett alpha is a layout stand-in only; never part of shipped art.
    agent = Image.open(WEB / 'public/lobby/val/jett.webp').convert('RGBA')
    ah = round(h * 1.4)
    agent = agent.resize((round(agent.width * ah / agent.height), ah), Image.Resampling.LANCZOS)
    if not actual_agent:
        alpha = agent.getchannel('A')
        outline = alpha.filter(ImageFilter.MaxFilter(5))
        stroke = Image.new('RGBA', agent.size, '#f5e9df')
        stroke.putalpha(outline)
        flat = Image.new('RGBA', agent.size, '#15171b')
        flat.putalpha(alpha)
        agent = Image.alpha_composite(stroke, flat)
    x = round(w * (.54 if w > 500 else .56) - agent.width / 2)
    y = round(h * (-.04 if w > 500 else -.02))
    base = base.convert('RGBA')
    base.alpha_composite(agent, (x, y))
    draw = ImageDraw.Draw(base)
    ink = '#eee6de' if mode == 'night' else '#251719'
    for cx, cy, sx, sy in [(22, 22, 1, 1), (w-22, 22, -1, 1), (22, h-22, 1, -1), (w-22, h-22, -1, -1)]:
        draw.line([(cx, cy+sy*40), (cx, cy+sy*10), (cx+sx*10, cy), (cx+sx*40, cy)], fill=ink, width=1)
    radar = 148 if w > 500 else 78
    rx, ry = (w-radar-40, 62) if w > 500 else (14, 14)
    draw.rectangle((rx, ry, rx+radar, ry+radar), fill='#1c1418' if mode == 'night' else '#f1e7dc', outline=ink)
    for r in (.17, .32, .44):
        cx, cy = rx+radar/2, ry+radar/2
        draw.ellipse((cx-r*radar, cy-r*radar, cx+r*radar, cy+r*radar), outline=ink, width=1)
    draw.line((rx+radar/2, ry+radar/2, rx+radar*.75, ry+radar*.17), fill='#ff4655', width=2)
    return base.convert('RGB')


for kind, size in [('desktop', (840, 900)), ('mobile', (390, 600))]:
    w, h = size
    sheet = Image.new('RGB', (2*w, h+48), '#101013')
    draw = ImageDraw.Draw(sheet)
    for i, mode in enumerate(MODES):
        mock = stage(mode, size)
        mock.save(STAGING / f'{mode}-{kind}-mock.png')
        stage(mode, size, actual_agent=True).save(STAGING / f'{mode}-{kind}-agent-check.png')
        sheet.paste(mock, (i*w, 48))
        title = f'{mode.upper()} / {w} × {h}' if w < 500 else f'{mode.upper()} / {w} × {h} / coral tint + mock silhouette'
        draw.text((i*w+16, 12), title, font=FONT, fill='#eee5df')
    sheet.save(STAGING / f'preview-{kind}.png')

sheet = Image.new('RGB', (1600, 948), '#101013')
draw = ImageDraw.Draw(sheet)
for i, mode in enumerate(MODES):
    art = composite(mode)
    art.save(STAGING / f'{mode}-assembled.png')
    sheet.paste(art.resize((800, 900), Image.Resampling.LANCZOS), (i*800, 48))
    draw.text((i*800+18, 12), f'{mode.upper()} / full assembled environment', font=FONT, fill='#eee5df')
sheet.save(STAGING / 'preview-paintings.png')

# Contact sheet makes alpha regions and the three-plane division reviewable.
sheet = Image.new('RGB', (1600, 1250), '#101013')
for row, mode in enumerate(MODES):
    for col, layer in enumerate(('sky', 'far', 'near', 'depth')):
        path = OUT / f'{mode}-{layer}.avif' if args.encoded else STAGING / f'{mode}-{layer}.png'
        if not path.exists():
            continue
        plate = Image.open(path).convert('RGBA').resize((400, 450), Image.Resampling.LANCZOS)
        tile = Image.new('RGB', (400, 450), '#71656a')
        td = ImageDraw.Draw(tile)
        for y in range(0, 450, 20):
            for x in range(0, 400, 20):
                if (x//20+y//20) % 2:
                    td.rectangle((x, y, x+19, y+19), fill='#958a8b')
        tile.paste(plate, (0, 0), plate)
        yy = row*625
        sheet.paste(tile, (col*400, yy+48))
        ImageDraw.Draw(sheet).text((col*400+12, yy+12), f'{mode.upper()} / {layer}', font=FONT, fill='#eee5df')
sheet.save(STAGING / 'preview-layers.png')
print('PNG previews saved in', STAGING, '(decoded AVIF)' if args.encoded else '(lossless PNG)')
