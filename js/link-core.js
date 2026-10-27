/* Small, transport-independent field merge. No timers or network while unlinked. */
(function (root) {
    'use strict';
    const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
    const keyFor = path => encodeURIComponent(JSON.stringify(path)).replace(/\./g, '%2E');
    function flatten(value, path = [], out = {}) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            for (const key of Object.keys(value).sort()) {
                if (!forbidden.has(key)) flatten(value[key], [...path, key], out);
            }
        } else {
            out[keyFor(path)] = JSON.stringify(value);
        }
        return out;
    }
    function expand(fields) {
        const out = Object.create(null);
        for (const [key, encoded] of Object.entries(fields)) {
            if (typeof encoded !== 'string' || encoded.length > 16384) continue;
            try {
                const path = JSON.parse(decodeURIComponent(key));
                if (!Array.isArray(path) || !path.length || path.length > 10
                    || path.some(part => typeof part !== 'string' || forbidden.has(part))) continue;
                let target = out;
                for (const part of path.slice(0, -1)) {
                    if (!target[part] || typeof target[part] !== 'object') target[part] = Object.create(null);
                    target = target[part];
                }
                target[path.at(-1)] = JSON.parse(encoded);
            } catch (_) { /* Ignore malformed remote fields. */ }
        }
        return out;
    }
    function diff(before, after) {
        const patch = {};
        for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (before[key] !== after[key]) patch[key] = after[key] ?? null;
        }
        return patch;
    }
    function patchFields(target, patch) {
        for (const [key, value] of Object.entries(patch)) {
            if (value === null) delete target[key];
            else target[key] = value;
        }
    }
    function validateFields(fields) {
        const entries = Object.entries(fields);
        if (entries.length > 2048 || JSON.stringify(fields).length > 262144
            || entries.some(([key, value]) => key.length > 768 || typeof value !== 'string' || value.length > 16384)) {
            throw new Error('This toolkit is too large to link. Clear some death history and try again.');
        }
    }
    class FieldMerge {
        constructor(initial) {
            this.fields = { ...initial };
            this.observed = { ...initial };
            this.pending = {};
        }
        local(next) {
            const changes = diff(this.observed, next);
            Object.assign(this.pending, changes);
            patchFields(this.fields, changes);
            this.observed = { ...next };
            return changes;
        }
        remote(patch) {
            // Preserve unsent local edits to the same field; other edits merge.
            const accepted = Object.fromEntries(Object.entries(patch)
                .filter(([key]) => !Object.hasOwn(this.pending, key)));
            patchFields(this.fields, accepted);
            return accepted;
        }
        rendered(actual) { this.observed = { ...actual }; }
        take() { const patch = this.pending; this.pending = {}; return patch; }
        retry(patch) { this.pending = { ...patch, ...this.pending }; }
    }
    const api = { flatten, expand, diff, patchFields, validateFields, FieldMerge };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.NullscapeLinkCore = api;
}(typeof window !== 'undefined' ? window : globalThis));
