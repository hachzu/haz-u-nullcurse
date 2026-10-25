const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };
const PUBLIC = /^(?:index\.html|Toolkits\.html|version\.json|(?:assets|chaos-assets|css|js|contributors)\/.*)$/;
const RELOAD = `<script>
(() => {
  const events = new EventSource('/__preview/events');
  events.addEventListener('change', () => location.reload());
  const label = document.createElement('div');
  label.textContent = 'PRIVATE LOCAL PREVIEW';
  label.style.cssText = 'position:fixed;top:4px;right:8px;z-index:2147483647;font:10px system-ui;color:#d5f6e5;background:#061915;padding:4px 7px;pointer-events:none';
  document.body.append(label);
})();
</script>`;

function previewHTML(source) {
    return source.replace('class="maintenance-active"', '')
        .replace(/\s*<main id="maintenanceScreen"[\s\S]*?<\/main>/, '')
        .replace('</body>', RELOAD + '\n</body>');
}

function createPreviewServer() {
    const clients = new Set();
    const server = http.createServer(async (req, res) => {
        const host = req.headers.host || '';
        if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) { res.writeHead(403).end(); return; }
        if (req.headers.origin && req.headers.origin !== `http://${host}`) { res.writeHead(403).end(); return; }
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        let relative;
        try { relative = decodeURIComponent(new URL(req.url, `http://${host}`).pathname).replace(/^\/+/, ''); }
        catch { res.writeHead(400).end(); return; }
        if (relative === '__preview/events') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
            res.write(': connected\n\n'); clients.add(res);
            req.on('close', () => clients.delete(res)); return;
        }
        if (!relative || relative.endsWith('/')) relative += 'index.html';
        if (!PUBLIC.test(relative) || relative.includes('\\') || relative.split('/').some(part => part.startsWith('.'))) {
            res.writeHead(404).end(); return;
        }
        const file = path.resolve(ROOT, relative);
        if (!file.startsWith(ROOT + path.sep)) { res.writeHead(404).end(); return; }
        try {
            // Do not join live presence, prompt for a public username, or count preview visits.
            if (['js/presence.js', 'js/site-visits.js'].includes(relative)) {
                res.writeHead(200, { 'Content-Type': 'text/javascript' });
                res.end('// Live Firebase activity is disabled in private preview.'); return;
            }
            const stat = await fs.promises.stat(file);
            if (!stat.isFile()) { res.writeHead(404).end(); return; }
            res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
            if (req.method === 'HEAD') { res.end(); return; }
            if (file.endsWith('.html')) { res.end(previewHTML(await fs.promises.readFile(file, 'utf8'))); return; }
            pipeline(fs.createReadStream(file), res, () => {});
        } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
    });
    server.broadcastChange = () => clients.forEach(client => client.write('event: change\ndata: updated\n\n'));
    server.closePreviewClients = () => clients.forEach(client => client.end());
    return server;
}

if (require.main === module) {
    const port = Number(process.env.NULLSCAPE_PREVIEW_PORT || 4173);
    const server = createPreviewServer();
    server.on('error', error => { console.error(`Preview could not start: ${error.message}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => {
        console.log(`Private toolkit preview: http://127.0.0.1:${port}/#/curses`);
        console.log('Only this computer can connect. Save a site file to refresh. Ctrl+C stops the preview.');
        let timer;
        const watcher = fs.watch(ROOT, { recursive: true }, (_, filename) => {
            if (!filename || !PUBLIC.test(filename.replaceAll('\\', '/'))) return;
            clearTimeout(timer); timer = setTimeout(server.broadcastChange, 250);
        });
        server.on('close', () => { watcher.close(); clearTimeout(timer); });
    });
}

module.exports = { createPreviewServer, previewHTML };
