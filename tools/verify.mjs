/**
 * Load the demo in a real headless browser and check that it works.
 *
 * Serves the project locally and drives it with the same minimal Chrome
 * driver the grid's own test suite uses (tools/browser.js), so this needs no
 * dependency beyond Chrome itself.
 *
 * Checks:
 *   - the library arrived and left the LatticeGrid global behind;
 *   - the source's maxRows window bites immediately: the first chunk hands
 *     over fifty instruments but the grid never holds more than forty of
 *     them (grid.rows.count());
 *   - cells change in place rather than the grid growing: the total ticks
 *     across every currently-held row rises over a few seconds while the
 *     row count stays at or under the forty-row window throughout;
 *   - clicking "Stop the feed" halts further updates (the ticks total and
 *     the row count both go still), and the button's own label flips;
 *   - nothing logged a console error or threw while the page ran.
 *
 * Exits non-zero on any failure, so it can gate a deployment.
 *
 * Usage: node tools/verify.mjs
 */

import { startServer } from './serve.mjs';
import { Browser, available } from './browser.js';

if (!available()) {
  console.log('No headless browser on this machine; skipping verify.mjs.');
  process.exit(0);
}

const rowCount = `window.__demoGrid.rows.count()`;
const ticksTotal = `(() => {
  const n = window.__demoGrid.rows.count();
  let total = 0;
  for (let i = 0; i < n; i++) total += window.__demoGrid.rows.get(i).data.ticks || 0;
  return total;
})()`;

const { server, port } = await startServer();
const browser = new Browser();

try {
  await browser.start();

  await browser.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__errs = [];
      addEventListener('error', (e) => window.__errs.push(String(e.message || e)));
      addEventListener('unhandledrejection', (e) => window.__errs.push('unhandledrejection: ' + String(e.reason)));
      const origError = console.error.bind(console);
      console.error = (...args) => { window.__errs.push('console.error: ' + args.map(String).join(' ')); origError(...args); };
    `,
  });

  await browser.open(`http://127.0.0.1:${port}/`);
  await new Promise((r) => setTimeout(r, 500));

  const failures = [];

  const hasGrid = await browser.evaluate(`typeof LatticeGrid !== 'undefined' && typeof LatticeGrid.createGrid === 'function'`);
  if (!hasGrid) failures.push('LatticeGrid.createGrid was not found on the page');

  // The first chunk hands over all fifty instruments at once; maxRows: 40
  // should cap that on arrival, before a single tick has run.
  const initialCount = await browser.evaluate(rowCount);
  // At most forty, not exactly forty: on a slow reader a few ticks may have
  // resent instruments the window had already evicted, so the count can settle
  // under the cap. The claim on the page is "never more than forty".
  if (initialCount < 1 || initialCount > 40) {
    failures.push(`expected the forty-row window to cap the first chunk immediately, grid held ${initialCount} rows`);
  }

  // Sample the row count repeatedly while the feed runs, so a transient
  // overshoot between chunks would be caught rather than missed by chance.
  const samples = [];
  const ticksBefore = await browser.evaluate(ticksTotal);
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 350));
    samples.push(await browser.evaluate(rowCount));
  }
  const overWindow = samples.filter((n) => n > 40);
  if (overWindow.length) {
    failures.push(`row count exceeded the forty-row window while the feed ran: saw ${JSON.stringify(overWindow)}`);
  }

  const ticksAfter = await browser.evaluate(ticksTotal);
  if (!(ticksAfter > ticksBefore)) {
    failures.push(`expected cells to keep changing in place (ticks total rising); was ${ticksBefore}, now ${ticksAfter}`);
  }

  // Stop the feed and confirm nothing more is applied.
  await browser.evaluate(`document.getElementById('toggle').click()`);
  const toggleLabel = await browser.evaluate(`document.getElementById('toggle').textContent`);
  if (!/start the feed/i.test(toggleLabel || '')) {
    failures.push(`expected the button to read "Start the feed" once stopped, read "${toggleLabel}"`);
  }
  const stoppedBefore = await browser.evaluate(ticksTotal);
  const stoppedCountBefore = await browser.evaluate(rowCount);
  await new Promise((r) => setTimeout(r, 1200));
  const stoppedAfter = await browser.evaluate(ticksTotal);
  const stoppedCountAfter = await browser.evaluate(rowCount);
  if (stoppedAfter !== stoppedBefore) {
    failures.push(`expected ticks to stay still once stopped; was ${stoppedBefore}, now ${stoppedAfter}`);
  }
  if (stoppedCountAfter !== stoppedCountBefore) {
    failures.push(`expected the row count to stay still once stopped; was ${stoppedCountBefore}, now ${stoppedCountAfter}`);
  }

  const errors = await browser.evaluate('window.__errs');
  if (errors.length) failures.push(`console/window errors: ${errors.join(' | ')}`);

  if (failures.length) {
    console.error('FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `OK: the forty-row window capped the first chunk immediately (${initialCount} of 50 held, at most 40) and stayed ` +
      `capped for the rest of the run, cells changed in place (ticks total ${ticksBefore} -> ${ticksAfter}), ` +
      'and stopping the feed halted further updates. 0 console errors.'
    );
  }
} finally {
  await browser.close();
  server.close();
}
