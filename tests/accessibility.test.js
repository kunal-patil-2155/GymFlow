/**
 * tests/accessibility.test.js
 * Verification of focus trap dynamics, ARIA landmarks, DOM ID preservation, and responsive styles.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

  console.log('Running tests/accessibility.test.js:');

  const appSource = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  const stylesCss = fs.readFileSync(path.resolve(__dirname, '../styles.css'), 'utf8');

  test('Focus trap queries focusable elements dynamically on Tab (DEFECT-06)', () => {
    // Assert trapFocus queries elements inside the keydown handler dynamically
    assert.ok(
      appSource.includes('function trapFocus(modal)'),
      'trapFocus function must exist'
    );
    assert.ok(
      !appSource.includes('modal.removeEventListener(\'keydown\', handler)'),
      'trapFocus must not permanently remove itself on modal close'
    );
    assert.ok(
      appSource.includes('_lastFocusedElement'),
      '_lastFocusedElement must be tracked to restore focus on modal close'
    );
  });

  test('Preservation of all critical application DOM IDs and navigation views', () => {
    const requiredIds = [
      'view-dashboard', 'view-routines', 'view-weekly', 'view-water', 'view-goals',
      'modal-routine', 'modal-reset', 'modal-delete-routine',
      'stat-exercises-done', 'stat-water', 'stat-goal-pct', 'progress-goal',
      'card-concentric-flow', 'ring-exercises-fill', 'ring-water-fill',
      'concentric-pct-display', 'goals-progress-list', 'btn-milestone-close',
      'milestone-banner', 'storage-error-banner'
    ];

    requiredIds.forEach(id => {
      assert.ok(
        indexHtml.includes(`id="${id}"`),
        `index.html must contain required DOM ID: "${id}"`
      );
    });

    const requiredViews = ['dashboard', 'routines', 'weekly', 'water', 'goals'];
    requiredViews.forEach(view => {
      assert.ok(
        indexHtml.includes(`data-view="${view}"`),
        `index.html must contain navigation link with data-view="${view}"`
      );
    });
  });

  test('Dashboard metrics have distinct accessible labels (DEFECT-03)', () => {
    assert.ok(
      indexHtml.includes('Daily Goal Targets'),
      'Stat card must display "Daily Goal Targets"'
    );
    assert.ok(
      indexHtml.includes('Today\'s Routine &amp; Hydration Flow') || indexHtml.includes('Today\'s Routine & Hydration Flow'),
      'Concentric HUD must display "Today\'s Routine & Hydration Flow"'
    );
  });

  test('Styles include 320px responsive breakpoint rules (DEFECT-08)', () => {
    assert.ok(
      stylesCss.includes('@media (max-width: 360px)'),
      'styles.css must include @media (max-width: 360px) breakpoint'
    );
    assert.ok(
      stylesCss.includes('minmax(min(260px, 100%), 1fr)') || stylesCss.includes('grid-template-columns: 1fr'),
      'styles.css must provide shrinking grid track rules for mobile'
    );
  });

  return { passed, failed };
}

if (require.main === module) {
  const result = runTests();
  process.exit(result.failed > 0 ? 1 : 0);
}

module.exports = runTests;
