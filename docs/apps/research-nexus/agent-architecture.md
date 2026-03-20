# ResearchNexus — Agent Architecture

**Application:** ResearchNexus
**Document:** agent-architecture.md
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** Dr. Priya Sharma (Head of Quantitative Research)
**Audience:** CTO, Head of Research, Model Risk, Compliance Technology

---

## 1. Architecture Overview

ResearchNexus is a 4-agent system. The agents are partitioned by research function — fundamental analysis, ESG scoring, sentiment signals, and fair value modelling — with strict write-path separation between them. No agent can write to another agent's output directory. All four agents share a common chinese wall: a complete deny of all trading, order, execution, and position data.

```
                        ┌─────────────────────────────────────────────────────────────┐
                        │                    CHINESE WALL                              │
                        │   trading/**  orders/**  executions/**  positions/**         │
                        │   portfolios/model/**  — DENIED to ALL ResearchNexus agents  │
                        └─────────────────────────────────────────────────────────────┘
                                              │ (SOE deny — deterministic)
                                              │
          ┌───────────────────────────────────┼───────────────────────────────────────┐
          │                                   │                                       │
          ▼                                   ▼                                       ▼                       ▼
  ┌───────────────┐                  ┌───────────────┐                  ┌───────────────────┐      ┌───────────────────┐
  │ market-analyst│                  │  esg-scorer   │                  │sentiment-analyzer │      │fair-value-modeler │
  │               │                  │               │                  │                   │      │                   │
  │ NLP: earnings │                  │ SFDR PAI      │                  │ News / social /   │      │ ASC 820 / IFRS 13 │
  │ transcripts,  │                  │ indicators,   │                  │ analyst consensus │      │ Level 2/3 fair    │
  │ SEC filings,  │                  │ MSCI ESG,     │                  │ signals           │      │ value estimates   │
  │ broker rsch   │                  │ Sustainalytics│                  │                   │      │                   │
  └───────┬───────┘                  └───────┬───────┘                  └────────┬──────────┘      └────────┬──────────┘
          │                                  │                                   │                          │
          ▼                                  ▼                                   ▼                          ▼
  research/pre-publication/         research/pre-publication/          research/pre-publication/   research/pre-publication/
  analysis/**                       esg/**                             sentiment/**                valuations/**
  compliance/sfdr/**
          │                                  │                                   │                          │
          └──────────────────────────────────┴───────────────────────────────────┴──────────────────────────┘
                                                             │
                                              ┌──────────────▼──────────────┐
                                              │   PUBLICATION GATE          │
                                              │   (human workflow step)     │
                                              │                             │
                                              │  Pre-publication: RESTRICTED│
                                              │  → Internal review          │
                                              │  → IC presentation          │
                                              │  → CCO sign-off             │
                                              │  → Published                │
                                              └──────────────┬──────────────┘
                                                             │
                                              ┌──────────────▼──────────────┐
                                              │   research/published/**     │
                                              │   (readable by AlphaEngine, │
                                              │   ComplianceShield)         │
                                              └─────────────────────────────┘
```

---

## 2. Agent Definitions

### 2.1 market-analyst

**Function:** NLP processing of earnings transcripts, SEC filings, news, and broker research. Generates structured research summaries that surface key findings, identified risks, and forward-looking opportunities for human analyst review.

**Inputs:**
- Earnings call transcripts (via transcript data provider or direct from company IR feeds)
- SEC EDGAR filings: 8-K (material events), 10-K (annual), 10-Q (quarterly), proxy statements (DEF 14A), S-1/S-11 registration statements
- News feeds: Reuters, Bloomberg, AP wire
- Broker research reports (via licensed data aggregators)

**Core capabilities:**
- Management tone classification per earnings call: positive, neutral, cautious, evasive; keyed to forward-looking statement language, hedging density, and guidance specificity
- Guidance revision extraction: structured delta vs. prior quarter guidance (magnitude, direction, segment-level breakdown)
- Material development identification: management changes (CEO/CFO/board), regulatory actions, litigation disclosures, customer concentration changes (>10% revenue), supply chain disruptions, credit facility amendments
- SEC filing comparison: year-over-year risk factor change detection (new risks added, risks removed, risk language strengthened); MD&A trend extraction; financial statement anomaly flagging (revenue recognition changes, reserve movements, one-time items)
- Key findings structuring: outputs a JSON object per research item with fields: `security_id`, `ticker`, `document_type`, `publication_date`, `key_findings[]`, `risks[]`, `opportunities[]`, `management_tone`, `guidance_revision`, `material_developments[]`, `analyst_confidence_score`

**Outputs:** Writes to `research/pre-publication/analysis/**` only. All outputs classified RESTRICTED. Human-readable markdown summary attached to each JSON record.

**What it cannot do:** Cannot read any trading data, positions, pending orders, or execution history. Cannot write to published directories directly — publication requires human workflow completion.

**Risk budget:** 600 events/day (highest in ResearchNexus; reflects high-volume NLP processing workload).

---

### 2.2 esg-scorer

**Function:** Computes ESG scores per SFDR Principal Adverse Impact indicators, integrates data from specialist ESG data providers, maps fund holdings to EU Taxonomy environmental objectives, and generates SFDR fund-level sustainability disclosures.

**Inputs:**
- MSCI ESG Research API: company ESG scores, ESG rating (AAA–CCC), controversy scores, ESG momentum
- Sustainalytics API: ESG risk ratings, unmanaged ESG risk, controversy research, global standards screening (UN Global Compact, OECD Guidelines)
- CDP database: corporate environmental disclosures — climate, water, forests; Scope 1/2/3 GHG emissions data
- SFDR Principal Adverse Impact reference data: EU taxonomy technical screening criteria, PAI indicator definitions (Annex I, Table 1 mandatory + Table 2 optional)
- Fund composition data: security-level holdings for SFDR Article 8/9 classified funds (read from `portfolios/holdings/**`, which is fund holdings — not model/target portfolios)

**Core capabilities:**
- PAI indicator computation per holding and fund aggregate: Mandatory PAI indicators (14 for investee companies, 2 for sovereign bonds) and selected optional indicators
- EU Taxonomy alignment scoring: maps each holding's revenue and capex to the six environmental objectives using NACE code mapping and sector-level screening criteria
- SFDR fund-level disclosure generation: Article 4 entity-level PAI statement; Article 6 (no sustainability claim), Article 8 (environmental/social characteristics), Article 9 (sustainable investment objective) product-level disclosures
- Data quality scoring: flags PAI indicators where estimated data is used vs. reported data; flags data staleness (>12 months) per indicator per security; computes fund-level data coverage ratio
- ESG provider reconciliation: where MSCI ESG and Sustainalytics disagree materially on a rating, flags for human analyst review with source-level breakdown

**Special data access:** esg-scorer is the only ResearchNexus agent with read access to MSCI ESG, Sustainalytics, and CDP data paths. This reflects that ESG provider data requires specialist licensing and that scattering provider access across agents creates unnecessary data surface.

**Outputs:** Writes ESG scores to `research/pre-publication/esg/**` (RESTRICTED) and writes SFDR disclosure drafts directly to `compliance/sfdr/**` for ComplianceShield consumption. SFDR outputs to `compliance/sfdr/**` are not subject to the research publication gate — they follow the compliance filing workflow governed by ComplianceShield.

**Risk budget:** 300 events/day.

---

### 2.3 sentiment-analyzer

**Function:** Processes news feeds, social media, and analyst consensus data to generate sentiment signals. Identifies divergence between market sentiment and fundamental research views.

**Inputs:**
- News feeds: Reuters Elektron, Bloomberg News, AP wire, Dow Jones Newswires
- Social media: Twitter/X Streaming API (institutional commentary, management tweets, activist investor communications); Reddit (r/investing, r/wallstreetbets for retail positioning signals)
- Analyst consensus: I/B/E/S or FactSet consensus EPS estimates, price target aggregates, buy/hold/sell rating distributions and revision history
- Market data: price and volume feeds — prices and volume only; no position data, no pending order data

**Core capabilities:**
- Per-security news sentiment: daily and intraday sentiment signals (bullish/bearish/neutral) with confidence score (0–1) and key driver text extraction; rolling 30-day sentiment trend
- Social media signal processing: volume-weighted retail sentiment score; unusual activity detection (sentiment spike > 2 sigma vs. 30-day baseline); short squeeze precursor pattern detection
- Analyst consensus shift detection: EPS estimate revision direction and magnitude; price target distribution change; rating upgrade/downgrade cluster detection (multiple analysts revising in same direction within 5-day window)
- Fundamental divergence flagging: compares sentiment signal to market-analyst fundamental classification; flags securities where sentiment and fundamentals are materially divergent (e.g., strongly bullish sentiment vs. cautious fundamental view) for human analyst attention
- Output format: per-security JSON record with `sentiment_score`, `sentiment_direction`, `confidence`, `drivers[]`, `consensus_revision`, `retail_activity_flag`, `divergence_flag`

**Outputs:** Writes to `research/pre-publication/sentiment/**` only (RESTRICTED). Sentiment signals are alpha signals and subject to the publication gate before AlphaEngine can act on them.

**Key constraint:** Reads market prices and volume for context only. Cannot read positions, pending orders, or order flow — the chinese wall applies to sentiment-analyzer exactly as to every other ResearchNexus agent.

**Risk budget:** 400 events/day.

---

### 2.4 fair-value-modeler

**Function:** Calculates fair value estimates for illiquid and hard-to-value securities under the ASC 820 / IFRS 13 fair value hierarchy. Covers Level 2 (observable inputs other than quoted prices) and Level 3 (significant unobservable inputs) assets in AssetCo's alternatives and private markets book.

**Inputs:**
- Comparable securities data: private credit transaction comps database, leveraged loan pricing (LSTA), CMBS spread indices, CLO tranche spreads, distressed debt comps
- Pricing sources: broker dealer marks (monthly), independent pricing service marks, Bloomberg evaluated pricing
- Historical valuation records: prior quarter fair value estimates and inputs for consistency analysis
- Fund composition data: Level 2/3 asset holdings list (read-only; from `portfolios/holdings/**`)

**Core capabilities:**
- Market approach valuation: comparable transaction multiples (EV/EBITDA, Price/Book, Price/NAV); market-based credit spreads adjusted for security-specific features (seniority, covenant package, collateral quality)
- Income approach (DCF): discounted cash flow modelling with documented macro assumptions (base rate, credit spread, recovery rate); sensitivity tables across key inputs
- Level 3 input documentation: for every Level 3 estimate, generates a structured record of significant unobservable inputs, the range of inputs used, the relationship between inputs and fair value, and the valuation technique applied — the documentation that external auditors and regulators inspect under ASC 820
- Valuation uncertainty quantification: fair value range (low/mid/high) with narrative explanation of range drivers
- Quarterly roll-forward: tracks Level 3 changes — purchases, sales, settlements, transfers in/out of Level 3, unrealised gains/losses

**Outputs:** Writes to `research/pre-publication/valuations/**` (RESTRICTED). All fair value estimates require human validation by Dr. Sharma's team and independent sign-off from Model Risk (Sarah Nakamura) before use in NAV calculations. The SOE contains an explicit deny on any automated write to NAV or portfolio accounting systems.

**Risk budget:** 200 events/day (lowest in ResearchNexus; fair value modelling is computationally intensive but lower volume than NLP pipelines).

---

## 3. Chinese Wall: ResearchNexus vs. TradeSentinel / AlphaEngine

The chinese wall is enforced in both directions. ResearchNexus agents cannot read trading data. TradeSentinel and AlphaEngine agents cannot read pre-publication research. Both sides of the barrier are enforced by SOE deny rules — not network ACLs, not access control conventions.

```
┌─────────────────────────────────┐          ┌─────────────────────────────────┐
│        RESEARCH SIDE            │          │         TRADING SIDE            │
│                                 │          │                                 │
│  market-analyst                 │          │  TradeSentinel                  │
│  esg-scorer                     │  WALL    │    order-router                 │
│  sentiment-analyzer             │◄────────►│    execution-monitor            │
│  fair-value-modeler             │          │    tca-analyzer                 │
│                                 │          │                                 │
│  CAN READ:                      │          │  CAN READ:                      │
│  - SEC filings, news            │          │  - research/published/**        │
│  - ESG provider data            │          │  - trading/**, orders/**        │
│  - Prices/volume (not pos.)     │          │  - executions/**, positions/**  │
│  - research/published/**        │          │                                 │
│                                 │          │  CANNOT READ:                   │
│  CANNOT READ:                   │          │  - research/pre-publication/**  │
│  - trading/**                   │          │    (denied by TradeSentinel SOE)│
│  - orders/**                    │          │                                 │
│  - executions/**                │          │  AlphaEngine                    │
│  - positions/**                 │          │  CAN READ:                      │
│  - portfolios/model/**          │          │  - research/published/** only   │
│    (denied by ResearchNexus SOE)│          │  CANNOT READ:                   │
│                                 │          │  - research/pre-publication/**  │
└─────────────────────────────────┘          └─────────────────────────────────┘

   Front-running prevention:                    Selective disclosure prevention:
   Research agents do not know                  Trading agents cannot act on
   the firm's current positions                 unpublished research views
   or pending orders.                           until formally published.
```

This two-sided enforcement eliminates the primary front-running vector: a research AI that can see the firm's current positions or pending order flow could produce outputs — subtly or overtly — that reflect that position knowledge, allowing a downstream consumer to trade ahead of known firm activity.

---

*This document is part of the AssetCo AI Platform documentation suite. All financial figures are illustrative. Regulatory requirements should be validated by Legal and Compliance before implementation.*
