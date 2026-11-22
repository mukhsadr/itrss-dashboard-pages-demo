# ITRSS Research Metrics Dashboard · v9

**Live:** https://mukhsadr.github.io/itrss-dashboard-pages-demo/  
**Source:** https://github.com/mukhsadr/itrss-dashboard-pages-demo

## Live metrics: two ring charts + original Research Canvas

- **Mill users** — privacy-grouped real counts from the original 1,607-user report. Four linked concentric rings. No individual user IDs or advisor names in the public export.
- **Publications** — 247 original public bibliographic records, including 17 flagged duplicates (230 included by default). Three linked concentric rings. Titles, public links and bibliographic fields are available, but internal notes and evidence tracking were excluded.
- **Graph / Research Canvas** — corrected to follow the actual local `research_canvas.py` design, **not a title-similarity graph**.

## Graph models (faithful to the original source)

The default is **Research communities**, connecting researchers by *shared papers* according to OpenAlex author IDs. The original Streamlit app uses **NetworkX weighted greedy-modularity** to detect communities, and `nx.spring_layout(seed=17)` for positions. The public exporter computes the **exact original community assignments** and includes them in `research_graph_public.json`. The browser uses these community colors and a separate interactive SVG force layout; node coordinates may differ from the Streamlit/Plotly rendering.

The second view is **Researchers · Papers · Grants** with author-to-paper edges from OpenAlex author-record IDs and optional grant-metadata candidate edges. Grant metadata **is not verified award funding**. The third optional view shows the already-published grouped Mill category relationships.

The Graph **Edit** controls support researcher focus, title/author/DOI search, publication-year range, single infrastructure category, minimum shared papers, researcher limit, paper limit and grant limit. **Present** focuses on the network. Click nodes to inspect research works, coauthors and connected records. Drag to pan; use wheel or +/- to zoom and Fit to reset.

Differences from the Streamlit source: this static browser port supports a single facility selection (rather than a multi-select), does not run Python/Streamlit live, and uses an SVG force layout rather than Plotly's original NetworkX spring positions. The underlying coauthorship/selection data model follows the supplied source.

### Load your real OpenAlex network now (private browser session)

The **Graph** tab will show a **Load research_graph_public.json** prompt until the reviewed dataset is published. Click it, and select the file that you exported on your computer:

```text
C:\Users\adams\Downloads\research_graph_public.json
```

The imported JSON remains **in the browser tab**, and is not uploaded to GitHub.

Your previous converter wrote 186 works and 858 authorship entries. Since the exporter was updated to compute NetworkX community groups, **rerun it** to create the correct coloring:

```bash
cd ~/Projects/hpc-publication-ai/mill-research-graph/mill_graph_pipeline

curl -fsSL https://raw.githubusercontent.com/mukhsadr/itrss-dashboard-pages-demo/main/tools/export_research_graph_public.py \
  -o export_research_graph_public.py

source .venv-dashboard/bin/activate

python3 export_research_graph_public.py \
  --root ./output \
  --out /mnt/c/Users/adams/Downloads/research_graph_public.json
```

This includes only allowed publication/author fields, not all original pipeline columns. Grants are excluded unless explicitly requested. **The output remains unreviewed until inspected.**

### Automatic load on every laptop

After the JSON is reviewed and its public release is authorized, commit it as:

```text
data/research_graph_public.json
```

The Graph tab already checks that path and will load the file automatically. **That file is not yet in this repository**—the generated output on a local WSL computer does not become accessible to this GitHub-connected chat without an upload.

## Disclosure boundaries

This is a **public GitHub Pages** site. Anyone can download its committed data. The grouped user report and published bibliography are already present; no complete private user data, original internal research graph CSVs, or unpublished award candidate files are uploaded by this v9 update. Public identifiers or author names can still be personal data; evaluate institutional release rules before publishing any further OpenAlex exports.

## Deployment and preview

GitHub Actions deploys `main` automatically. If the browser is showing a cached version, use **Ctrl+Shift+R** or open the URL with `?v=9`.

Local preview from the repository:

```bash
python3 -m http.server 8766
```

Open http://localhost:8766 .
