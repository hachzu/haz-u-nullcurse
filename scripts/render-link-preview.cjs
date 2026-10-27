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
        <defs><linearGradient id="brand" x2="0" y2="1"><stop stop-color="#ce73d0"/><stop offset=".88" stop-color="#ce73d0"/><stop offset="1" stop-color="#d98ada"/></linearGradient></defs>
        <text x="586" y="475" text-anchor="middle" fill="url(#brand)" font-family="Georgia" font-size="74" letter-spacing="7">Toolkits</text>
        <path d="M350 530H850" stroke="#bc94da" opacity=".35"/><path d="m600 518 11 12-11 12-11-12Z" fill="#bc94da33" stroke="#e2c7f6"/><path d="m600 523 6 7-6 7-6-7Z" fill="#f0dcff"/></svg>`);
    await sharp(path.join(root, 'assets/branding/maintenance-5-1.png'))
        .resize(1200, 630, { fit: 'cover' })
        .composite([{ input: Buffer.from('<svg width="1200" height="630"><rect width="1200" height="630" fill="black" opacity=".65"/></svg>') }])
        .png().toBuffer().then(background => sharp(background)
            .composite([{ input: logo, left: 109, top: 80 }, { input: caption }])
            .png().toFile(path.join(root, 'assets/branding/nullscape-logo-preview-v5.png')));
}
render().catch(error => { console.error(error); process.exitCode = 1; });
