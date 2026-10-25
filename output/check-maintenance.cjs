const {chromium}=require('C:/Users/pardi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{let file=decodeURIComponent(req.url.split('?')[0]); if(file.endsWith('/'))file+='index.html';file=path.join(root,file);const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg'};fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try {
 browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/js/site-visits.js*',r=>r.fulfill({contentType:'text/javascript',body:''}));
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/#/upgrades');
 await page.waitForSelector('.maintenance-tools a');
 assert.equal(new URL(page.url()).hash,'#/');
 await page.getByRole('link',{name:'Death Tracker',exact:true}).click();
 await page.waitForSelector('#deathPanel.open',{timeout:30000});
 assert(await page.locator('#deathPanel').isVisible());
 assert.equal(await page.locator('#upgradeToggleButton').isVisible(),false);
 assert.equal(await page.locator('#altarsToggleButton').isVisible(),false);
 await page.screenshot({path:path.join(root,'output/maintenance-deaths.png')});
 await page.evaluate(()=>{setUpgradePanelOpen(true);setAltarsPanelOpen(true);});
 assert.equal(await page.locator('#upgradePanel').isVisible(),false);
 assert.equal(await page.locator('#altarsPanel').isVisible(),false);
 await page.locator('#deathBackButton').click();
 await page.waitForSelector('.maintenance-tools a');
 await page.getByRole('link',{name:'Lobby Name Maker',exact:true}).click();
 await page.waitForSelector('#lobbyPanel.open');
 await page.screenshot({path:path.join(root,'output/maintenance-lobby.png')});
 await page.goto(base+'/#/curses');
 await page.waitForSelector('.maintenance-tools a');
 assert.equal(new URL(page.url()).hash,'#/');
 await page.goto(base+'/Toolkits.html#/altars');
 await page.waitForSelector('.maintenance-tools a');
 assert.equal(new URL(page.url()).hash,'#/');
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('link',{name:'Death Tracker',exact:true}).click();
 await page.waitForSelector('#deathPanel.open');
 await page.screenshot({path:path.join(root,'output/maintenance-mobile.png')});
 assert.deepEqual(errors,[]);
 console.log('PASS: maintenance links, both tools, blocked routes and panels, back navigation, legacy links, mobile; no browser errors');
 } finally {await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

