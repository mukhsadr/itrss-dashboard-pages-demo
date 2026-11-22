# ITRSS Research Metrics Dashboard · Presentation v4

**Website:** https://mukhsadr.github.io/itrss-dashboard-pages-demo/  
**GitHub:** https://github.com/mukhsadr/itrss-dashboard-pages-demo

## What it does

The public site contains the original plain-JavaScript, linked-filter concentric-ring visualizations:

- **Mill users:** four rings for department, classification, status, and advisor.
- **Publications:** three rings for cluster, year, and publication type.
- **Click a ring segment** to filter the dataset and redraw the *other* rings. Click the same slice again to clear that filter. Multiple rings can be filtered together.
- **Presentation mode (v4):** select **Present** to show a clean, enlarged, centered ring chart. Switch between Mill users and Publications, choose **Show labels & controls**, reset filters, or enter fullscreen. **Exit presentation** returns to the original detailed dashboard.

## Open the original de-identified data in your browser

The website starts with **fictional demo records**. To see the original counts *without publishing individual records*, open the website, choose **Present → Mill users → Open local CSV**, and select the exported CSV from your own computer.

For the publication rings choose **Present → Publications → Open local JSON**, and select your `publications.json` export.

These files are parsed entirely in the browser using the File API. **The file contents are not sent to GitHub, uploaded to an API, or committed to this repository.** They are held only in the current page session. Reloading the page returns to the synthetic demo. With a file selected, all ring filters work against that actual file's rows, including linked updates across rings.

The current local WSL sources are:

```text
~/Projects/itrss-metrics-dashboard/data/callie.csv
~/Projects/itrss-metrics-dashboard/data/publications.json
```

Copy them to your Windows Downloads directory if needed:

```bash
cp ~/Projects/itrss-metrics-dashboard/data/{callie.csv,publications.json} /mnt/c/Users/adams/Downloads/
```

**Important:** Replacing `User` IDs does not ensure privacy when other attributes (such as advisors, statuses, department descriptions, small combinations, publication titles or authors) could identify people. Do not commit the original files to this publicly accessible repository without an institutional disclosure review. For an always-on dashboard with full internal data accessible to teammates, deploy behind approved campus authentication rather than using public GitHub Pages.

## Development

This is a static HTML/CSS/JS site without a build step.

```bash
python3 -m http.server 8766
```

Then visit http://localhost:8766 .

GitHub Actions workflow `.github/workflows/deploy-pages.yml` deploys from `main`. In **Settings → Pages**, use **GitHub Actions** as the publishing source.

The local Streamlit research collaboration canvas is a separate Python service and is not hosted on GitHub Pages.
