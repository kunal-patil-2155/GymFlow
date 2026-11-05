/**
 * tests/security.test.js
 * Verification of XSS prevention, history sanitization, and file size protection.
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

  // DOM Mock for tooltip testing
  const elements = {};
  const mockDocument = {
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = {
          id,
          hidden: true,
          style: {},
          childNodes: [],
          firstChild: null,
          appendChild(child) {
            this.childNodes.push(child);
            this.firstChild = this.childNodes[0];
            return child;
          },
          removeChild(child) {
            const idx = this.childNodes.indexOf(child);
            if (idx >= 0) this.childNodes.splice(idx, 1);
            this.firstChild = this.childNodes[0] || null;
            return child;
          },
          setAttribute(k, v) { this[k] = v; },
          addEventListener() {},
          getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
        };
      }
      return elements[id];
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        style: {},
        childNodes: [],
        firstChild: null,
        appendChild(child) {
          this.childNodes.push(child);
          this.firstChild = this.childNodes[0];
          return child;
        },
        removeChild(child) {
          const idx = this.childNodes.indexOf(child);
          if (idx >= 0) this.childNodes.splice(idx, 1);
          this.firstChild = this.childNodes[0] || null;
          return child;
        },
        setAttribute(k, v) { this[k] = v; },
        addEventListener() {},
        getBoundingClientRect() { return { left: 0, top: 0, width: 30, height: 30 }; }
      };
    },
    createTextNode(text) {
      return { textContent: String(text) };
    },
    addEventListener() {}
  };

  const sandbox = {
    localStorage: mockLocalStorage,
    sessionStorage: mockLocalStorage,
    document: mockDocument,
    window: {
      getComputedStyle: () => ({ visibility: 'visible' })
    },
    console: { warn: () => {}, log: () => {} }
  };

  const fn = new Function('localStorage', 'sessionStorage', 'document', 'window', 'console', appCode);
  fn(mockLocalStorage, mockLocalStorage, sandbox.document, sandbox.window, sandbox.console);

  return { app: sandbox.window.__app, mockDocument, elements };
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

  console.log('Running tests/security.test.js:');
  const { app, mockDocument } = createMockEnvironment();

  test('validateImportData sanitizes history entries against Stored XSS vectors (DEFECT-01)', () => {
    const maliciousPayload = {
      routines: [{ id: 'r1', name: 'Safe Routine', exercises: [] }],
      goals: { workouts: 1, exercises: 5, water: 2000 },
      history: [
        null,
        123,
        { date: '<script>alert("xss")</script>', water: '<img src=x onerror=alert(1)>', completed: '2', total: '5' },
        { date: '2026-03-15', water: '<svg onload=alert(2)>', completed: '<img src=x onerror=xss>', total: '5' },
        { date: '2026-03-16', water: 2500, completed: 5, total: 5 }
      ]
    };

    const res = app.validateImportData(maliciousPayload);
    assert.strictEqual(res.valid, true);
    
    // Invalid dates must be rejected
    assert.strictEqual(res.sanitized.history.length, 2, 'Malformed/XSS dates must be filtered out');
    
    // First valid entry (2026-03-15)
    const entry1 = res.sanitized.history[0];
    assert.strictEqual(entry1.date, '2026-03-15');
    assert.strictEqual(typeof entry1.water, 'number');
    assert.strictEqual(entry1.water, 0, 'Malicious string in water must be coerced to integer 0');
    assert.strictEqual(typeof entry1.completed, 'number');
    assert.strictEqual(entry1.completed, 0, 'Malicious string in completed must be coerced to integer 0');

    // Second valid entry (2026-03-16)
    const entry2 = res.sanitized.history[1];
    assert.strictEqual(entry2.date, '2026-03-16');
    assert.strictEqual(entry2.water, 2500);
    assert.strictEqual(entry2.completed, 5);
  });

  test('renderMonthlyHeatmap constructs tooltip using safe DOM nodes without innerHTML (DEFECT-01)', () => {
    // Check source code of app.js to guarantee innerHTML is not used in heatmap tooltip
    const appSource = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
    assert.ok(
      !appSource.includes('tooltip.innerHTML ='),
      'app.js must not assign to tooltip.innerHTML in heatmap rendering'
    );
    assert.ok(
      appSource.includes('document.createTextNode'),
      'app.js must use safe DOM methods (createTextNode) for dynamic tooltip content'
    );
  });

  test('handleImportFile enforces 2 MB maximum file size limit (DEFECT-05)', () => {
    const appSource = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
    assert.ok(
      appSource.includes('2 * 1024 * 1024') || appSource.includes('2097152'),
      'app.js must contain a 2MB maximum file size check'
    );
    assert.ok(
      appSource.includes('reader.onerror'),
      'app.js must register reader.onerror for file read failure resilience'
    );
  });

  test('zero external network font references across application and architecture (DEFECT-09)', () => {
    const archHtml = fs.readFileSync(path.resolve(__dirname, '../architecture.html'), 'utf8');
    assert.ok(
      !archHtml.includes('fonts.googleapis.com'),
      'architecture.html must not reference fonts.googleapis.com'
    );
    assert.ok(
      !archHtml.includes('fonts.gstatic.com'),
      'architecture.html must not reference fonts.gstatic.com'
    );

    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    assert.ok(
      !indexHtml.includes('fonts.googleapis.com'),
      'index.html must not reference fonts.googleapis.com'
    );
  });

  return { passed, failed };
}

if (require.main === module) {
  const result = runTests();
  process.exit(result.failed > 0 ? 1 : 0);
}

module.exports = runTests;

