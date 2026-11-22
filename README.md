# ITRSS Research Metrics Dashboard — Public Demo

Interactive research metrics visualizations designed for GitHub Pages.

**Dashboard:** https://mukhsadr.github.io/itrss-dashboard-pages-demo/  
**Repository:** https://github.com/mukhsadr/itrss-dashboard-pages-demo

## What is included

- Four-ring interactive user population explorer: click a category to filter the full chart, click again to clear it
- Three-ring publication explorer with publication record filtering
- HTML, CSS and JavaScript running entirely in the browser
- Synthetic demonstration datasets at `data/callie.csv` and `data/publications.json`

## Privacy

**Public demonstration with synthetic data only.** The real institutional datasets, backup files, internal scripts, and local Python/Streamlit research canvas are intentionally excluded. Do not commit real university or researcher records to this public repository without prior approval and disclosure review.

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) deploys the root of the `main` branch to GitHub Pages on every push. In **Settings → Pages**, select **GitHub Actions** as the build/deployment source if it is not already selected. Then check **Actions** for the deployment status.

## Local preview

```bash
python3 -m http.server 8766
```

Open http://localhost:8766 .

The separate research collaboration canvas needs a Python backend and is not hosted on GitHub Pages.
