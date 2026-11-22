# ITRSS Research Metrics Dashboard · v4

**Dashboard:** https://mukhsadr.github.io/itrss-dashboard-pages-demo/

## Default live dataset: real grouped Mill report (not synthetic)

The public site automatically loads `data/callie.csv`, derived from the user's 1,607-row local report. This is a *privacy-grouped aggregate*, not a row-level export.

- **Original total:** 1,607 records
- **Published groups:** 48, with a `Count` weight; real counts from source, not invented records
- **Disclosure controls:** removed all `User` IDs and advisor names; advisor reduced to recorded/not recorded; academic classifications grouped by type; departments with fewer than 30 records combined into Other departments; every remaining 4-field combination with fewer than five records merged into a single Other grouped categories cohort (194 records)
- **Display:** 4 linked concentric rings, weighted totals, click-to-filter, hover highlight, center metric, and a simple full-screen presentation default.

The source was already pseudonymized in the `User` field, but it retained advisor identities and small unique groups. This public export intentionally does **not** reproduce every original fine-grained category. These transformations reduce disclosure risk but are **not a guarantee of anonymity or an institutional publication approval**. Review with the institutional data owner before broader dissemination.

## Publications

The original `data/publications.json` export has **not yet been supplied** in this conversation. There are no fabricated publication records on the public site. Select **Publications → Open local JSON** to explore the real file in your browser session without posting it to GitHub. The empty public JSON is a placeholder, not a zero-publications finding.

## Presentation UI

Page opens in centered chart-only presentation mode. Use the toolbar to toggle between the Mill user and publication charts, show or hide details, clear filters, enter fullscreen, or load a local source file.

The local private dataset is at `~/Projects/itrss-metrics-dashboard/data/callie.csv`, and the publication export at `~/Projects/itrss-metrics-dashboard/data/publications.json`. These are **not** the public grouped export.

## Local serving

```bash
python3 -m http.server 8766
```

Then browse to http://localhost:8766 .

This static site deploys through `.github/workflows/deploy-pages.yml` on GitHub Actions. The separate local Streamlit canvas is not included on public GitHub Pages.
