/**
 * Patch fifty rows in place from a simulated feed, held to a forty-row window.
 *
 * `source: { mode: 'stream', open }` reads rows from an async iterator: the
 * feed's first chunk seeds the fifty instruments, and every chunk after that
 * resends a few of them with a new price. A resent row names an id already
 * on screen, so the grid matches it to its existing key and patches the
 * cells that moved rather than adding a duplicate row. `maxRows` bounds how
 * many rows the source ever holds, dropping the oldest to make room as new
 * ones arrive, which is why the grid never grows past forty even though
 * fifty instruments feed it. `highlightOnChange` flashes exactly the cells a
 * chunk touched.
 */

// Tied to toclocoinc.github.io only; has no effect anywhere else and needs
// no key at all to run this page from a local copy.
LatticeGrid.setLicence(
  'LG1.eyJ2IjoxLCJwIjoibGF0dGljZS1ncmlkIiwidCI6IlRPQ0xPQ08gSW5jIC0gcHVibGljIGRlbW9zIiwiZSI6IjIwMzAtMDEtMDEiLCJkIjpbInRvY2xvY29pbmMuZ2l0aHViLmlvIl19.9De42ua3aCGpiMB6EVRP7Tv-upUlDI-0T07rlSPzvCrsqg8t4YJi7SRnStEpAg48uzmcG7il1fR_TfwkUE7iCA'
);

const DESKS = ['Rates', 'FX', 'Credit', 'Equities'];
const INSTRUMENTS = Array.from({ length: 50 }, (_, i) => ({
  id: `INST${i + 1}`,
  symbol: `SYM${String(i + 1).padStart(2, '0')}`,
  desk: DESKS[i % DESKS.length],
  price: Math.round((20 + Math.random() * 480) * 100) / 100,
  change: 0,
  ticks: 0,
}));

let running = true;
let cursor = 0;
let applied = 0;

// A simulated feed, read the same way a websocket or SSE reader would be: as
// an async iterator of chunks. The first chunk is the fifty starting rows;
// every chunk after that resends four rows, moving through the instruments
// in order, so every one of the fifty gets ticked in turn.
async function* feed() {
  yield { rows: INSTRUMENTS.map((row) => ({ ...row })) };
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (!running) continue; // the feed keeps ticking; the grid just isn't fed
    const batch = [];
    for (let n = 0; n < 4; n++) {
      const row = INSTRUMENTS[cursor % INSTRUMENTS.length];
      cursor += 1;
      row.change = Math.round((Math.random() - 0.5) * 200) / 100;
      row.price = Math.max(1, Math.round((row.price + row.change) * 100) / 100);
      row.ticks += 1;
      batch.push({ ...row });
    }
    applied += batch.length;
    yield { rows: batch };
  }
}

const grid = LatticeGrid.createGrid(document.getElementById('grid'), {
  rowKey: 'id',
  columnDefaults: { sort: true },
  highlightOnChange: { duration: 500 },
  source: {
    mode: 'stream',
    maxRows: 40, // never holds more than this many, whichever forty last ticked
    open: () => feed(),
  },
  columns: [
    { field: 'symbol', title: 'Symbol', layout: { width: 110 } },
    { field: 'desk', title: 'Desk', layout: { width: 110 } },
    {
      field: 'price', title: 'Price', type: 'number',
      format: { style: 'currency', currency: 'USD', decimals: 2 },
      layout: { width: 130 },
    },
    { field: 'change', title: 'Change', type: 'number', format: { decimals: 2 }, layout: { width: 100 } },
    { field: 'ticks', title: 'Ticks', type: 'number', layout: { width: 90 } },
  ],
  rows: [],
});
window.__demoGrid = grid; // read by tools/verify.mjs

const toggle = document.getElementById('toggle');
toggle.addEventListener('click', () => {
  running = !running;
  toggle.textContent = running ? 'Stop the feed' : 'Start the feed';
});

setInterval(() => {
  document.getElementById('stat').textContent =
    `${grid.rows.count()} of 50 instruments held (window: 40) · ${applied} price updates applied` +
    (running ? '' : ' · feed stopped');
}, 250);
