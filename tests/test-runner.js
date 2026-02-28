/**
 * Minimal browser-based test runner.
 *
 * Provides describe/it/assert primitives and renders results into the DOM.
 * No dependencies — just load via <script> and call TestRunner.run().
 */
class TestRunner {
    constructor() {
        this.suites = [];
        this.passed = 0;
        this.failed = 0;
        this.errors = [];
    }

    /** Register a test suite (group of tests). */
    describe(name, fn) {
        this.suites.push({ name, fn });
    }

    /** Execute all registered suites and render results. */
    run() {
        const container = document.getElementById('test-results');
        if (!container) {
            console.error('Missing #test-results element');
            return;
        }

        for (const suite of this.suites) {
            const section = document.createElement('div');
            section.className = 'suite';

            const heading = document.createElement('h2');
            heading.textContent = suite.name;
            section.appendChild(heading);

            const tests = [];
            const it = (name, fn) => tests.push({ name, fn });

            // Collect tests
            suite.fn(it);

            // Run each test
            for (const test of tests) {
                const result = document.createElement('div');
                result.className = 'test';

                try {
                    test.fn();
                    this.passed++;
                    result.classList.add('pass');
                    result.textContent = `✓ ${test.name}`;
                } catch (err) {
                    this.failed++;
                    result.classList.add('fail');
                    this.errors.push({ suite: suite.name, test: test.name, error: err });

                    const label = document.createElement('span');
                    label.textContent = `✗ ${test.name}`;
                    result.appendChild(label);

                    const detail = document.createElement('pre');
                    detail.className = 'error-detail';
                    detail.textContent = err.message;
                    result.appendChild(detail);
                }

                section.appendChild(result);
            }

            container.appendChild(section);
        }

        this.renderSummary(container);
    }

    renderSummary(container) {
        const total = this.passed + this.failed;
        const summary = document.getElementById('test-summary');
        if (!summary) return;

        summary.textContent = `${total} tests — ${this.passed} passed, ${this.failed} failed`;
        summary.className = this.failed > 0 ? 'summary fail' : 'summary pass';
    }
}

/** Assertion helpers. */
const assert = {
    equal(actual, expected, msg) {
        if (actual !== expected) {
            throw new Error(
                (msg ? msg + ': ' : '') +
                `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
            );
        }
    },

    notEqual(actual, expected, msg) {
        if (actual === expected) {
            throw new Error(
                (msg ? msg + ': ' : '') +
                `expected value to differ from ${JSON.stringify(expected)}`
            );
        }
    },

    ok(value, msg) {
        if (!value) {
            throw new Error(msg || `expected truthy value, got ${JSON.stringify(value)}`);
        }
    },

    deepEqual(actual, expected, msg) {
        const a = JSON.stringify(actual);
        const e = JSON.stringify(expected);
        if (a !== e) {
            throw new Error(
                (msg ? msg + ': ' : '') +
                `expected ${e}, got ${a}`
            );
        }
    },

    includes(array, item, msg) {
        if (!Array.isArray(array) || !array.includes(item)) {
            throw new Error(
                (msg ? msg + ': ' : '') +
                `expected array to include ${JSON.stringify(item)}`
            );
        }
    },

    hasProperty(obj, prop, msg) {
        if (!(prop in obj)) {
            throw new Error(
                (msg ? msg + ': ' : '') +
                `expected object to have property "${prop}"`
            );
        }
    }
};

// Global runner instance
const runner = new TestRunner();
function describe(name, fn) { runner.describe(name, fn); }
