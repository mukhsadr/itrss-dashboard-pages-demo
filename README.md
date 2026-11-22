# ITRSS Research Metrics Dashboard · v5

**Live site:** https://mukhsadr.github.io/itrss-dashboard-pages-demo/  
**Source:** https://github.com/mukhsadr/itrss-dashboard-pages-demo

## Three views, two modes

The dashboard opens in **Present** mode, optimized for a centered visualization with minimal surrounding text. Select **Edit** to show filters, data import controls, chart labels and additional details. Switch between:

1. **Mill users:** Four interactive linked rings with real source totals from the 1,607-user report. Clicking a slice filters and updates the remaining rings; clicking the same slice again clears the filter.
2. **Publications:** Three interactive linked rings for year, cluster and publication type. **The original publication JSON is not yet included in this repository.** The panel clearly shows pending data rather than inventing values. To use the original chart now, choose **Publications → Open publications.json** (or drag your JSON file onto the panel), and select `~/Projects/itrss-metrics-dashboard/data/publications.json` from your computer. The file stays in this browser tab and is not uploaded to GitHub or a server. **Choose another JSON** in Edit mode replaces the data without resetting the website. Present/Edit and tab switching preserve your selected file until the page is reloaded.
3. **Graph:** Automatically displays a relationship graph created from the published, privacy-grouped Mill user metrics (department → classification → status). In Edit mode, change **Graph source** to **Research coauthor network** and choose **Open research CSV files**. Select both `enriched_works.csv` and `authors.csv` from your local `mill_graph_pipeline/output/` folder. The site constructs author connections from actual shared publications in-browser. There is no server-side Streamlit runtime on GitHub Pages. The original Python Streamlit source remains local.

## Data sources and disclosure limits

The public `data/callie.csv` contains **48 grouped records with a Count column that totals 1,607 original report records**. It excludes user IDs and named advisors, groups small cells and broadens some classification/department labels. It is **not** the same as publishing the 1,607-row local dataset. Category counts are weighted by Count. An aggregate dataset can still carry reidentification risk; public release should be reviewed by the institutional data owner.

The `data/publications.json` file is currently an intentionally empty schema placeholder. It does **not** mean zero publications. The original workbook and its author/title/DOI metadata have not been provided for this update. Neither the original publication record rows nor the research network datasets were invented or copied from the uploaded Python script.

The research graph methodology is adapted from the supplied `research_canvas.py`: authorship edges are based on shared publication identifiers in `authors.csv` and `enriched_works.csv`. The optional browser coauthor view does **not** claim grant funding; award references in research metadata are unverified candidates.

## Run a local preview

```bash
python3 -m http.server 8766
```

Deploys automatically via `.github/workflows/deploy-pages.yml` on every push to `main`.

If the previous version is cached in your browser, refresh with **Ctrl+Shift+R** or add `?v=5` to the site address.

## Publication import smoke test

The v5 publication import was checked with a non-user example containing four records and one flagged duplicate: default base count was 3, all three ring SVGs rendered, and clicking a ring segment reduced the displayed records from 3 to 2. This verifies the client-side loading/filter logic, not the user's unpublished workbook.
