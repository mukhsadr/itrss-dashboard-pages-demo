# V3 linked filtering — data contract (not yet enabled)

The live dashboard currently uses **independent public aggregate marginals** from `../v2/data/user_aggregates.json`. They cannot establish how Department, Classification, Status, and Advisor availability intersect.

V3 can optionally load `v3/data/linked_user_counts.json` if approved data are added later. No such file is included in this change.

## Required schema

```json
{
  "source_total": 1607,
  "min_cell_count": 10,
  "conditionals": {
    "Descr": {
      "Example Department": {
        "Classficiation": [
          {"name": "Example class", "count": 20},
          {"name": "Other / small groups", "count": 15}
        ],
        "Status": [
          {"name": "Active", "count": 25},
          {"name": "Other / small groups", "count": 10}
        ],
        "Advisor": [
          {"name": "Advisor recorded", "count": 20},
          {"name": "Not specified", "count": 15}
        ]
      }
    }
  }
}
```

The example above is illustrative and **must not be published as real data**.

## Requirements for a real release

- Source group totals and all three conditional distributions must reconcile; the page refuses partial/inconsistent groups.
- The same schema should cover all four dimensions if full one-slice selection is desired.
- Suppress or combine disclosive small cells, including complementary cells and rare combinations. Minimum cell size 10 is only a preliminary check, **not a sufficient privacy guarantee**.
- Do not publish names, IDs, raw rows, advisor identities, or unreviewed row-level combinations.
- Get institutional data-owner/security approval before any linked aggregate JSON is committed.
- Public selection supports only **one category at a time**. Multi-step drilldowns require a separate privacy review.
- Publications remain independent aggregates until reviewed publication-level relationships are available.

The application deliberately keeps the other rings at overall totals when this file is absent.
