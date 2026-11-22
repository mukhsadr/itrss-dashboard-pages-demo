# ITRSS Research Metrics Dashboard · v8

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

### Research Canvas · third interactive metric

The Graph tab now opens as a **Research Rabbit-style related-paper constellation** built automatically from the published `data/publications.json`. No Streamlit server is required on GitHub Pages.

**Four graph views:**

1. **Related papers (default)** — paper-to-paper links based on shared title terms or a matching explicitly listed author. These are bibliographic similarities, **not citations, co-citations or verified relationships**.
2. **Researchers · Papers · Grants** — public listed-author-to-paper links by default. Once complete OpenAlex data is supplied, the view uses researcher IDs and can optionally show **unverified candidate grant mentions**.
3. **Research communities** — coauthorship from `enriched_works.csv` and `authors.csv`, after import. The original Python Streamlit canvas uses NetworkX greedy modularity; this browser adaptation uses deterministic label propagation, so community assignments can differ.
4. **Mill category relationships** — existing privacy-grouped real Mill counts.

**Interaction:** filters for year, facility, title/author/DOI, node count, relatedness strength and minimum shared papers; click a node to inspect connected publications; drag to pan, wheel/+/- to zoom, and Fit to reset. The **Present** mode emphasizes the centered graph and **Edit** reveals controls and the inspector.

The source archive `itrss_research_canvas.zip` contains `research_canvas.py` and its requirements, **not** the actual OpenAlex exports. The deployed public bibliography supports the first two views today; the full original coauthor and grant metadata is not yet on the website.

#### Publishing a reviewed OpenAlex graph for automatic loading

A strict allowlist converter is available at `tools/export_research_graph_public.py`. On your WSL machine:

```bash
cd ~/Projects/hpc-publication-ai/mill-research-graph/mill_graph_pipeline

python3 /path/to/itrss-dashboard-pages-demo/tools/export_research_graph_public.py \
  --root ./output \
  --out /mnt/c/Users/adams/Downloads/research_graph_public.json
```

It reads the original `output/enriched_works.csv` and `output/authors.csv`, retaining public-facing identifiers, titles, year, facility, DOI/source URL and author names/IDs. Rows without a DOI or source URL are excluded. Use `--include-candidate-grants` **only after reviewing those unverified references**.

**The script does not publish anything.** Review the output and obtain any necessary institutional authorization. Once an approved `research_graph_public.json` is committed to `data/research_graph_public.json`, the website will load the richer OpenAlex network automatically from any laptop. Otherwise, it can be imported in the browser from local CSVs.


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

Open http://localhost:8766 . If an older version is cached, use **Ctrl+Shift+R** and the live site `?v=8` URL.

## Data release boundary

This repository is **public**: everything committed here, including `data/publications.json` and `data/callie.csv`, can be downloaded by anyone. The original full institutional user report, internal publication evidence notes, and the Python research graph exports have **not** been committed here. Do not publish restricted or nonpublic institutional files without appropriate authorization.
