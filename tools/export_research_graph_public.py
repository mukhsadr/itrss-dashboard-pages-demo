#!/usr/bin/env python3
"""Prepare a reviewable public OpenAlex network export for ITRSS Research Canvas.

Does not publish or send any data. Only a strict column allowlist is exported.
Do not publish until the institutional data owner approves the contents.
"""
import argparse
import csv
import json
from pathlib import Path
from urllib.parse import urlparse

WORK_FIELDS = ("record_id", "title", "year", "cluster", "doi", "venue", "source_url", "citation_count")
AUTHOR_FIELDS = ("record_id", "author_id", "author_name")

def read_csv(path):
    if not path.is_file():
        raise SystemExit(f"Missing input: {path}")
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))

def clean_url(value):
    value = (value or "").strip()
    parsed = urlparse(value)
    return value if parsed.scheme in ("http", "https") and parsed.netloc else ""

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path,
                        help="Directory containing enriched_works.csv and authors.csv")
    parser.add_argument("--out", required=True, type=Path,
                        help="Reviewable JSON output; nothing is uploaded automatically")
    parser.add_argument("--include-candidate-grants", action="store_true",
                        help="Include unverified grant_ids metadata references (default: exclude)")
    args = parser.parse_args()
    source_works = read_csv(args.root / "enriched_works.csv")
    source_authors = read_csv(args.root / "authors.csv")

    works = []
    ids = set()
    for row in source_works:
        record_id = (row.get("record_id") or "").strip()
        title = (row.get("title") or "").strip()
        if not record_id or not title or record_id in ids:
            continue
        doi = (row.get("doi") or "").strip()
        source_url = clean_url(row.get("source_url"))
        # Include only publications with a public-facing DOI or source URL.
        if not doi and not source_url:
            continue
        item = {key: (row.get(key) or "").strip() for key in WORK_FIELDS}
        item["source_url"] = source_url
        if args.include_candidate_grants:
            item["grant_ids"] = (row.get("grant_ids") or "").strip()
        works.append(item)
        ids.add(record_id)

    authors = []
    seen_pairs = set()
    for row in source_authors:
        record_id = (row.get("record_id") or "").strip()
        author_id = (row.get("author_id") or "").strip()
        name = (row.get("author_name") or "").strip()
        if record_id not in ids or not author_id or not name:
            continue
        pair = (record_id, author_id)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        authors.append({key: (row.get(key) or "").strip() for key in AUTHOR_FIELDS})

    works.sort(key=lambda x: (x["year"], x["title"], x["record_id"]))
    authors.sort(key=lambda x: (x["record_id"], x["author_name"], x["author_id"]))
    payload = {
        "schema": "itrss-public-research-network-v1",
        "source": "Selected bibliographic records and authorship from local OpenAlex enrichment",
        "grant_mentions_are_unverified": True,
        "works": works,
        "authors": authors,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Review file created: {args.out}")
    print(f"Works with public links: {len(works)} | Linked author entries: {len(authors)}")
    print("No upload was performed. Review the JSON and obtain required approval before public release.")

if __name__ == "__main__":
    main()
