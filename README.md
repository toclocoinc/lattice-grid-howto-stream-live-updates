# How to stream live updates into a grid

Fifty instruments load from a simulated feed read as an async iterator (`source: { mode: 'stream',
open }`), then the feed keeps resending four of them a tick with a new price. Each resend names an
id already on screen, so the grid patches that row's cells in place rather than adding a duplicate,
and `highlightOnChange` flashes exactly the cells that moved. `maxRows: 40` bounds the source, so
the grid never holds more than forty rows even though fifty instruments feed it, dropping the oldest
to make room as new ticks arrive. Stop the feed and the grid stops taking updates until you start it
again.

Live demo: https://toclocoinc.github.io/lattice-grid-howto-stream-live-updates/

**Read the how-to:** https://www.latticegrid.dev/docs/how-to/stream-live-updates/

## The full source

Two files: `index.html` loads the grid and declares the mount point, `demo.js` configures and creates it. Copy both as they are below and it runs.

### index.html

```html
<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>How to stream live updates into a grid</title>
    <meta
      name="description"
      content="Fifty instruments sit in a grid fed by a simulated price feed read as an async iterator. Each tick patches a handful of rows by their own key, the changed cells flash, and a forty-row window keeps the grid from growing while the feed keeps running. Built with Lattice Grid loaded by script tag, no install and no build."
    />
    <link rel="icon" href="data:," />
    <!--
      The grid's stylesheet, from jsDelivr. The address names the exact
      release, 1.68.2, and carries the hash of the file it expects, so the
      page can never quietly pick up a different build than the one it was
      checked against.
    -->
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@toclocoinc/lattice-grid@1.68.2/lattice-grid.min.css"
      integrity="sha384-mcpd7S8C5nz58bZDAXdYH6rzezEhfN7B4u2SlW426dSe20GnkxTu4TygyOILnCth"
      crossorigin="anonymous"
    />
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; background: #f4f6f9; color: #131a24; }
      header { padding: 1.5rem 1.5rem 0.5rem; max-width: 960px; margin: 0 auto; }
      header p { color: #4a5568; }
      header a { color: #2d6bff; }
      main { max-width: 960px; margin: 0 auto; padding: 0 1.5rem 2.5rem; }
      #toolbar { margin: 0 0 0.75rem; }
      #toggle { font: inherit; padding: 0.4rem 0.75rem; border: 1px solid #ccd3dc; border-radius: 4px; background: #fff; cursor: pointer; }
      #grid { height: 420px; }
      #stat { font-size: 0.9rem; color: #4a5568; margin: 0.75rem 0 0; }
    </style>
  </head>
  <body>
    <header>
      <h1>How to stream live updates into a grid</h1>
      <p>
        A simulated feed hands the grid fifty instruments, then keeps resending four of them a
        tick with a new price. Each resend names an id already on screen, so the grid patches
        that row's cells rather than adding a new one, and the changed cells flash. The source is
        capped to forty rows, so the ones not currently ticking make way for the ones that are.
        Click Stop and no further updates are applied until you press Start again. Read the
        <a href="https://www.latticegrid.dev/docs/how-to/stream-live-updates/">full how-to</a>
        on latticegrid.dev.
      </p>
    </header>
    <main>
      <div id="toolbar">
        <button id="toggle" type="button">Stop the feed</button>
      </div>
      <div id="grid"></div>
      <p id="stat"></p>
    </main>

    <!--
      The library, as a classic script tag. No npm install, no bundler, no
      type="module": the file runs as it arrives and leaves the LatticeGrid
      global behind.
    -->
    <script
      src="https://cdn.jsdelivr.net/npm/@toclocoinc/lattice-grid@1.68.2/lattice-grid.min.js"
      integrity="sha384-vCzLyFYn0T0lz/vkdH4x0JpJZkOazZgI2LiGui7lm5uerdZd0Z46G9hr3Aq1FFPS"
      crossorigin="anonymous"
    ></script>
    <script src="./demo.js"></script>
  </body>
</html>
```

### demo.js

```js
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
```

Two things worth knowing: a row is only ever patched in place when its update names the same key it
arrived under, so a feed that mints a fresh id per tick grows the row count instead of updating a
row, which is exactly what `maxRows` (or `maxAge`, a time window rather than a count) is there to
cap. And sorting stays live while the feed runs: a new row arriving under an active sort is merged
into the existing order rather than triggering a full re-sort of everything on screen.

## Running it yourself

Open `index.html` in a browser, or serve the folder with any static file server. The grid loads
from jsDelivr by script tag, so there is no install and no build step. It runs keyless on
`localhost`; the licence key in `demo.js` is bound to `toclocoinc.github.io` and has no effect
anywhere else.

## Licence

MIT, see [LICENSE](./LICENSE). Lattice Grid itself is licensed separately per domain:
https://www.latticegrid.dev/pricing/
