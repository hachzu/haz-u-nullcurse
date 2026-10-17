"""Build the logo and background share image and a Discord-style mockup.

Usage: python scripts/build-social-preview.py mockup.png
"""
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BRANDING = ROOT / 'assets' / 'branding'
DESCRIPTION = ("hey you! having trouble planning your runs and working out the numbers in nullscape? "
               "here's Nullscape Toolkits! it has a curse tracker, an upgrade calculator, "
               "lobby name RT editor, altars calculation, death tracker! go check it out nullscapers :]")


def font(size, bold=False):
    candidates = [
        Path('C:/Windows/Fonts') / ('segoeuib.ttf' if bold else 'segoeui.ttf'),
        Path('/usr/share/fonts/truetype/dejavu') / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size=size)


def build_image():
    logo = Image.open(BRANDING / 'NullscapeToolkits.png').convert('RGBA')
    logo.thumbnail((1040, 450), Image.Resampling.LANCZOS)
    background = ImageOps.fit(
        Image.open(ROOT / 'assets/background/Background.png').convert('RGB'),
        (1200, 630), method=Image.Resampling.LANCZOS)
    social = Image.blend(Image.new('RGB', (1200, 630), '#05010c'), background, .30).convert('RGBA')
    social.alpha_composite(logo, ((1200 - logo.width) // 2, (630 - logo.height) // 2))
    social = social.convert('RGB')
    social.save(BRANDING / 'nullscape-logo-preview-v2.png', optimize=True)
    # Reuse the emblem from the existing logo for a recognizable square site icon.
    source = Image.open(BRANDING / 'NullscapeToolkits.png').convert('RGBA')
    emblem = source.crop((0, 0, 490, 650))
    emblem.thumbnail((164, 164), Image.Resampling.LANCZOS)
    icon = Image.new('RGBA', (180, 180), '#05010c')
    icon.alpha_composite(emblem, ((180 - emblem.width) // 2, (180 - emblem.height) // 2))
    icon.save(BRANDING / 'nullscape-icon.png', optimize=True)
    return social


def build_mockup(social, destination):
    # An illustrative Discord layout, not a screenshot from a live message.
    canvas = Image.new('RGB', (740, 650), '#313338')
    draw = ImageDraw.Draw(canvas)
    draw.text((24, 20), 'DISCORD LINK PREVIEW / LOCAL MOCKUP', font=font(13, True), fill='#b5bac1')
    draw.text((24, 57), 'https://hachzu.github.io/haz-u-nullcurse/', font=font(17), fill='#78b9ee')
    draw.rounded_rectangle((24, 96, 716, 624), radius=4, fill='#2b2d31')
    draw.rounded_rectangle((24, 96, 28, 624), radius=2, fill='#9b5de5')
    draw.text((44, 111), 'Nullscape Toolkits', font=font(13), fill='#dbdee1')
    draw.text((44, 139), 'Nullscape Toolkits', font=font(19, True), fill='#78b9ee')
    # Wrap the exact description from the page rather than a separate sample.
    words, lines, line = DESCRIPTION.split(), [], ''
    for word in words:
        candidate = f'{line} {word}'.strip()
        if draw.textlength(candidate, font=font(16)) > 644:
            lines.append(line)
            line = word
        else:
            line = candidate
    lines.append(line)
    for i, line in enumerate(lines):
        draw.text((44, 174 + i * 23), line, font=font(16), fill='#dbdee1')
    image_y = 174 + len(lines) * 23 + 12
    canvas.paste(social.resize((550, 289), Image.Resampling.LANCZOS), (44, image_y))
    # Keep the card snug around the description and image as the copy changes.
    card_bottom = image_y + 301
    draw.rectangle((24, card_bottom, 716, 649), fill='#313338')
    canvas.crop((0, 0, 740, card_bottom + 25)).save(destination)


if __name__ == '__main__':
    social = build_image()
    if len(sys.argv) > 1:
        build_mockup(social, sys.argv[1])
