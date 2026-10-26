const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findReveals } = require('../js/card-reveals.js');
const cards = (...entries) => new Map(entries.map(([key, locked]) => [key, { locked, node: {} }]));

test('initial page load and ordinary redraws do not highlight every card', () => {
    const before = cards(['curse:Bell', false], ['upgrade:Shield', true]);
    assert.deepEqual(findReveals(null, before), []);
    assert.deepEqual(findReveals(before, cards(['curse:Bell', false], ['upgrade:Shield', true])), []);
});
test('newly revealed cards and previously locked cards becoming available highlight once', () => {
    const before = cards(['upgrade:Shield', true]);
    const after = cards(['upgrade:Shield', false], ['curse:Shotgun', false]);
    assert.deepEqual(findReveals(before, after), ['upgrade:Shield', 'curse:Shotgun']);
    assert.deepEqual(findReveals(after, cards(['upgrade:Shield', false], ['curse:Shotgun', false])), []);
});
test('removals, locking and replacing DOM nodes do not trigger new-card effects', () => {
    assert.deepEqual(findReveals(cards(['enemy:Baby', false], ['enemy:Bell', false]), cards(['enemy:Baby', true])), []);
});
