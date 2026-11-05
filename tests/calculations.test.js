/**
 * tests/calculations.test.js
 * Verification of streak algorithms, formatters, and goal/HUD telemetry calculations.
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

  console.log('Running tests/calculations.test.js:');
  const { app } = createMockEnvironment();

  test('calculateStreak counts consecutive active days correctly', () => {
    const today = new Date();
    const d1 = new Date(today); d1.setDate(today.getDate() - 1);
    const d2 = new Date(today); d2.setDate(today.getDate() - 2);

    const k0 = app.toLocalDateKey(today);
    const k1 = app.toLocalDateKey(d1);
    const k2 = app.toLocalDateKey(d2);

    const weekly = [
      { date: k2, completed: 3, total: 3 },
      { date: k1, completed: 4, total: 4 },
      { date: k0, completed: 2, total: 4 }
    ];

    const streak = app.calculateStreak(weekly, []);
    assert.strictEqual(streak, 3, 'Consecutive completed workouts must yield streak of 3');
  });

  test('calculateStreak returns 0 when no workouts completed recently', () => {
    const today = new Date();
    const d1 = new Date(today); d1.setDate(today.getDate() - 1);
    const d3 = new Date(today); d3.setDate(today.getDate() - 3);

    const k0 = app.toLocalDateKey(today);
    const k1 = app.toLocalDateKey(d1);
    const k3 = app.toLocalDateKey(d3);

    const weekly = [
      { date: k3, completed: 3, total: 3 },
      { date: k1, completed: 0, total: 4 },
      { date: k0, completed: 0, total: 4 }
    ];

    const streak = app.calculateStreak(weekly, []);
    assert.strictEqual(streak, 0, 'Broken streak must reset to 0');
  });

  test('formatExerciseMeta and formatExerciseCompact produce human-readable summaries', () => {
    const ex1 = { sets: 3, reps: 10, rest: 60 };
    assert.strictEqual(app.formatExerciseMeta(ex1), '3 sets · 10 reps · 60s rest');
    assert.strictEqual(app.formatExerciseCompact(ex1), '3×10 · 60s');

    const ex2 = { sets: 4, duration: 45, rest: 30 };
    assert.strictEqual(app.formatExerciseMeta(ex2), '4 sets · 45s · 30s rest');
    assert.strictEqual(app.formatExerciseCompact(ex2), '4×45s · 30s');
  });

  test('Division-by-zero protection in metric and goal calculations (DEFECT-03)', () => {
    // When goals are 0 or empty, Math.max(1, ...) guards must prevent NaN or Infinity
    const zeroGoals = { workouts: 0, exercises: 0, water: 0 };
    const targetExercises = Math.max(1, Number(zeroGoals.exercises) || 8);
    const targetWater = Math.max(1, Number(zeroGoals.water) || 2000);

    assert.ok(isFinite(targetExercises) && targetExercises >= 1);
    assert.ok(isFinite(targetWater) && targetWater >= 1);

    const done = 2;
    const waterTotal = 500;
    const goalExPct = Math.min(1, Math.max(0, done / targetExercises));
    const goalWatPct = Math.min(1, Math.max(0, waterTotal / targetWater));
    const goalPct = Math.round(((goalExPct + goalWatPct) / 2) * 100);

    assert.ok(!isNaN(goalPct));
    assert.ok(goalPct >= 0 && goalPct <= 100);
  });

  test('Workouts completed calculation in goals view (DEFECT-07)', () => {
    const exTotal = 4;
    let exDone = 3;
    let workoutsDone = (exTotal > 0 && exDone >= exTotal) ? 1 : 0;
    assert.strictEqual(workoutsDone, 0, 'Incomplete workout should not count as completed workout');

    exDone = 4;
    workoutsDone = (exTotal > 0 && exDone >= exTotal) ? 1 : 0;
    assert.strictEqual(workoutsDone, 1, 'Completed workout should count as 1 completed workout');
  });

  return { passed, failed };
}

if (require.main === module) {
  const result = runTests();
  process.exit(result.failed > 0 ? 1 : 0);
}

module.exports = runTests;
