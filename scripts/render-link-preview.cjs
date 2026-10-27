// Rebuild the share image using the supplied logo and original curse-tracker colors.
const path = require('node:path');
const sharp = require(process.env.NULLKITS_SHARP || 'sharp');

async function render() {
    const root = path.resolve(__dirname, '..');
    const { data: logo, info } = await sharp(path.join(root, 'assets/branding/NullscapeToolkits.png'))
        .resize({ width: 1000, height: 420, fit: 'inside' }).png().toBuffer({ resolveWithObject: true });
    const divider = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <path d="M350 530H850" stroke="#bc94da" opacity=".35"/><path d="m600 518 11 12-11 12-11-12Z" fill="#bc94da33" stroke="#e2c7f6"/><path d="m600 523 6 7-6 7-6-7Z" fill="#f0dcff"/></svg>`);
    await sharp(path.join(root, 'assets/background/CurseTracker3.png'))
        .resize(1200, 630, { fit: 'cover' })
        .composite([{ input: Buffer.from('<svg width="1200" height="630"><rect width="1200" height="630" fill="black" opacity=".55"/></svg>') }])
        .png().toBuffer().then(background => sharp(background)
            .composite([{ input: logo, left: Math.round((1200 - info.width) / 2), top: Math.round((530 - info.height) / 2) }, { input: divider }])
            .png().toFile(path.join(root, 'assets/branding/nullscape-logo-preview-v8.png')));
}
render().catch(error => { console.error(error); process.exitCode = 1; });
