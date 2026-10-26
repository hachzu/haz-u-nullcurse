(() => {
    function findReveals(previous, current) {
        if (!previous) return [];
        return [...current.keys()].filter(key => !previous.has(key)
            || (previous.get(key).locked && !current.get(key).locked));
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { findReveals };
        return;
    }

    const root = document.querySelector('.app');
    if (!root) return;
    const selector = '[data-reveal-key]';
    const lockedSelector = '.curse-card--locked, .enemy-button--locked, .upgrade-row--locked, .upgrade-row--pending';
    const containerSelector = '.result-grid, #enemyContainer, #activeCurseContainer, #upgradeCategories, #upgradeOwnedCategories';
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const lifetime = 10000;
    const highlights = new Map();
    let previous = null;
    let frame = 0;
    let expiryTimer;

    function keyFor(node) {
        const container = node.closest(containerSelector);
        return `${container?.id || 'cards'}/${node.dataset.revealKey}`;
    }

    function clearEffect(node) {
        node.querySelector(':scope > .card-reveal-effect')?.remove();
        node.classList.remove('card-reveal-host');
    }

    function decorate(node, start, now) {
        const elapsed = now - start;
        if (elapsed >= lifetime || node.querySelector(':scope > .card-reveal-effect')) return;
        const opacity = getComputedStyle(node).opacity;
        node.classList.add('card-reveal-host');
        const effect = document.createElement('span');
        effect.className = 'card-reveal-effect';
        effect.setAttribute('aria-hidden', 'true');
        effect.style.setProperty('--reveal-delay', `${-elapsed}ms`);
        effect.style.setProperty('--reveal-color', getComputedStyle(node).borderTopColor);
        if (elapsed < 5000) {
            const track = document.createElement('span');
            track.className = 'card-reveal-track';
            effect.appendChild(track);
        }
        const star = document.createElement('img');
        star.className = 'card-reveal-star';
        star.src = 'assets/branding/NewlyAvailableStar.svg';
        star.alt = '';
        star.width = 14;
        star.height = 14;
        effect.appendChild(star);
        node.appendChild(effect);
        if (!reducedMotion.matches && elapsed < 220) {
            node.animate([{ opacity: 0 }, { opacity }], {
                duration: 220, delay: -elapsed, easing: 'ease-out'
            });
        }
    }

    function scheduleExpiry(now) {
        clearTimeout(expiryTimer);
        if (!highlights.size) return;
        const nextExpiry = Math.min(...highlights.values()) + lifetime;
        expiryTimer = setTimeout(() => {
            const time = performance.now();
            for (const [key, start] of highlights) {
                if (time - start >= lifetime) highlights.delete(key);
            }
            root.querySelectorAll(selector).forEach(node => {
                if (!highlights.has(keyFor(node))) clearEffect(node);
            });
            scheduleExpiry(time);
        }, Math.max(1, nextExpiry - now));
    }

    function scan() {
        frame = 0;
        const now = performance.now();
        const current = new Map();
        root.querySelectorAll(selector).forEach(node => {
            current.set(keyFor(node), { node, locked: node.matches(lockedSelector) });
        });
        for (const key of findReveals(previous, current)) highlights.set(key, now);
        previous = current;
        for (const [key, entry] of current) {
            const start = highlights.get(key);
            if (start !== undefined) decorate(entry.node, start, now);
        }
        scheduleExpiry(now);
    }

    // Ignore number tweens, image loads and our own overlay nodes. Only card
    // insertion/removal schedules one scan after the synchronous render batch.
    scan();
    const observer = new MutationObserver(records => {
        const cardsChanged = records.some(record => [...record.addedNodes, ...record.removedNodes]
            .some(node => node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector))));
        if (cardsChanged && !frame) frame = requestAnimationFrame(scan);
    });
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener('pagehide', event => {
        if (event.persisted) return;
        observer.disconnect();
        cancelAnimationFrame(frame);
        clearTimeout(expiryTimer);
    });
})();
