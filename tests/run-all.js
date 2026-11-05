/**
 * tests/run-all.js
 * Master repository test runner for GymFlow regression and repair verification.
 * Runs all modular test suites using Node.js built-ins.
 */

const path = require('path');

const suites = [
  { name: 'Storage & Persistence', file: './storage.test.js' },
  { name: 'Import Validation & Sanitization', file: './import-validation.test.js' },
  { name: 'Security & XSS Prevention', file: './security.test.js' },
  { name: 'Algorithms & Telemetry Calculations', file: './calculations.test.js' },
  { name: 'Date Handling & Calendar Transitions', file: './date-handling.test.js' },
  { name: 'Accessibility & Responsive Design', file: './accessibility.test.js' }
];

console.log('====================================================');
console.log(' GYMFLOW ENGINEERING TEST SUITE — PHASE 3 REPAIRS');
console.log('====================================================\n');

let totalPassed = 0;
let totalFailed = 0;
const startTime = Date.now();

suites.forEach(suite => {
  try {
    const runSuite = require(suite.file);
    const result = runSuite();
    totalPassed += result.passed;
    totalFailed += result.failed;
    console.log('');
  } catch (err) {
    console.error(`Failed to execute suite: ${suite.name}`);
    console.error(err);
    totalFailed++;
  }
});

const elapsedMs = Date.now() - startTime;
console.log('====================================================');
console.log(` SUMMARY: ${totalPassed} passed, ${totalFailed} failed in ${elapsedMs}ms`);
console.log('====================================================');

if (totalFailed > 0) {
  console.error('\n❌ Test suite completed with failures.');
  process.exit(1);
} else {
  console.log('\n✅ All test suites passed successfully!');
  process.exit(0);
}

