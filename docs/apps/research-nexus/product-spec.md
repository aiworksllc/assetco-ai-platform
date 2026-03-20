# ResearchNexus — Product Specification

**Application:** ResearchNexus
**Domain:** Investment Research & ESG Scoring
**Document:** product-spec.md
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** Dr. Priya Sharma (Head of Quantitative Research)
**EU AI Act Classification:** SIGNIFICANT — research augmentation; outputs feed investment decisions downstream
**Audience:** Head of Research, CIO, CCO, Model Risk, Compliance Technology
**Deployment Phase:** Phase 4 (last deployment; strictest information barrier requirements in the platform)

---

## 1. Business Context

Dr. Priya Sharma leads a 12-person quantitative research team responsible for generating investment views, ESG assessments, and fair value estimates across AssetCo's $85B AUM. The team operates at the intersection of fundamental analysis, quantitative modelling, and regulatory disclosure — producing work that directly informs AlphaEngine's portfolio construction, satisfies SFDR sustainability disclosure obligations, and feeds the fair value hierarchy required under ASC 820 and IFRS 13 for AssetCo's Level 2 and Level 3 holdings.

The scale of modern investment research has outpaced what a 12-person team can process manually. Each quarter, the team faces:

- **500+ earnings calls** requiring transcript analysis, management tone assessment, and guidance revision tracking
- **10,000+ SEC filings per year** (8-K material event disclosures, 10-K annual reports, 10-Q quarterly updates, proxy statements, S-1 registration filings for IPO coverage)
- **Satellite imagery and alternative data** — parking lot traffic, shipping container counts, credit card transaction flows, web scraping signals — all requiring normalisation and integration with fundamental views
- **ESG data** from MSCI ESG Research, Sustainalytics, and CDP across thousands of securities, mapped to SFDR Principal Adverse Impact (PAI) indicators and EU Taxonomy environmental objectives
- **Sentiment signals** from news feeds, sell-side analyst consensus revision tracking, and social media platforms

Manual processing of this data volume is the primary bottleneck in AssetCo's research production. High-conviction ideas are delayed because analysts are buried in data normalisation. ESG disclosures are produced under time pressure with inconsistent methodology. Fair value estimates for illiquid securities in the private credit and structured products book lack the systematic comparables analysis that the ASC 820 framework demands.

---

## 2. Problem Statement

| Problem | Business Impact | Regulatory / Compliance Impact |
|---|---|---|
| Analysts spend 60–70% of time on data aggregation, not analysis | 3–5x research productivity gap vs. quant-augmented peers; ideas missed or delayed | Indirect: competitive disadvantage leading to alpha erosion |
| ESG scoring methodology inconsistent across analysts | Fund-level PAI disclosure quality varies; greenwashing risk if SFDR-classified funds cannot substantiate sustainability claims | SFDR Art.4 (PAI disclosure), Art.6/8/9 fund classification; EU Taxonomy Art.3 misclassification liability |
| Fair value estimates for illiquid securities lack documented comparables methodology | Model risk; NAV overstatement or understatement for Level 2/3 assets | ASC 820 / IFRS 13 Level 3 fair value hierarchy requires documented inputs and valuation techniques |
| Sentiment signals from alternative data not systematically integrated | Alpha signals in news and social media identified inconsistently; edge eroded by more systematic competitors | Reg FD risk if sentiment analysis inadvertently incorporates MNPI sourced through informal channels |
| Research outputs are ad-hoc documents; no formal publication gate | Risk that pre-publication research views reach trading desk before formal publication, creating front-running exposure | Reg FD (selective disclosure), MAR Art.10 (tipping), chinese wall breach liability |
| Research team cannot access ESG data providers programmatically without bespoke API integrations per analyst | Data latency; inconsistent SFDR PAI computations across fund share classes | SFDR Art.4 disclosure requires consistent, documented PAI methodology across all funds |

---

## 3. Solution: ResearchNexus

ResearchNexus is a 4-agent AI research augmentation system that operates within the Sentinel-Ops Safe Operating Envelope with the strictest information barrier configuration in the AssetCo AI Platform. It automates the data-intensive stages of investment research — transcript analysis, SEC filing review, ESG scoring, sentiment signal generation, and illiquid securities valuation — while enforcing a technical chinese wall that prevents any research agent from accessing trading positions, pending orders, or execution data.

**The publication gate is the central architectural feature.** All research outputs are written to pre-publication directories classified RESTRICTED. They remain inaccessible to AlphaEngine, TradeSentinel, or any other application until a human research manager formally advances a research item through the publication workflow. Only published research — research that has completed internal review, IC presentation, and formal publication — is readable by downstream applications. The SOE enforces this gate deterministically; it is not a process guideline.

ResearchNexus does not make investment decisions. It augments Dr. Sharma's team by handling computational and data-intensive tasks, surfacing structured findings for human analyst review, and generating the documentation trail that regulatory frameworks require.

---

## 4. The Research Publication Gate

The publication gate is a mandatory workflow gate between research generation and downstream consumption. It exists to satisfy two independent requirements:

1. **Reg FD compliance:** Prevents selective disclosure of material research to any party (including internal trading desks) before the research is formally published.
2. **Information barrier integrity:** Ensures that trading agents in TradeSentinel and AlphaEngine cannot act on research views that have not been formally validated and published.

```
Research Generation          Internal Review          IC Presentation          Publication          Downstream Access
─────────────────────        ──────────────           ────────────────         ───────────          ─────────────────
Agents write outputs    →    Research Manager    →    Investment Committee →   CCO sign-off    →    AlphaEngine reads
to pre-publication           reviews for              reviews material         (Reg FD gate)        published signals
directories                  accuracy and MNPI        investment views
(RESTRICTED)                 screening                                         research/
                                                                               published/**
research/pre-publication/**                                                    (readable by
(denied to all                                                                 AlphaEngine,
downstream apps)                                                               ComplianceShield)
```

Pre-publication paths are denied to AlphaEngine, TradeSentinel, RiskCompass, AdvisorLens, and OpsFabric at the SOE level — not by access control convention, but by deterministic deny rules in each application's SOE definition. A model hallucination, prompt injection, or software error in a downstream agent cannot access pre-publication research because the Sentinel-Ops gate blocks the tool call before it executes.

---

## 5. User Stories

### Dr. Priya Sharma — Head of Quantitative Research

> "My team processes 500 earnings calls a quarter. I need structured summaries — management tone, guidance revision, key risks called out, comparison to prior quarter guidance — within hours of each call, not days. Right now that takes a junior analyst a full day per company."

> "Our SFDR Article 8 funds require PAI disclosures. I have two analysts spending 30% of their time pulling PAI data from MSCI ESG and Sustainalytics, normalising it, and mapping it to fund holdings. This should be automated and reproducible — the methodology should be the same every quarter, not depend on which analyst runs the exercise."

> "I have $2B in private credit and structured product exposures that require fair value estimates under ASC 820. The Level 3 inputs — comparable transaction multiples, credit spread analysis, recovery rate assumptions — take weeks to compile manually. I need a system that maintains the comparables database and generates the initial valuation model, which my team then validates."

### David Okonkwo — CCO

> "The chinese wall between research and trading is the most important information barrier in the firm. I need a technical guarantee — not a process guideline — that ResearchNexus agents cannot read trading positions or pending orders. If a research AI knows we are about to sell a large block, it could surface that signal in its output and an analyst downstream could trade ahead. The SOE must enforce this at the infrastructure level."

> "Every research output that eventually reaches AlphaEngine or AdvisorLens must pass through a formal publication gate with CCO sign-off. I need the audit trail to show me, per research item: who generated it, when it was in pre-publication, who reviewed it, when it was published, and who accessed it post-publication."

### Thomas Reeves — CIO, Equities

> "I want the research team's AI to produce the same structured output format every time — key findings, risk factors, valuation drivers, sentiment summary — so my PMs can consume research signals programmatically through AlphaEngine rather than reading PDFs."

---

## 6. Functional Requirements

### 6.1 Earnings & Filing Analysis (market-analyst)

| ID | Requirement |
|---|---|
| FR-01 | Ingest earnings call transcripts within 2 hours of publication; generate structured summaries covering: management tone (positive/neutral/cautious), guidance revision (raised/maintained/lowered with magnitude), key themes, analyst Q&A sentiment |
| FR-02 | Process SEC filings: 8-K material event disclosures, 10-K annual reports (MD&A, risk factors, financial statements), 10-Q quarterly updates, proxy statements (executive compensation, board changes) |
| FR-03 | Identify material developments: management changes, guidance revisions >5%, regulatory actions, litigation disclosures, customer concentration changes, supply chain disclosures |
| FR-04 | Structure all outputs in machine-readable JSON format with human-readable summary; output to `research/pre-publication/analysis/**` |
| FR-05 | All pre-publication outputs classified RESTRICTED; inaccessible to downstream applications until publication workflow completion |

### 6.2 ESG Scoring (esg-scorer)

| ID | Requirement |
|---|---|
| FR-06 | Compute ESG scores per SFDR Principal Adverse Impact (PAI) indicators: GHG emissions (Scopes 1, 2, 3), carbon footprint, biodiversity impact, water usage, hazardous waste, social violations (UN Global Compact, OECD Guidelines), board diversity |
| FR-07 | Integrate data from MSCI ESG Research, Sustainalytics, and CDP via API; reconcile discrepancies between providers; flag data gaps |
| FR-08 | Map securities and fund holdings to EU Taxonomy environmental objectives: climate change mitigation, climate change adaptation, sustainable water, circular economy, pollution prevention, biodiversity |
| FR-09 | Generate fund-level PAI disclosure reports for SFDR Article 4 entity-level reporting and Article 6/8/9 fund-level product disclosures |
| FR-10 | Write ESG scores and fund disclosures to `compliance/sfdr/**`; this path is read by ComplianceShield for regulatory filing |

### 6.3 Sentiment Analysis (sentiment-analyzer)

| ID | Requirement |
|---|---|
| FR-11 | Process news feeds (Reuters, Bloomberg, AP); generate per-security sentiment signals (bullish/bearish/neutral with confidence score and key driver summary) |
| FR-12 | Monitor social media: Twitter/X for institutional and retail sentiment; Reddit (r/investing, r/wallstreetbets) for retail positioning signals; flag unusual retail sentiment spikes as a risk factor |
| FR-13 | Track analyst consensus changes: EPS estimate revisions, price target changes, rating changes; identify divergence between sentiment and consensus |
| FR-14 | Identify sentiment divergence from fundamentals: flag securities where sentiment signal conflicts with market-analyst fundamental view |
| FR-15 | Output alpha signals to `research/pre-publication/sentiment/**` (RESTRICTED until published) |

### 6.4 Fair Value Modelling (fair-value-modeler)

| ID | Requirement |
|---|---|
| FR-16 | Calculate fair value estimates for Level 2 and Level 3 assets under ASC 820 / IFRS 13 fair value hierarchy |
| FR-17 | Support three valuation approaches: market approach (comparable transactions, trading multiples), income approach (DCF with documented assumptions), cost approach where applicable |
| FR-18 | Maintain and update comparables database: private credit transaction multiples, CMBS spread data, CLO tranche pricing, structured product recovery rate history |
| FR-19 | All fair value outputs require human validation by Dr. Sharma's team before use in NAV calculations; SOE blocks any automated write to NAV systems |
| FR-20 | Generate documented valuation memos per ASC 820 requirement: significant unobservable inputs (Level 3), sensitivity analysis, valuation technique rationale |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Throughput** | Process 100 earnings transcripts/day; 500 SEC filings/day; continuous sentiment stream |
| **Latency** | Earnings transcript summary available within 2 hours of filing; SEC 8-K analysis within 1 hour of EDGAR publication |
| **Chinese wall** | Zero technical pathway from ResearchNexus agent processes to `trading/**`, `orders/**`, `executions/**`, `positions/**`; enforced at SOE gate layer |
| **Publication gate** | Pre-publication paths inaccessible to all downstream applications; enforcement is deterministic (deny rule), not advisory |
| **ESG data freshness** | MSCI ESG / Sustainalytics / CDP data refreshed daily; PAI computations use data no older than 30 days for quarterly disclosures |
| **Audit trail** | Every research item: generation timestamp, agent identity, pre-publication duration, review events, publication timestamp, downstream access log |
| **Retention** | Research records: 5 years (SEC Rule 204-2); ESG disclosures: 7 years (SFDR); fair value assessments: 10 years (ASC 820 documentation) |
| **EU AI Act Art.12** | Full traceability from input data source to published research signal; Chronicle logs every generation event with model version |

---

## 8. Integration Architecture

| System | Direction | Data | Constraint |
|---|---|---|---|
| SEC EDGAR | ResearchNexus reads | 8-K, 10-K, 10-Q, proxy filings | Read-only; public source |
| MSCI ESG Research | esg-scorer reads | ESG scores, PAI indicators, controversy data | esg-scorer only; not available to other agents |
| Sustainalytics | esg-scorer reads | ESG risk ratings, controversy research | esg-scorer only |
| CDP | esg-scorer reads | Environmental disclosure data | esg-scorer only |
| News feeds (Reuters, Bloomberg) | market-analyst, sentiment-analyzer read | News, earnings transcripts, broker research | Read-only |
| AlphaEngine | AlphaEngine reads | Published research signals, ESG scores | Published directory only; pre-publication paths denied by AlphaEngine's SOE |
| ComplianceShield | ComplianceShield reads | SFDR PAI reports, EU Taxonomy mappings | `compliance/sfdr/**` read by ComplianceShield |
| TradeSentinel | **BLOCKED** | — | All ResearchNexus pre-publication paths denied; TradeSentinel has no read access to any research directory |

---

*This document is part of the AssetCo AI Platform documentation suite. All financial figures are illustrative. Regulatory requirements should be validated by Legal and Compliance before implementation.*
