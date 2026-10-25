const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createPreviewServer, previewHTML } = require('../scripts/private-preview.cjs');

test('preview removes a maintenance cover when one is enabled', () => {
    const source = '<html class="maintenance-active"><body><main id="maintenanceScreen">Maintenance</main><main id="toolkitView">Tools</main></body></html>';
    const result = previewHTML(source);
    assert.doesNotMatch(result, /maintenance-active|maintenanceScreen/);
    assert.match(result, /id="toolkitView">Tools/);
});

test('private preview opens tools without altering public HTML or contacting Firebase', async () => {
    const root = path.resolve(__dirname, '..');
    const original = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const server = createPreviewServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const request = (url, headers = {}) => new Promise((resolve, reject) => {
        http.get({ hostname: '127.0.0.1', port, path: url, headers }, res => {
            let body = ''; res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
    try {
        for (const url of ['/', '/Toolkits.html', '/contributors/']) {
            const response = await request(url);
            assert.equal(response.status, 200);
            assert.doesNotMatch(response.body, /class="maintenance-active"|<main id="maintenanceScreen"/);
            assert.match(response.body, /PRIVATE LOCAL PREVIEW/);
        }
        assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), original);
        for (const url of ['/js/presence.js?v=test', '/js/site-visits.js']) {
            const response = await request(url);
            assert.equal(response.status, 200);
            assert.match(response.body, /Firebase activity is disabled/);
            assert.doesNotMatch(response.body, /import|initializeApp/);
        }
        assert.equal((await request('/js/tracker.js')).status, 200);
        for (const url of ['/.git/config', '/docs/private-preview.md', '/assets/%2e%2e%2f.git/config', '/assets/%5c..%5c.git/config']) {
            assert.equal((await request(url)).status, 404, url);
        }
        assert.equal((await request('/', { Host: 'example.com' })).status, 403);
        assert.equal((await request('/', { Origin: 'https://example.com' })).status, 403);
    } finally {
        server.closePreviewClients();
        await new Promise(resolve => server.close(resolve));
    }
});
