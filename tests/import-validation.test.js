/**
 * tests/import-validation.test.js
 * Verification of backup import data validation, sanitization, and error handling.
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
    sessionStorage: mockMock = mockLocalStorage,
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

  console.log('Running tests/import-validation.test.js:');
  const { app } = createMockEnvironment();

  test('validateImportData rejects non-objects and primitives', () => {
    assert.strictEqual(app.validateImportData(null).valid, false);
    assert.strictEqual(app.validateImportData('invalid').valid, false);
    assert.strictEqual(app.validateImportData(12345).valid, false);
    assert.strictEqual(app.validateImportData([]).valid, false);
    assert.strictEqual(app.validateImportData(true).valid, false);
  });

  test('validateImportData rejects missing or empty routines', () => {
    assert.strictEqual(app.validateImportData({}).valid, false);
    assert.strictEqual(app.validateImportData({ routines: [] }).valid, false);
    assert.strictEqual(app.validateImportData({ routines: [null] }).valid, false);
    assert.strictEqual(app.validateImportData({ routines: [{ name: '' }] }).valid, false);
    assert.strictEqual(app.validateImportData({ routines: [{ name: 'Test' }] }).valid, false); // missing exercises array
  });

  test('validateImportData rejects invalid goals configuration', () => {
    const validRoutine = { id: 'r1', name: 'Valid Routine', exercises: [] };
    assert.strictEqual(app.validateImportData({ routines: [validRoutine] }).valid, false);
    assert.strictEqual(app.validateImportData({ routines: [validRoutine], goals: null }).valid, false);
    assert.strictEqual(app.validateImportData({ routines: [validRoutine], goals: { workouts: 0 } }).valid, false);
    assert.strictEqual(app.validateImportData({ routines: [validRoutine], goals: { workouts: 1, exercises: 0 } }).valid, false);
    assert.strictEqual(app.validateImportData({ routines: [validRoutine], goals: { workouts: 1, exercises: 5, water: 50 } }).valid, false);
  });

  test('validateImportData sanitizes exercises and handles null/primitive exercises without throwing (DEFECT-04)', () => {
    const malformedPayload = {
      routines: [
        {
          id: 'r1',
          name: 'Heavy Leg Day',
          category: 'legs',
          exercises: [
            null, // null exercise
            123,  // primitive
            { id: 'e1', name: 'Squats', sets: 5, reps: 5, duration: 0, rest: 180 },
            { id: '', name: '  Leg Press  ', sets: 9999, reps: -50, duration: 9999999, rest: 999999 }
          ]
        }
      ],
      goals: { workouts: 2, exercises: 10, water: 2500 }
    };

    let result;
    assert.doesNotThrow(() => {
      result = app.validateImportData(malformedPayload);
    });

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.sanitized.routines.length, 1);
    const routine = result.sanitized.routines[0];
    assert.strictEqual(routine.exercises.length, 2, 'Null and primitive exercises must be discarded');
    
    const ex1 = routine.exercises[0];
    assert.strictEqual(ex1.name, 'Squats');
    assert.strictEqual(ex1.sets, 5);
    assert.strictEqual(ex1.reps, 5);

    const ex2 = routine.exercises[1];
    assert.strictEqual(ex2.name, 'Leg Press');
    assert.strictEqual(ex2.sets, 50, 'Sets must be clamped to max 50');
    assert.strictEqual(ex2.reps, 0, 'Negative reps must be clamped to min 0');
    assert.strictEqual(ex2.duration, 86400, 'Duration must be clamped to max 86400');
    assert.strictEqual(ex2.rest, 3600, 'Rest must be clamped to max 3600');
  });

  test('validateImportData sanitizes categories and falls back for unknown categories', () => {
    const payload = {
      routines: [
        { id: 'r1', name: 'Routine 1', category: 'EXOTIC_UNKNOWN', exercises: [] },
        { id: 'r2', name: 'Routine 2', category: 'BACK', exercises: [] }
      ],
      goals: { workouts: 1, exercises: 5, water: 2000 }
    };

    const res = app.validateImportData(payload);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.sanitized.routines[0].category, 'chest');
    assert.strictEqual(res.sanitized.routines[1].category, 'back');
  });

  test('validateImportData validates today routineId and falls back safely if invalid', () => {
    const payload = {
      routines: [{ id: 'valid-r1', name: 'Routine 1', exercises: [] }],
      goals: { workouts: 1, exercises: 5, water: 2000 },
      today: { routineId: 'non-existent-id' }
    };

    const res = app.validateImportData(payload);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.sanitized.today.routineId, 'valid-r1');
  });

  return { passed, failed };
}

if (require.main === module) {
  const result = runTests();
  process.exit(result.failed > 0 ? 1 : 0);
}

module.exports = runTests;

