# AccelSSA

**Site Selection Decision Management Platform**

AccelSSA is a multi-tenant, map-centered SaaS platform for professional site-selection consultants managing corporate expansion, relocation, facility-location, and real-estate evaluation engagements.

AccelSSA is designed as a **site-selection operating system**: one persistent environment for converting client requirements, geographic intelligence, property information, financial analysis, due diligence, consultant judgment, and supporting evidence into a defensible location decision.

> **Core question:** Given this company's requirements, which markets and properties are viable, why, what risks remain, and what should the client do next?

The platform is intended to sit above and between specialized GIS, labor-market, real-estate, mobility, utility, demographic, and economic-development data sources. Those systems provide important inputs; AccelSSA provides the **workflow, decision logic, evidence, collaboration, auditability, and client-delivery layer** that turns those inputs into a professional site-selection engagement.

---

## Product Objective

AccelSSA unifies the complete site-selection lifecycle:

```text
Client Brief
    ↓
Requirements
    ↓
Geographic Screening
    ↓
Market Evaluation
    ↓
Property Screening
    ↓
Shortlist
    ↓
Due Diligence
    ↓
Site Visits
    ↓
Financial / Incentive Comparison
    ↓
Finalists
    ↓
Negotiation
    ↓
Recommendation
    ↓
Client Decision
    ↓
Deliverables
```

The system should preserve the entire decision history rather than only the latest result.

---

## Product Architecture Principle

AccelSSA follows a simple architectural principle:

> **One project model, many analytical views.**

A consultant should not need separate disconnected systems for market screening, properties, GIS, scoring, cost modeling, site visits, PowerPoint, Word reports, spreadsheets, and client collaboration.

Instead, each engagement is built around one authoritative **Site Selection Project**.

```text
                         PROJECT
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    Requirements         Markets         Properties
          │                 │                 │
          └──────────── Analysis Engine ──────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
        Scores            Costs             Risks
          │                 │                 │
          └────────── Recommendation ─────────┘
                            │
                    Deliverables Layer
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
      Client Portal        PDF          Presentation
```

---

## What Makes AccelSSA Different

AccelSSA is not simply:

- a GIS application;
- a property database;
- a demographic dashboard;
- a labor-market tool;
- a scorecard;
- a financial model;
- a CRM;
- an AI chatbot;
- or a report generator.

It combines those capabilities into a persistent **site-selection decision system**.

The central differentiator is the ability to maintain a traceable decision graph:

```text
Client Requirement
        ↓
Metric
        ↓
Source Data
        ↓
Candidate
        ↓
Finding
        ↓
Score
        ↓
Risk
        ↓
Consultant Judgment
        ↓
Recommendation
        ↓
Evidence
```

The objective is for the platform to answer not only **which site scored highest**, but also:

- Why is a location recommended?
- Which mandatory requirements does it satisfy or fail?
- Which assumptions affected the result?
- Which source values drove each score?
- What risks remain unresolved?
- Which facts are verified versus self-reported?
- Where did consultant judgment override automation?
- What changed during the engagement?
- What evidence supports the final recommendation?
- What information did the client rely on when making the decision?

---

## Complete Platform Build Domains

AccelSSA is organized into **12 functional build domains**. These are platform domains, not MVP phases.

### 1. Platform Foundation, Architecture & Administration

Owns the shared application architecture, frontend shell, backend services, persistent storage, background processing, firm administration, configuration, performance foundations, and common platform conventions.

### 2. Identity, Tenancy, Security & Access Control

Owns authentication, multi-tenant isolation, role-based access control, project permissions, object-level visibility, data classification, audit security, external sharing, and cross-tenant isolation.

### 3. Projects, Clients, Workflow & Collaboration

Owns client records, project creation, engagement lifecycle, project dashboards, teams, tasks, comments, collaboration, project templates, and project operating state.

### 4. Requirements, Decision Criteria & Scenario Configuration

Owns the client brief, structured requirements, mandatory/preferred/informational criteria, validation rules, criteria libraries, assumptions, scenarios, decision categories, weights, and requirement versioning.

### 5. GIS, Locations, Geographies & Spatial Analysis

Owns the map experience, geographic hierarchy, candidate geographies, parcels, custom polygons, map layers, distance analysis, drive-time analysis, radius analysis, spatial intersections, and geospatial data storage.

### 6. Market, Workforce, Infrastructure & Location Intelligence

Owns demographic, labor, occupational, education, employer, logistics, transportation, utility, business-climate, and quality-of-life intelligence associated with markets and labor sheds.

### 7. Properties, Sites, Buildings & Development Readiness

Owns the property registry, sites, buildings, parcels, utilities, transportation access, environmental information, development readiness, verification, provenance, freshness, and controlled external property contributions.

### 8. Screening, Scoring, Comparison & Decision Analytics

Owns mandatory qualification, market/property screening, weighted scoring, normalization, scenario analysis, score explainability, overrides, comparisons, executive scorecards, sensitivity analysis, and historical analytical state.

### 9. Costs, Financial Modeling & Incentives

Owns operating-cost models, assumptions, financial horizons, present-value calculations, scenario analysis, incentive programs, incentive valuation, incentive lifecycle, and negotiation tracking.

### 10. Due Diligence, Risk, Candidate Pipeline & Site Visits

Owns candidate progression, elimination history, risk registers, site-readiness scoring, due-diligence checklists, site-visit planning, field/mobile workflows, offline operation, findings, and follow-up actions.

### 11. Evidence, Recommendations, Client Experience & Deliverables

Owns documents, evidence, evidence graph relationships, versioning, recommendation development, client portal, client participation, reports, presentations, data rooms, templates, and exports.

### 12. Data Integration, AI, Automation, Search, Operations & Quality Assurance

Owns external data connectors, canonical metrics, provenance, lineage, freshness, refresh workflows, global search, AI assistance, events, notifications, APIs, caching, observability, resilience, automated testing, integration testing, end-to-end testing, and security testing.

---

## Core User Roles

AccelSSA supports several classes of participants.

### Consulting Firm

**Firm Administrator**
- organization settings;
- users and roles;
- templates;
- integrations;
- scoring libraries;
- report branding;
- system defaults.

**Lead Consultant / Project Manager**
- project leadership;
- requirements;
- scorecards;
- candidate decisions;
- overrides;
- client visibility;
- recommendations;
- deliverables.

**Analyst**
- data entry and imports;
- market research;
- screening;
- scoring support;
- property analysis;
- due diligence;
- comparisons.

**Field Consultant**
- site visits;
- photos;
- notes;
- checklists;
- contacts;
- field findings;
- follow-up issues.

### Client

**Client Executive**
- approved project status;
- shortlist;
- comparisons;
- recommendations;
- reports;
- authorized evidence.

**Client Project Team**
- comments;
- questions;
- document uploads;
- candidate review;
- approved collaboration activities.

### External Contributor

Scoped contributors may include:

- economic development organizations;
- real-estate brokers;
- property owners;
- developers;
- utilities;
- engineering firms;
- state and local economic-development agencies.

External users must only see and modify explicitly authorized information.

---

## Project Model

The central business entity is the **Site Selection Project**.

A project may contain:

```text
Project
├── Client
├── Project Team
├── Requirements
├── Scenarios
├── Candidate Markets
├── Candidate Properties
├── Metrics
├── Scorecards
├── Cost Models
├── Incentive Models
├── Risks
├── Due Diligence
├── Site Visits
├── Documents
├── Evidence
├── Recommendations
├── Client-Visible Content
└── Deliverables
```

Typical lifecycle:

```text
Intake
→ Requirements Definition
→ Geographic Screening
→ Market Evaluation
→ Property Screening
→ Shortlist
→ Due Diligence
→ Site Visits
→ Finalists
→ Negotiation
→ Recommendation
→ Selected
→ Closed / Archived
```

Project lifecycle stages should be configurable rather than permanently hardcoded.

---

## Decision Model

AccelSSA intentionally separates several concepts that are often incorrectly conflated.

### Qualification

Determines whether a candidate satisfies hard requirements.

Typical states:

```text
QUALIFIED
MARGINAL
DISQUALIFIED
INSUFFICIENT_DATA
OVERRIDDEN
```

### Score

Determines relative attractiveness among candidates using weighted criteria and normalized metrics.

### Risk

Represents uncertainty, exposure, dependencies, unresolved issues, or conditions that may affect viability or schedule.

### Site Readiness

Represents the development preparedness of an individual site or building and remains analytically separate from market attractiveness.

### Consultant Judgment

Professional conclusions and overrides remain distinct from automated calculations and must be attributable.

### Client Decision

The client's actual decision remains distinct from the analytical recommendation.

---

## Requirements & Scenario Engine

Requirements should support:

- category;
- metric;
- unit;
- target/minimum/maximum;
- validation operator;
- mandatory/preferred/informational classification;
- weight;
- geography level;
- source;
- confidence;
- notes;
- version.

Supported scenarios may include:

- Balanced;
- Workforce Priority;
- Lowest Cost;
- Logistics Priority;
- Risk-Minimized;
- Executive;
- Consultant;
- Client-defined.

Each scenario may maintain independent criteria, thresholds, weights, normalization methods, scores, and rankings.

---

## GIS & Spatial Analysis

AccelSSA is map-centered and should support geographic analysis across:

```text
Country
State
Region
Metropolitan Area
County
Municipality
ZIP / Postal Code
Census Tract
Custom Polygon
Parcel
Site
Building
```

Spatial capabilities include:

- vector boundaries;
- parcel polygons;
- points and lines;
- custom study areas;
- interactive layers;
- marker clustering;
- thematic mapping;
- buffers;
- drive-time polygons;
- labor sheds;
- distance calculations;
- containment;
- spatial intersection;
- infrastructure overlays;
- environmental/hazard overlays;
- custom consultant/client layers.

---

## Market & Workforce Intelligence

The platform should support analysis of:

- population and demographics;
- employment and unemployment;
- occupational employment;
- wages and wage growth;
- location quotient;
- labor-force participation;
- job postings and hiring demand;
- competing employers;
- commuting patterns;
- labor sheds;
- education and training pipelines;
- colleges and technical programs;
- industry concentration;
- business climate;
- taxes;
- housing;
- quality of life;
- transportation infrastructure;
- utilities;
- logistics assets.

The value is not merely displaying data. Metrics should be connected directly to **project requirements and candidate decisions**.

---

## Properties, Sites & Buildings

Properties are first-class platform entities, not just map markers.

A property may contain:

- site/building identity;
- parcels;
- acreage;
- square footage;
- ownership;
- availability;
- pricing;
- zoning;
- utility capacity;
- transportation access;
- environmental conditions;
- development readiness;
- contacts;
- photos;
- documents;
- verification history;
- provenance;
- data freshness.

Important property attributes should support verification states such as:

```text
UNVERIFIED
SELF_REPORTED
DOCUMENT_VERIFIED
CONSULTANT_VERIFIED
AUTHORITY_VERIFIED
STALE
```

---

## Screening, Scoring & Comparison

The analytical engine should support:

- mandatory qualification;
- weighted scoring;
- hierarchical score categories;
- multiple normalization methods;
- scenario-specific rankings;
- market comparison;
- property comparison;
- sensitivity analysis;
- historical score snapshots;
- consultant overrides;
- explainability.

Every score should be traceable through:

```text
Metric
→ Source Value
→ Transformation
→ Normalization
→ Weight
→ Factor Score
→ Category Score
→ Overall Result
```

---

## Costs & Incentives

Location-specific financial modeling may include:

- labor;
- payroll burden;
- real estate;
- construction;
- electricity;
- natural gas;
- water;
- wastewater;
- telecommunications;
- transportation;
- property tax;
- sales/use tax;
- corporate tax;
- insurance;
- permitting;
- occupancy;
- custom project costs.

The platform should support Year 1, 5-year, 10-year, 20-year, and configurable horizons, including present value, NPV, cumulative cost, cost-per-employee, cost-per-unit, and candidate differentials.

Incentives should be modeled as financial instruments rather than marketing claims, distinguishing:

- nominal value;
- likely realizable value;
- probability-adjusted value;
- present value;
- actual realized value.

---

## Due Diligence, Risk & Site Visits

Candidate workflow may progress through:

```text
Identified
→ Long List
→ Screened
→ Shortlisted
→ Due Diligence
→ Site Visit
→ Finalist
→ Negotiation
→ Selected
```

Alternative states include:

```text
Eliminated
On Hold
Withdrawn
```

The platform should preserve elimination reasons and historical candidate state.

Risk records should support likelihood, severity, owner, mitigation, status, deadline, residual risk, and evidence.

Site-visit capabilities should provide mobile access to:

- itinerary;
- navigation;
- property profiles;
- contacts;
- documents;
- checklists;
- open questions;
- photos;
- notes;
- ratings;
- risks;
- follow-up actions.

Offline/weak-connectivity behavior should be supported where practical.

---

## Evidence & Recommendations

A defining platform capability is evidence-backed decision traceability.

Documents and evidence may support:

- requirements;
- metrics;
- property attributes;
- risk findings;
- cost assumptions;
- incentives;
- due diligence;
- site-visit findings;
- recommendations.

Recommendation development should synthesize:

- mandatory requirement compliance;
- quantitative ranking;
- market intelligence;
- property analysis;
- cost comparison;
- incentive comparison;
- site readiness;
- risk assessment;
- consultant findings;
- client priorities;
- outstanding conditions.

Recommendation lifecycle:

```text
DRAFT
→ INTERNAL_REVIEW
→ CLIENT_REVIEW
→ FINAL
```

---

## Client Experience & Deliverables

The client portal should expose only consultant-approved information.

Potential client modules include:

- project overview;
- status;
- map;
- shortlist;
- comparisons;
- site visits;
- approved documents;
- outstanding questions;
- recommendation;
- deliverables.

Project data should generate reusable outputs such as:

- Market Screening Report;
- Market Comparison;
- Labor Market Analysis;
- Property Profiles;
- Site Comparison Matrix;
- Site Visit Book;
- Operating Cost Analysis;
- Incentive Analysis;
- Risk Report;
- Executive Recommendation;
- Board Presentation;
- Client Data Room.

The consultant should not need to recreate the same analysis independently in spreadsheets, reports, presentations, and portal pages.

---

## Data Integration Architecture

Third-party data should enter through a normalized integration pipeline:

```text
External Provider
      ↓
Connector
      ↓
Raw Response
      ↓
Schema Validation
      ↓
Normalization
      ↓
Canonical Metric
      ↓
Project Analysis
```

Potential integration domains include:

- demographics;
- labor markets;
- real estate;
- parcel data;
- mobility;
- GIS;
- transportation;
- utilities;
- taxes;
- business climate;
- education;
- environmental data;
- climate/hazard data;
- economic development.

Provider schemas should not directly control application logic. AccelSSA should use a provider-neutral **Canonical Metric Registry** so that analytical rules can survive changes in upstream data providers.

---

## Provenance, Freshness & Lineage

Important metric observations should retain:

- source;
- source dataset;
- source record ID where available;
- geography;
- unit;
- observation date;
- retrieval date;
- effective date;
- expiration/freshness state;
- confidence.

Derived results must maintain lineage.

Example:

```text
Overall Candidate Score
        ↓
Workforce Score
        ↓
Machinist Availability Score
        ↓
Employment Observation
        ↓
Provider Dataset
```

New data should not silently rewrite historical decisions. A refresh should identify impacted projects and make recalculation available while preserving the prior analytical state.

---

## AI Site Selection Copilot

AI should assist the consultant without becoming the authoritative source of site-selection facts.

Example capabilities:

- explain candidate rankings;
- compare finalists;
- identify missing information;
- detect contradictory values;
- summarize site visits;
- surface open risks;
- analyze changes over time;
- draft executive summaries;
- draft recommendation narratives.

AI should operate through controlled tools against authorized project data rather than unrestricted access to the complete application store.

Example tool contract:

```text
get_project_requirements()
get_candidate_scores()
get_candidate_metrics()
get_property_details()
get_open_risks()
get_cost_comparison()
get_incentive_analysis()
get_site_visit_notes()
get_evidence()
compare_candidates()
```

AI output should distinguish:

```text
Known Fact
Calculated Result
Consultant Judgment
AI Inference
Missing Information
```

---

## Cross-Domain Shared Contracts

All AccelSSA domains should conform to shared platform contracts.

### Tenant Contract
Every private object belongs to an authoritative tenant.

### Project Contract
Project-specific data resolves to an authoritative project.

### Candidate Contract
Markets and properties participating in an engagement use a consistent candidate model.

### Metric Contract
Measurable data resolves through the canonical metric system.

### Provenance Contract
Important factual values identify their source and vintage.

### Evidence Contract
Material analytical findings can link to supporting evidence.

### Visibility Contract
Internal, project-team, client, and externally shared content remain explicitly distinguishable.

### Audit Contract
Material decisions and changes remain attributable.

### Version Contract
Historical decision states survive later data refreshes.

### Decision Contract
The system distinguishes **qualification**, **score**, **risk**, **consultant judgment**, and **client decision**.

---

## System-of-Record Principles

AccelSSA must distinguish among:

**Source Data** — externally or internally observed factual information.

**Derived Data** — calculations such as scores, ranks, drive times, normalized metrics, and financial outputs.

**Consultant Assertions** — professional findings and judgment.

**Client Decisions** — actual decisions made by the client.

These classes should never be silently conflated.

---

## Security Model

The complete platform is expected to support:

- authenticated access;
- tenant isolation;
- server-side authorization;
- role-based access control;
- project-level permissions;
- object-level visibility;
- encrypted transport;
- encrypted secrets;
- auditable administrative actions;
- secure document access;
- explicit external sharing;
- AI retrieval boundaries.

Cross-tenant and privilege-isolation testing is a core quality requirement, not an optional hardening step.

---

## Quality & Operational Expectations

AccelSSA should include comprehensive:

- unit testing;
- integration testing;
- end-to-end testing;
- GIS testing;
- authorization/security testing;
- external integration testing;
- data normalization validation;
- AI retrieval testing;
- document/export testing;
- monitoring and observability;
- background-job monitoring;
- failure classification;
- resilient third-party-provider handling.

The platform must never silently fabricate values when an upstream source is unavailable. Unavailable or stale data should be explicitly represented as unavailable or stale, with the last successful observation retained where appropriate.

---

## Planned Application Navigation

Top-level navigation:

```text
Projects
Locations
Properties
Analysis
Visits
Deliverables
Contacts
Administration
```

Within a project:

```text
Overview
Requirements
Markets
Properties
Workforce
Infrastructure
Costs
Incentives
Risks
Shortlist
Visits
Recommendation
Files
```

---

## Technology Direction

The platform definition currently supports a modern modular web architecture. Technical choices should remain subordinate to the domain contracts above.

A compatible implementation direction includes:

- **Frontend:** React + TypeScript + Next.js or equivalent;
- **Mapping:** Mapbox GL JS or equivalent vector-capable GIS client;
- **Application services:** TypeScript/Node.js or equivalent;
- **Operational/geospatial data:** relational storage with strong geospatial capabilities such as PostgreSQL/PostGIS, or a deliberate equivalent architecture;
- **Files:** cloud object storage;
- **Background processing:** durable job/queue infrastructure;
- **Caching:** Redis-compatible or equivalent cache where appropriate;
- **Search:** dedicated indexing/search as scale requires;
- **AI:** server-side tool-based orchestration against authorized project data.

No implementation technology should weaken tenant isolation, provenance, evidence traceability, historical decision state, or analytical explainability.

---

## Repository Status

AccelSSA is currently at the **platform definition and build-architecture stage**. The repository is being established around the complete platform model before production implementation is converged.

The platform scope is intentionally defined as the **complete AccelSSA product**, not only a minimum viable subset.

Current foundational product documentation includes the original AccelSSA product concept committed to this repository. Additional architecture, governance, data contracts, requirements, work packets, and implementation documentation should be added as development proceeds.

---

## Development Principle

When implementation begins, individual domains may be developed in parallel, but they must converge on the same authoritative contracts for:

```text
Tenant
Project
Candidate
Metric
Provenance
Evidence
Visibility
Audit
Version
Decision State
```

Parallel development must not create independent, incompatible versions of those concepts.

---

## End State

At full build-out, AccelSSA should provide one persistent professional environment in which:

```text
CLIENT
  ↓
PROJECT
  ↓
REQUIREMENTS
  ↓
GEOGRAPHIC UNIVERSE
  ↓
MARKET SCREENING
  ↓
QUALIFIED MARKETS
  ↓
PROPERTY UNIVERSE
  ↓
SITE / BUILDING EVALUATION
  ↓
DECISION ANALYTICS
  ↓
SHORTLIST
  ↓
DUE DILIGENCE
  ↓
SITE VISITS
  ↓
FINALISTS
  ↓
NEGOTIATION
  ↓
RECOMMENDATION
  ↓
CLIENT DECISION
  ↓
DELIVERABLES
```

Underlying every stage:

```text
DATA
+
PROVENANCE
+
EVIDENCE
+
VERSION HISTORY
+
AUDIT HISTORY
+
CONSULTANT JUDGMENT
+
AI ASSISTANCE
```

**AccelSSA exists to turn complex site-selection data and professional judgment into a structured, explainable, evidence-backed, and defensible location decision.**
