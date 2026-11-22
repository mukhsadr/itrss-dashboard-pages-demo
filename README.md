# ITRSS Research Metrics Dashboard · v6

**Live website:** https://mukhsadr.github.io/itrss-dashboard-pages-demo/  
**Public repository:** https://github.com/mukhsadr/itrss-dashboard-pages-demo

## Published metrics (automatically loaded on any device)

### Mill users

- Real source report total: **1,607 Mill user records**, represented by **48 grouped cohorts** with a `Count` weight
- Four interlinked SVG rings (department, classification, status, advisor-recorded category)
- No direct user IDs or individual advisor names in the public dataset; smaller groups combined for privacy
- These transformations reduce exposure but are not a guarantee of anonymity. Institutional data-release approval remains important.

### Publications

- **247 source entries** from `Foundry_Mill_acknowledgments.xlsx` via the locally supplied `publications.json`
- **17 entries explicitly flagged as duplicates**, excluded by default → **230 included entries**
- Three interlinked rings: cluster acknowledged, publication year, and publication type
- Public GitHub dataset: `data/publications.json` (automatically fetched by the website)
- Published fields: Year, Cluster acknowledged, Type, Title, Authors, Venue, DOI, DOI / record link, Counted as duplicate
- Intentionally omitted from the public dataset: internal `#`, `Date`, `MS&T author (OpenAlex)`, `Evidence sources`, and `Note` fields
- All 247 published record links point to public DOI, Scholars' Mine, or NASA ADS pages. Metadata is taken from the supplied source; it is not independently audited against every publisher.
- An acknowledgment is not proof of direct cluster usage, and a duplicate flag reflects the supplied workbook's annotation.

### Relationship graph

- Interactive graph from the published grouped Mill cohort data
- Optional original OpenAlex coauthor network: open `enriched_works.csv` and `authors.csv` locally in the browser
- No grant funding relationship is inferred from metadata

## Presentation and editing

- **Present:** clean, centered rings or graph, click-to-filter, fullscreen
- **Edit:** change ring attributes, sorting, inspect publication entries, show legends, import local files
- Switching tabs or modes preserves the currently loaded data and active filters until refresh
- Selecting `Open local CSV / JSON` temporarily replaces the public dataset **only inside your browser session**; it does not publish those files

## Deployment

Static website (HTML/CSS/JS), deployed to GitHub Pages via `.github/workflows/deploy-pages.yml` on changes to `main`.

Local preview:

```bash
python3 -m http.server 8766
```

Open http://localhost:8766 . If an older version is cached, use **Ctrl+Shift+R** and the live site `?v=6` URL.

## Data release boundary

This repository is **public**: everything committed here, including `data/publications.json` and `data/callie.csv`, can be downloaded by anyone. The original full institutional user report, internal publication evidence notes, and the Python research graph exports have **not** been committed here. Do not publish restricted or nonpublic institutional files without appropriate authorization.
