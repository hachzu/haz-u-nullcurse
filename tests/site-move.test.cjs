const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(require('node:path').join(__dirname, '../js/site-move.js'), 'utf8');

function visit(hostname, pathname) {
    const classes = new Set(['maintenance-active']);
    const window = {};
    const document = {
        documentElement: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } },
        createElement: () => ({}), head: { append() {} }, addEventListener() {}
    };
    vm.runInNewContext(code, { window, document, location: { hostname, pathname } });
    return { classes, window };
}
test('retired host recognizes normal, repeated-slash, nested and bare paths', () => {
    for (const path of ['/haz-u-nullcurse/', '//haz-u-nullcurse/', '/haz-u-nullcurse//contributors/', '/haz-u-nullcurse']) {
        const result = visit('hachzu.github.io', path);
        assert.equal(result.window.NullscapeMoved, true, path);
        assert.equal(result.classes.has('site-moved'), true, path);
        assert.equal(result.classes.has('maintenance-active'), false, path);
    }
});
test('current host and unrelated GitHub projects retain their normal screen', () => {
    for (const [host, path] of [['nullkits.pages.dev', '/'], ['hachzu.github.io', '/other-project/']]) {
        const result = visit(host, path);
        assert.equal(result.window.NullscapeMoved, undefined);
        assert.equal(result.classes.has('maintenance-active'), true);
    }
});
