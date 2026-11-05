/**
 * tests/storage.test.js
 * Verification of LocalStorage handling, schema validation, and recovery.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser environment for Node.js
function createMockEnvironment() {
  const store = {};
  const mockLocalStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, val) { store[key] = String(val); },
    removeItem(key) { delete store[key]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
    _store: store
  };

  const appCode = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');

  // Evaluate in sandbox context
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

  return { sandbox, store: mockLocalStorage._store, app: sandbox.window.__app };
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

  console.log('Running tests/storage.test.js:');

  test('Storage.load returns null when key does not exist', () => {
    const { app } = createMockEnvironment();
    assert.strictEqual(app.Storage.load(), null);
  });

  test('Storage.load rejects non-object JSON and backs up corrupted string (DEFECT-02)', () => {
    const { app, store } = createMockEnvironment();
    
    // Test number
    store['gymflow_state'] = '123';
    assert.strictEqual(app.Storage.load(), null);
    assert.strictEqual(store['gymflow_corrupted_backup'], '123');

    // Test boolean
    store['gymflow_state'] = 'true';
    assert.strictEqual(app.Storage.load(), null);
    assert.strictEqual(store['gymflow_corrupted_backup'], 'true');

    // Test array
    store['gymflow_state'] = '[1, 2, 3]';
    assert.strictEqual(app.Storage.load(), null);
    assert.strictEqual(store['gymflow_corrupted_backup'], '[1, 2, 3]');

    // Test invalid JSON syntax
    store['gymflow_state'] = '{ invalid json';
    assert.strictEqual(app.Storage.load(), null);
    assert.strictEqual(store['gymflow_corrupted_backup'], '{ invalid json');
  });

  test('isValidState validates required top-level state shape', () => {
    const { app } = createMockEnvironment();
    assert.strictEqual(app.isValidState(null), false);
    assert.strictEqual(app.isValidState(123), false);
    assert.strictEqual(app.isValidState('string'), false);
    assert.strictEqual(app.isValidState([]), false);
    assert.strictEqual(app.isValidState({}), false);
    assert.strictEqual(app.isValidState({ today: {} }), false);

    const validState = app.makeSampleData();
    assert.strictEqual(app.isValidState(validState), true);
  });

  test('State.init recovers gracefully from corrupted storage without crashing', () => {
    const { app, store } = createMockEnvironment();
    store['gymflow_state'] = '{"corrupted": true}';

    // Before fix, this would crash on s.today.date
    assert.doesNotThrow(() => {
      app.State.init();
    });

    const current = app.State.get();
    assert.ok(current, 'State should exist');
    assert.ok(current.today, 'State.today should exist');
    assert.strictEqual(typeof current.today.date, 'string');
    assert.ok(Array.isArray(current.routines));
    assert.ok(store['gymflow_corrupted_backup'], 'Corrupted raw data must be backed up');
  });

  test('State.init preserves valid state and performs calendar-day transition if needed', () => {
    const { app, store } = createMockEnvironment();
    const sample = app.makeSampleData();
    sample.today.date = '2020-01-01'; // Past date
    sample.today.completed = ['e1'];
    store['gymflow_state'] = JSON.stringify(sample);

    app.State.init();
    const current = app.State.get();
    assert.strictEqual(current.today.date, app.todayKey());
    assert.strictEqual(current.today.completed.length, 0); // reset for new day
    assert.ok(current.history.some(h => h.date === '2020-01-01'), 'Past day must be archived');
    assert.ok(current.history.some(h => h.date === app.todayKey()), 'Current day must be synced');
  });

  return { passed, failed };
}

if (require.main === module) {
  const result = runTests();
  process.exit(result.failed > 0 ? 1 : 0);
}

module.exports = runTests;
