# ITRSS Research Metrics Dashboard · v23

**Live:** https://mukhsadr.github.io/itrss-dashboard-pages-demo/  
**Source:** https://github.com/mukhsadr/itrss-dashboard-pages-demo

## Default Mill data (November 2026)

The live **Mill users** tab loads **`data/PUBLIC_DATA.csv`** by default. It has 1,607 user-list records with the columns `User`, `Descr`, `Classficiation`, `Status`, `Advisor`. This is a **population / directory-like source, not evidence of Slurm compute usage**.

The **Mill users** chart uses all original `Descr` department and `Classficiation` academic-program labels without suppression or minimum-count thresholds. The current file has **72 distinct departments, 82 academic programs, and 280 counted department/program/status/advisor-status combinations**, preserving **all 1,607 source records**, including 1-record categories. All four donut rings start at 12 o'clock and sort **clockwise largest-to-smallest by count**, with alphabetical tie-breaking. The collapsible results table shows all 280 combinations, also largest-first by default, and follows ring filters. The original `User` tokens and named `Advisor` values do not appear in the chart or results table; advisor information is limited to recorded versus not recorded. The default data fetch is `PUBLIC_DATA.csv` without silently reverting to `callie.csv`.

**Privacy notice:** `PUBLIC_DATA.csv` itself remains available as a raw file in this public GitHub repository and contains row-level user identifiers and advisor labels. The browser transformation protects visualized categories but **does not make the original hosted CSV private**. Review whether the raw file is approved for public release; removing it from the default chart does not remove it from Git history. Avoid claiming these counts reflect actual active HPC usage without Slurm evidence.

## Live metrics: two ring charts + original Research Canvas

- **Mill users** — all original category values preserved across four counted rings, plus 280 expandable results-table combinations. No individual user IDs or advisor names are displayed in the interface.
- **Publications** — 247 original public bibliographic records, including 17 flagged duplicates (230 included by default). **Four linked rings:** Cluster, year, type, and a new outer author-priority ring. Titles, public links and bibliographic fields are available, but internal notes and evidence tracking were excluded.
- **Graph / Research Canvas** — corrected to follow the actual local `research_canvas.py` design, **not a title-similarity graph**.

## Publications: fourth author ring → MRI Circular Atlas switch

The original **four-ring Publications chart** remains intact: Cluster, Year, Type, and an outer Author-priority ring. The outer ring orders credited names clockwise, **highest publication count at 12 o'clock**; it shows 16 names plus an "Other authors" group.

**Click an author:** all three center category rings are removed and replaced by the source-linked **MRI Circular Atlas** embedded inside the same publication SVG. The focused center retains the author's name and credited-publication count. The new graph contains:

- colored arcs for the original Atlas's **12 provisional title-derived research themes**, paper dots grouped inside those arcs, and **smooth curved links** that bundle across the circle;
- source-linked candidate edges from the exact uploaded **MRI_Circular_Research_Explorer.html**: **230 matched nonduplicate papers, 637 links total**, of which **503 have shared distinctive title terms** and **183 have same-journal matches** (one link may have both);
- options for **Shared scientific terms**, **Title terms + journals**, or **Same journal**, plus a cap on displayed link count;
- hover a paper to highlight candidate edges; click a paper to inspect its title, year, theme and source URL, and navigate its connected works; click a theme arc to focus related papers;
- a two-mode switch: **Research connections** and **Verified coauthors**. Research connections always works using the public bibliography/Atlas. The coauthor mode remains disabled until **OpenAlex-author-ID coauthorship** is available for that author.
- when OpenAlex data is present, the coauthor mode uses **author IDs and shared publication IDs**, placing collaborators around the outer circle and linked papers inside, with curved author→paper connections. Clicking a collaborator switches the focused researcher instead of returning to a static donut.
- **← All publication rings** restores the original four rings and clears the bundled focus view.

**Source provenance and limitations:** `data/publication_atlas_public.json` is a sanitized copy of the submitted MRI Circular Atlas's public bibliography and relation types, and does **not** contain its 17 evidence-review notes, internal award claims or original extra spreadsheet fields. Its candidate connections are **not citations, verified collaborations, verified disciplines, or proof of using an HPC cluster**. This Atlas ZIP had **zero works with OpenAlex author IDs**; thus the title/journal graph cannot establish true coauthorship.

The original `data/publications.json` remains 247 rows / 230 default included. The fourth-ring author names come from this bibliography, where **153 records use "et al." and 26 omit authors**. Coauthor data can be connected from the separately imported and reviewed 186-work/858-authorship OpenAlex export through the Graph tab (browser-only), or from a reviewed `data/research_graph_public.json` when separately approved for public GitHub deployment.

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

GitHub Actions deploys `main` automatically. If the browser is showing a cached version, use **Ctrl+Shift+R** or open the URL with `?v=10`.

Local preview from the repository:

```bash
python3 -m http.server 8766
```

Open http://localhost:8766 .
