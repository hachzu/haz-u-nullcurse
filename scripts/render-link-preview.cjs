// Rebuild the share image using the existing logo and landing artwork.
const path = require('node:path');
const sharp = require(process.env.NULLKITS_SHARP || 'sharp');

async function render() {
    const root = path.resolve(__dirname, '..');
    const width = 960;
    const height = 339;
    const logo = await sharp(path.join(root, 'assets/branding/NullscapeWordmark.svg'))
        .resize(width, height).png().toBuffer();
    const caption = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="brand"><stop stop-color="#ff60e9"/><stop offset=".44" stop-color="#ff60e9"/>
        <stop offset=".56" stop-color="#72d8a9"/><stop offset="1" stop-color="#a4efc4"/></linearGradient></defs>
        <text x="600" y="475" text-anchor="middle" fill="url(#brand)" font-family="Georgia" font-size="57" letter-spacing="7">Toolkits</text>
        <path d="m600 518 8 8-8 8-8-8Z" fill="none" stroke="#e2c7f6"/></svg>`);
    await sharp(path.join(root, 'assets/branding/maintenance-5-1.png'))
        .resize(1200, 630, { fit: 'cover' })
        .composite([{ input: Buffer.from('<svg width="1200" height="630"><rect width="1200" height="630" fill="black" opacity=".65"/></svg>') }])
        .png().toBuffer().then(background => sharp(background)
            .composite([{ input: logo, left: 120, top: 80 }, { input: caption }])
            .png().toFile(path.join(root, 'assets/branding/nullscape-logo-preview-v4.png')));
}
render().catch(error => { console.error(error); process.exitCode = 1; });
