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

## The snippet

```js
const grid = LatticeGrid.createGrid(document.getElementById('grid'), {
  rowKey: 'id',
  highlightOnChange: { duration: 500 },
  source: {
    mode: 'stream',
    maxRows: 40, // never holds more than this many rows
    open: () => feed(), // an async iterator yielding { rows } chunks
  },
  columns: [
    { field: 'symbol', title: 'Symbol' },
    { field: 'price', title: 'Price', type: 'number', format: { style: 'currency', currency: 'USD' } },
    { field: 'change', title: 'Change', type: 'number' },
  ],
  rows: [],
});
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
