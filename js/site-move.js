/* Only the retired GitHub Pages address shows this notice. */
(() => {
    'use strict';
    const oldBase = '/haz-u-nullcurse/';
    if (location.hostname !== 'hachzu.github.io' ||
        !(location.pathname === oldBase.slice(0, -1) || location.pathname.startsWith(oldBase))) return;

    window.NullscapeMoved = true;
    document.documentElement.classList.add('site-moved');
    const style = document.createElement('style');
    style.textContent = `
        html.site-moved body { margin: 0; background: #090510; color: #eee6f7; }
        html.site-moved body > :not(#siteMoveNotice) { display: none !important; }
        html.site-moved body #siteMoveNotice {
            display: flex !important; position: fixed; inset: 0; z-index: 1000;
            box-sizing: border-box; flex-direction: column; align-items: center;
            justify-content: center; padding: 28px 28px 88px; text-align: center;
            background: radial-gradient(ellipse at 50% 45%, #241333, #090510 70%);
            font: 16px/1.6 system-ui, sans-serif;
        }
        #siteMoveNotice h1 { margin: 0 0 12px; font: 500 clamp(28px, 6vw, 40px)/1.2 Georgia, serif; color: #f1deff; }
        #siteMoveNotice p { max-width: 540px; margin: 0 0 24px; color: #c3b7ce; }
        #siteMoveNotice a { color: #e2bff8; text-underline-offset: 3px; }
        #siteMoveNotice .move-button { padding: 12px 24px; border: 1px solid #b588d0;
            background: #d9b9ee; color: #1b0d25; font-weight: 600; text-decoration: none; }
        #siteMoveNotice .move-button:hover { background: #ead6f7; }
        #siteMoveNotice a:focus-visible { outline: 2px solid white; outline-offset: 5px; }
        #siteMoveNotice footer { position: absolute; right: 24px; bottom: 20px;
            max-width: calc(100% - 48px); color: #a590b5; font-size: 12px; text-align: right; }
        #siteMoveNotice footer a { text-decoration: underline; }
    `;
    document.head.append(style);
    document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.classList.remove('intro-pending');
        document.title = 'We’ve moved · Nullscape Toolkits';
        const notice = document.createElement('main');
        notice.id = 'siteMoveNotice';
        notice.innerHTML = '<h1>Nullscape Toolkits has moved</h1>' +
            '<p>hello everyone! i\'d like to let you know that the main website has moved to a different address! ' +
            'the current github pages didn\'t really want me to upload files at a bigger rate, ' +
            'so our current website is now at: <a class="move-destination" href="https://nullkits.pages.dev/">https://nullkits.pages.dev/</a>. ' +
            'thank you for using my tool! &lt;3</p>' +
            '<a class="move-button move-destination" href="https://nullkits.pages.dev/">Open the new site</a>' +
            '<footer>this project will stay <a href="https://github.com/hachzu/haz-u-nullcurse" target="_blank" rel="noopener noreferrer">open-sourced</a>.</footer>';
        const link = notice.querySelector('.move-button');
        const updateLink = () => {
            const path = location.pathname.slice(oldBase.length).replace(/index\.html$/, '');
            const destination = new URL(path === 'Toolkits.html' ? './' : path, 'https://nullkits.pages.dev/');
            destination.search = location.search;
            destination.hash = location.hash;
            notice.querySelectorAll('.move-destination').forEach(anchor => { anchor.href = destination.href; });
        };
        updateLink();
        window.addEventListener('hashchange', updateLink);
        document.body.append(notice);
        link.focus({ preventScroll: true });
    }, { once: true });
})();
