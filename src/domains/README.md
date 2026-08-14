# Domain implementation area

Each substantive AccelSSA build category should implement its domain logic below this directory rather than creating parallel platform infrastructure.

Recommended folders:

```text
src/domains/
  identity/       # Category 2
  projects/       # Category 3
  requirements/   # Category 4
  gis/            # Category 5
  intelligence/   # Category 6
  properties/     # Category 7
  analytics/      # Category 8
  financial/      # Category 9
  diligence/      # Category 10
  evidence/       # Category 11
  operations/     # Category 12
```

Shared request, audit, event, failure-state, persistence, job, configuration, navigation and domain-boundary contracts live in `src/platform/`.
