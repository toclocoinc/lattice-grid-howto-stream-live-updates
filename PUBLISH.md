# Publish step (batch mode)

This repo was built and verified locally under the owner's 2026-09-22 batch-mode
instruction (GitHub Actions minutes low). It has not been pushed. When the
how-to series is published in one batch, create and push it with:

```
gh repo create toclocoinc/lattice-grid-howto-stream-live-updates \
  --public \
  --description "How to stream live updates into a grid with Lattice Grid" \
  --homepage https://toclocoinc.github.io/lattice-grid-howto-stream-live-updates/
```

Then push this local repo's `main` to it, and enable Pages from the `main`
branch root (the checked-in `.github/workflows/pages.yml` publishes on every
push to `main`, so pushing is the only remaining step).

- **Description:** How to stream live updates into a grid with Lattice Grid
- **Homepage:** https://toclocoinc.github.io/lattice-grid-howto-stream-live-updates/
- **Topics:** `lattice-grid`, `data-grid`, `javascript`, `how-to`

Site page this repo's README links back to (also not yet pushed, committed
locally on branch `howto/stream-live-updates` of the site repo):
https://www.latticegrid.dev/docs/how-to/stream-live-updates/
