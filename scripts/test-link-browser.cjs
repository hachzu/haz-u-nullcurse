/* Run with Playwright available via NODE_PATH. All Firebase traffic is blocked. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createPreviewServer } = require('./private-preview.cjs');
const core = require('../js/link-core.js');
const fs = require('node:fs');

(async () => {
    const server = createPreviewServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    const rooms = new Map(), errors = [];
    let writes = 0, externalRequests = 0;
    try {
        browser = await chromium.launch({ headless: true, channel: 'msedge' });
        async function client() {
            const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
            await context.route('**/*', route => {
                if (route.request().url().startsWith(origin)) return route.continue();
                externalRequests++; return route.abort();
            });
            const page = await context.newPage();
            page.setDefaultTimeout(15000);
            page.on('pageerror', error => errors.push(error.message));
            await page.exposeFunction('mockLinkConnect', ({ code, create, fields }) => {
                if (create) rooms.set(code, { fields, clients: new Set(), host: page });
                const room = rooms.get(code);
                if (!room) throw Error('Link not found');
                room.clients.add(page);
                return { fields: room.fields };
            });
            await page.exposeFunction('mockLinkSend', async ({ code, patch }) => {
                const room = rooms.get(code); assert(room);
                writes++; core.patchFields(room.fields, patch);
                await Promise.all([...room.clients].map(peer => peer.evaluate(patch => window.__linkMock.onPatch(patch), patch)));
            });
            await page.exposeFunction('mockLinkClose', async code => {
                const room = rooms.get(code); if (!room) return;
                room.clients.delete(page);
                if (room.host === page) {
                    rooms.delete(code);
                    await Promise.all([...room.clients].map(peer => peer.evaluate(() => window.__linkMock.onEnd('This Link has ended.'))));
                }
            });
            await page.addInitScript(() => {
                localStorage.setItem('nullscapeHideToolsSpotlight', 'true');
                localStorage.setItem('nullscapeHideSettingsSpotlight', 'true');
                localStorage.setItem('nullscapeLowDetailMode', 'true');
                window.NullscapeLinkTransportFactory = async options => {
                    window.__linkMock = options;
                    const result = await window.mockLinkConnect({ code: options.code, create: options.create, fields: options.fields });
                    options.onStatus('live');
                    return { fields: result.fields,
                        send: patch => window.mockLinkSend({ code: options.code, patch }),
                        close: () => { window.mockLinkClose(options.code).catch(() => {}); }
                    };
                };
            });
            await page.goto(`${origin}/#/curses`);
            await page.waitForFunction(() => window.NullscapeLinkState && !document.getElementById('toolkitView').hidden);
            // Startup guidance is unrelated to these interaction checks.
            await page.evaluate(() => document.querySelectorAll('.editing-notice-overlay, .tools-spotlight-overlay, .settings-spotlight-overlay').forEach(node => node.remove()));
            return page;
        }
        const host = await client(), guest = await client();
        assert.equal(rooms.size, 0, 'no room before opting in');
        await host.locator('#levelInput').fill('30');
        await host.locator('#levelInput').dispatchEvent('input');
        await host.locator('#linkCreate').click();
        await host.waitForFunction(() => document.getElementById('linkBadge').dataset.state === 'live');
        const code = await host.locator('#linkCode').inputValue();
        await guest.locator('#linkCode').fill(code);
        await guest.locator('#linkJoin').click();
        await guest.waitForFunction(() => document.getElementById('linkBadge').dataset.state === 'live');
        assert.equal(await guest.locator('#levelInput').inputValue(), '30');
        await host.locator('.game-settings-bar').click();
        await guest.waitForFunction(() => !document.querySelector('.game-settings-disclosure').open);
        await guest.locator('.game-settings-bar').click();
        await host.waitForFunction(() => document.querySelector('.game-settings-disclosure').open);

        // A level edit and an upgrade edit from opposite browsers merge.
        await host.locator('#levelInput').fill('31');
        await guest.evaluate(() => { upgradeState.goldenGifts = 12345; saveUpgradeState(); document.dispatchEvent(new Event('change')); });
        await guest.waitForFunction(() => document.getElementById('levelInput').value === '31');
        await host.waitForFunction(() => upgradeState.goldenGifts === 12345);
        await host.evaluate(() => { runState.activeCurses.add('Nothing'); render(); document.dispatchEvent(new Event('change')); });
        await guest.waitForFunction(() => runState.activeCurses.has('Nothing'));
        await guest.evaluate(() => { runState.activeCurses.delete('Nothing'); render(); document.dispatchEvent(new Event('change')); });
        await host.waitForFunction(() => !runState.activeCurses.has('Nothing'));

        await host.evaluate(() => { setPlayerCount(1); document.dispatchEvent(new Event('change')); });
        await guest.waitForFunction(() => deathState.players.length === 1);
        await host.evaluate(() => { recordDeath(deathState.players[0].id); document.dispatchEvent(new Event('change')); });
        await guest.evaluate(() => { recordDeath(deathState.players[0].id); document.dispatchEvent(new Event('change')); });
        await host.waitForFunction(() => deathState.players[0].deaths === 2);
        await guest.waitForFunction(() => deathState.players[0].deaths === 2);
        await guest.evaluate(() => { deathState.players[0].name = 'Shared name'; saveDeathState(); document.dispatchEvent(new Event('change')); });
        await host.waitForFunction(() => deathState.players[0].name === 'Shared name');

        await host.evaluate(() => { document.getElementById('protectionAltarGifts').value = '400'; selectedProtectionAltarLevel = 35; renderProtectionAltarCalculator(); document.dispatchEvent(new Event('change')); });
        await guest.waitForFunction(() => document.getElementById('protectionAltarGifts').value === '400');
        await host.evaluate(() => { window.NullscapeSound.setMuted(true); });
        await guest.waitForFunction(() => window.NullscapeSound.isMuted());

        await host.evaluate(() => { location.hash = '#/lobby'; });
        await host.locator('#lobbyEditorInput').fill('Linked toolkit');
        await guest.waitForFunction(() => document.getElementById('lobbyEditorInput').value === 'Linked toolkit');
        await guest.evaluate(() => { lobbyEditor.typingStyle.bold = true; syncLobbyToolbar(); document.dispatchEvent(new Event('change')); });
        await host.waitForFunction(() => lobbyEditor.typingStyle.bold);
        await host.evaluate(() => {
            window.NullscapeLobbyPicker.apply({ hue360: 120, sat: .75, val: .8, mode: 'gradient', activeStop: 1,
                gradient: [{ kind: 'two-stop', colors: ['#ff0000', '#00ff00'], dividers: [.4] }] });
            document.dispatchEvent(new Event('change'));
        });
        await guest.waitForFunction(() => window.NullscapeLobbyPicker.capture().mode === 'gradient'
            && window.NullscapeLobbyPicker.capture().gradient[0].colors[1] === '#00ff00');
        assert.equal(await guest.evaluate(() => location.hash), '#/curses', 'navigation remains independent');

        const baselineWrites = writes;
        await host.waitForTimeout(1200);
        assert.equal(writes, baselineWrites, 'no echoes or idle writes');
        await host.evaluate(() => { location.hash = '#/curses'; });
        await host.locator('.game-settings-bar').scrollIntoViewIfNeeded();
        await host.locator('.game-settings-bar').screenshot({ path: 'output/game-settings-divider.png' });
        await host.locator('#toolkitLink').scrollIntoViewIfNeeded();
        fs.mkdirSync('output', { recursive: true });
        await host.screenshot({ path: 'output/link-desktop.png' });
        await host.setViewportSize({ width: 390, height: 844 });
        await host.locator('#toolkitLink').scrollIntoViewIfNeeded();
        await host.screenshot({ path: 'output/link-mobile.png' });
        assert.equal(await host.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no mobile overflow');
        await host.locator('#linkLeave').click();
        await guest.waitForFunction(() => document.getElementById('linkBadge').dataset.state === 'error');
        assert.equal(await guest.locator('#levelInput').inputValue(), '31');
        assert.deepEqual(errors, []);
        console.log(`Browser Link checks passed; ${writes} change batches, ${externalRequests} external asset requests blocked, no production Firebase access. Screenshots: output/link-desktop.png, output/link-mobile.png`);
    } finally {
        await browser?.close();
        server.closePreviewClients();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
