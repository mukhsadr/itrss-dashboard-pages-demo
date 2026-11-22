#!/usr/bin/env python3
"""Prepare a reviewable public OpenAlex network export for ITRSS Research Canvas.

Does not publish or send any data. Only a strict column allowlist is exported.
Do not publish until the institutional data owner approves the contents.
"""
import argparse
import csv
import json
import math
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path
import networkx as nx
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

    # Same coauthorship graph and weighted greedy-modularity community method
    # as research_canvas.py; results are exported so the static site can
    # reuse them without running NetworkX in the browser.
    author_to_papers = defaultdict(set)
    paper_to_authors = defaultdict(set)
    for row in authors:
        aid, pid = row["author_id"], row["record_id"]
        author_to_papers[aid].add(pid)
        paper_to_authors[pid].add(aid)
    collabs = Counter()
    for members in paper_to_authors.values():
        for pair in combinations(sorted(members), 2):
            collabs[pair] += 1
    ga = nx.Graph()
    ga.add_nodes_from(author_to_papers)
    for (a, b), weight in collabs.items():
        ga.add_edge(a, b, weight=weight)
    communities = {}
    if ga.number_of_edges():
        for index, group in enumerate(
            nx.algorithms.community.greedy_modularity_communities(ga, weight="weight")
        ):
            for author_id in group:
                communities[author_id] = index

    # Precompute the exact initial author graph layout from research_canvas.py
    # (top 120 researchers, min 1 shared paper, all years/facilities).
    by_work = {w["record_id"]: w for w in works}
    names = {a["author_id"]: a["author_name"] for a in authors}
    valid_papers = {
        pid for pid, w in by_work.items()
        if str(w.get("year", "")).isdigit()
        and w.get("cluster") in {"Foundry", "Mill", "Foundry + Mill"}
    }
    paper_counts = Counter(
        aid for pid in valid_papers for aid in paper_to_authors.get(pid, set())
    )
    top_authors = sorted(
        paper_counts,
        key=lambda aid: (-paper_counts[aid], names.get(aid, "")),
    )[:120]
    keep = set(top_authors)
    selected_papers = {
        pid for pid in valid_papers if paper_to_authors.get(pid, set()) & keep
    }
    pairs = Counter()
    for pid in selected_papers:
        for pair in combinations(sorted(paper_to_authors[pid] & keep), 2):
            pairs[pair] += 1
    initial_graph = nx.Graph()
    initial_graph.add_nodes_from("a:" + aid for aid in keep)
    for (a, b), weight in pairs.items():
        initial_graph.add_edge(
            "a:" + a, "a:" + b, weight=min(5, math.sqrt(weight))
        )
    initial_layout = {}
    if initial_graph.number_of_nodes():
        positions = nx.spring_layout(
            initial_graph,
            seed=17,
            iterations=80,
            weight="weight",
            k=1.6 / math.sqrt(max(2, initial_graph.number_of_nodes())),
        )
        initial_layout = {
            node: [round(float(v[0]), 7), round(float(v[1]), 7)]
            for node, v in positions.items()
        }

    works.sort(key=lambda x: (x["year"], x["title"], x["record_id"]))
    authors.sort(key=lambda x: (x["record_id"], x["author_name"], x["author_id"]))
    payload = {
        "schema": "itrss-public-research-network-v1",
        "source": "Selected bibliographic records and authorship from local OpenAlex enrichment",
        "grant_mentions_are_unverified": True,
        "works": works,
        "authors": authors,
        "communities": communities,
        "community_algorithm": "networkx.greedy_modularity_communities (weighted)",
        "default_author_layout": initial_layout,
        "layout_algorithm": "networkx.spring_layout(seed=17, iterations=80)",
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Review file created: {args.out}")
    print(f"Works with public links: {len(works)} | Linked author entries: {len(authors)}")
    print(f"Detected research communities: {len(set(communities.values()))} | Coauthor links: {len(collabs)}")
    print(f"Precomputed original-layout researcher positions: {len(initial_layout)}")
    print("No upload was performed. Review the JSON and obtain required approval before public release.")

if __name__ == "__main__":
    main()
