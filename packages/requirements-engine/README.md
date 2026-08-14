# @accelssa/requirements-engine

Category 4 domain package for **Requirements, Decision Criteria & Scenario Configuration**.

This package defines the authoritative decision-policy model that later AccelSSA analytical domains consume. It deliberately does **not** implement market/property mass screening, score aggregation, ranking, or recommendation selection; those are Category 8/11 responsibilities.

## Domain guarantees

- Mandatory criteria remain qualification policy, not weighted score factors.
- Preferred criteria may carry analytical weights.
- Informational criteria never silently affect qualification or score.
- Missing observations produce `UNKNOWN`, never fabricated zero/false values.
- Assumptions are stored separately from observations.
- Scenarios resolve as overlays over a named requirement version and do not mutate the base model.
- Decision-model compilation validates canonical metric references, units, geography compatibility, scenario references, and decision-category weights.
- Historical requirement versions remain independently addressable.
- Compiled decision-model snapshots include a deterministic fingerprint for reproducible analysis.

## Integration boundary

```text
Category 3 Project
      ↓
RequirementSetVersion + Scenario + Assumptions
      ↓
@accelssa/requirements-engine
      ↓
DecisionModelSnapshot
      ↓
Category 8 Qualification / Scoring / Comparison
```

Category 12 supplies the canonical metric registry and observations. Category 5 supplies authoritative spatial computations for spatial metrics. Category 11 supplies evidence objects referenced by assumptions and later findings.

## Development

```bash
npm install
npm test
```

The tests compile the TypeScript package and then execute Node's built-in test runner.
