/**
 * tests/date-handling.test.js
 * Verification of local date keys, formatting, timezones, and rolling weekly window.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function createMockEnvironment() {
  const store = {};
  const mockLocalStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, val) { store[key] = String(val); },
    removeItem(key) { delete store[key]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); }
  };

  const appCode = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');

  const sandbox = {
    localStorage: mockLocalStorage,
    sessionStorage: mockLocalStorage,
    document: {
      getElementById: () => null,
      addEventListener: () => {},
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} })
    },
    window: {},
    console: { warn: () => {}, log: () => {} }
  };

  const fn = new Function('localStorage', 'sessionStorage', 'document', 'window', 'console', appCode);
  fn(mockLocalStorage, mockLocalStorage, sandbox.document, sandbox.window, sandbox.console);

  return { app: sandbox.window.__app };
}

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(err);
    }
  }

  console.log('Running tests/date-handling.test.js:');
  const { app } = createMockEnvironment();

  test('todayKey produces ISO YYYY-MM-DD string matching local date', () => {
    const key = app.todayKey();
    assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    assert.strictEqual(key, expected);
  });

  test('toLocalDateKey formats leap day and month transitions accurately', () => {
    const leapDay = new Date(2024, 1, 29, 23, 59, 59); // Feb 29, 2024
    assert.strictEqual(app.toLocalDateKey(leapDay), '2024-02-29');

    const yearEnd = new Date(2025, 11, 31, 12, 0, 0); // Dec 31, 2025
    assert.strictEqual(app.toLocalDateKey(yearEnd), '2025-12-31');

    const yearStart = new Date(2026, 0, 1, 0, 0, 1); // Jan 1, 2026
    assert.strictEqual(app.toLocalDateKey(yearStart), '2026-01-01');
  });

  test('parseLocalDate avoids timezone UTC off-by-one shifts', () => {
    const parsed = app.parseLocalDate('2026-07-04');
    assert.strictEqual(parsed.getFullYear(), 2026);
    assert.strictEqual(parsed.getMonth(), 6); // July (0-indexed)
    assert.strictEqual(parsed.getDate(), 4);
  });

  test('buildEmptyWeek generates exactly 7 continuous days ending today', () => {
    const week = app.buildEmptyWeek();
    assert.strictEqual(week.length, 7);
    const today = app.todayKey();
    assert.strictEqual(week[6].date, today);

    // Verify each day is continuous
    for (let i = 0; i < 6; i++) {
      const d1 = app.parseLocalDate(week[i].date);
      const d2 = app.parseLocalDate(week[i + 1].date);
      const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      assert.strictEqual(diffDays, 1, `Day ${week[i].date} to ${week[i + 1].date} must be consecutive`);
    }
  });

  return { passed, failed };
}

if (require.main === module) {
  const result = runTests();
  process.exit(result.failed > 0 ? 1 : 0);
}

module.exports = runTests;

