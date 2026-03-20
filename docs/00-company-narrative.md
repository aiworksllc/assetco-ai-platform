# AssetCo — Company Narrative

> **Document Series:** AssetCo AI Platform Documentation
> **Document:** 00 — Company Narrative (Foundation)
> **Version:** 1.0
> **Classification:** Public
> **Last Updated:** 2025-Q4

---

## Executive Summary

AssetCo Investment Management ("AssetCo") is a global, independent asset management firm headquartered in New York, managing $85 billion in assets across five business lines and four regulatory jurisdictions. Founded in 1987 by Catherine Hargrove, a former Goldman Sachs portfolio manager, AssetCo has built its reputation on fundamental discipline, conservative risk management, and institutional client service.

In 2024, AssetCo launched an AI Enablement initiative to augment investment research, automate compliance processes, and improve operational efficiency. By 2025, AssetCo had selected Sentinel-Ops as its AI governance platform — the cornerstone of a governance framework that ensures every AI agent operating within the firm does so within a defined, auditable, and regulatorily defensible Safe Operating Envelope (SOE).

This document provides the full company context required to understand AssetCo's operating model, business lines, technology landscape, and governance requirements as they relate to the AI Platform build-out.

---

## Company History

AssetCo's history spans nearly four decades and reflects the evolution of the institutional asset management industry.

| Year | Milestone |
|------|-----------|
| **1987** | Founded by Catherine Hargrove in New York after 15 years as a portfolio manager at Goldman Sachs Asset Management. Initial focus: US large-cap equity, fundamental bottom-up analysis. AUM: $200M at launch. |
| **1991** | Fixed Income division established in response to client demand for balanced mandates. Hired first credit analyst team. |
| **1995** | AUM crosses $5B. Ranked among top-50 independent equity managers by Pensions & Investments. |
| **2001** | London office opened to serve European institutional clients. Obtained FCA authorization. AUM: $18B. |
| **2003** | Launched first UCITS-compliant equity fund for European retail distribution. |
| **2008** | Global Financial Crisis. AssetCo's conservative risk posture — low leverage, high liquidity buffers — resulted in significantly lower drawdowns than peers. Client retention: 97%. AUM: $31B post-crisis (vs. $34B pre-crisis; losses due to market decline, not redemptions). Post-crisis, "AssetCo survived '08" became a central client narrative. |
| **2012** | Alternatives division launched. Hired Dr. Elena Voss from a Zurich-based macro fund to lead long/short equity and global macro strategies. |
| **2015** | Frankfurt office opened for UCITS fund management under BaFin oversight and MiFID I/II compliance coordination. |
| **2018** | Singapore office established to pursue APAC sovereign wealth mandates. MAS Capital Markets Services license obtained. AUM: $62B. |
| **2020** | Multi-Asset Solutions division created. Launched target-date fund series (five vintages, 2025–2065) for defined contribution plan sponsors. |
| **2022** | Private Markets division established. Hired Michael Ashworth (ex-KKR) to lead PE co-investments and private credit strategies. AUM: $78B. |
| **2024** | AI Enablement initiative launched under incoming CTO James Chen (ex-Two Sigma). Internal AI/ML team expanded to 12 quantitative researchers. Budget: $14M over 18 months. |
| **2025** | Selected Sentinel-Ops as enterprise AI governance platform. Began phased deployment across investment, trading, and compliance functions. AUM: $85B. |

---

## Leadership Team

| Name | Title | Background | AI Platform Relevance |
|------|-------|------------|----------------------|
| **Catherine Hargrove** | Founder & CEO | 38 years in asset management; Goldman Sachs PM, 15 years; founded AssetCo 1987 | Sets firm-wide risk appetite for AI; approves governance framework |
| **James Chen** | Chief Technology Officer | Ex-Two Sigma (Head of Research Infrastructure); MIT CS; joined 2024 | AI Enablement initiative owner; platform architecture sponsor |
| **Sarah Nakamura** | Chief Risk Officer | Ex-BlackRock (Model Risk); CFA, FRM; chairs Model Risk Committee | Model risk governance; SR 11-7 compliance for AI models |
| **David Okonkwo** | Chief Compliance Officer | Former SEC enforcement attorney (10 years); compliance architecture across all four jurisdictions | Regulatory examination readiness; information barrier governance |
| **Maria Torres** | Chief Operating Officer | Ex-State Street (COO, Investment Management); T+1 settlement, NAV oversight | Operational AI use cases; NAV calculation, reconciliation |
| **Robert Lindqvist** | Head of EMEA | London-based; FCA/ESMA liaison; 20 years European institutional sales | EU AI Act applicability; MiFID II explainability requirements |
| **Dr. Priya Sharma** | Head of Quantitative Research | PhD, Applied Mathematics (MIT); ex-D.E. Shaw; 8 years at AssetCo | AI/ML model development; leads 12-person quant team |
| **Wei Zhang** | CISO | Ex-JP Morgan (Information Security); CISSP; joined 2023 | Data classification; security controls for AI systems |

---

## Organizational Structure

AssetCo operates a matrix structure with five investment verticals and five shared horizontal functions.

### Investment Verticals (Business Lines)

```
CEO — Catherine Hargrove
│
├── Equities ($28B)           — CIO: Thomas Reeves
├── Fixed Income ($22B)       — CIO: Anna Belova
├── Alternatives ($15B)       — CIO: Dr. Elena Voss
├── Multi-Asset Solutions ($12B) — CIO: Carlos Mendez
└── Private Markets ($8B)     — CIO: Michael Ashworth
```

### Horizontal Functions (Shared Services)

```
CEO — Catherine Hargrove
│
├── Technology — CTO: James Chen
│   ├── Infrastructure & Cloud
│   ├── Data Engineering
│   ├── Application Development
│   └── Quantitative Research — Dr. Priya Sharma
│
├── Risk — CRO: Sarah Nakamura
│   ├── Market Risk
│   ├── Credit Risk
│   ├── Model Risk (SR 11-7)
│   └── Operational Risk
│
├── Compliance — CCO: David Okonkwo
│   ├── US Compliance (SEC/FINRA)
│   ├── EMEA Compliance (FCA/ESMA/BaFin)
│   ├── APAC Compliance (MAS)
│   └── Information Barriers & Surveillance
│
├── Operations — COO: Maria Torres
│   ├── Trade Operations & Settlement
│   ├── Fund Accounting & NAV
│   ├── Reconciliation
│   └── Client Reporting
│
└── Client Services
    ├── Institutional Client Group
    ├── Wealth Management
    └── Sub-Advisory Relationships
```

Each business line CIO has direct authority over portfolio construction and investment decisions within their vertical. Risk and Compliance provide independent oversight and veto authority on risk limit breaches and regulatory violations. Technology and Operations serve as shared infrastructure.

---

## Business Lines

### Equities — $28B AUM

| Attribute | Detail |
|-----------|--------|
| **AUM** | $28B |
| **Strategies** | US large-cap value ($12B), international developed markets ($8B), emerging markets ($5B), sector strategies ($3B) |
| **Investment Approach** | Fundamental bottom-up analysis augmented by quantitative screens. 3–5 year investment horizon. Low portfolio turnover (~30% annually). |
| **Key Products** | AssetCo US Value Equity Composite, AssetCo International Equity Fund (UCITS), AssetCo Emerging Markets Strategy |
| **Primary Clients** | US public pension funds, corporate pension plans, university endowments |
| **Regulatory Overlay** | SEC Investment Advisers Act, ERISA (for pension clients), MiFID II (for EU-domiciled funds), UCITS (for European retail), ESMA ESG disclosure (SFDR) |
| **AI Opportunities** | Factor analysis and signal generation; ESG scoring automation; portfolio optimization (mean-variance, risk parity); earnings transcript NLP; sell-side research synthesis |

**Governance Implications:** Equity research teams must maintain strict information barriers from trading desks (Regulation FD). AI agents used in research cannot have write access to trading systems. Portfolio optimization models are subject to SR 11-7 model risk requirements.

---

### Fixed Income — $22B AUM

| Attribute | Detail |
|-----------|--------|
| **AUM** | $22B |
| **Strategies** | Investment grade corporate ($10B), government/agency ($6B), high yield ($4B), structured products ($2B) |
| **Investment Approach** | Top-down macro overlay combined with bottom-up credit analysis. Active duration management. |
| **Key Products** | AssetCo Investment Grade Credit Composite, AssetCo Short Duration Fund, AssetCo High Yield Strategy |
| **Primary Clients** | Insurance general accounts, corporate defined benefit plans, sovereign wealth funds |
| **Regulatory Overlay** | SEC, ERISA, MiFID II, Solvency II (insurance clients), Basel III (counterparty risk) |
| **AI Opportunities** | Credit risk modeling (default probability, spread prediction); yield curve scenario analysis; pre-trade analytics (TCA); structured product cash flow modeling; covenant monitoring via document parsing |

**Governance Implications:** Insurance clients subject to Solvency II require specific asset eligibility and risk factor documentation. AI-generated credit assessments must be explainable to satisfy internal credit committee requirements and external audit. Structured product modeling requires validated assumptions — SR 11-7 applies.

---

### Alternatives — $15B AUM

| Attribute | Detail |
|-----------|--------|
| **AUM** | $15B |
| **Strategies** | Long/short equity ($6B), global macro ($4B), real assets (real estate and commodities, $3B), event-driven (M&A arbitrage, $2B) |
| **Investment Approach** | High-conviction, concentrated. Significant use of derivatives. Active hedging. |
| **Key Products** | AssetCo Long/Short Equity Fund, AssetCo Global Macro Strategy, AssetCo Real Assets Fund |
| **Primary Clients** | Endowments, foundations, sovereign wealth funds, UHNW family offices |
| **Regulatory Overlay** | SEC (registered investment adviser), AIFMD (for European distribution of AIFs), CFTC (commodity pool operator registration), MAS |
| **AI Opportunities** | Alternative data signal generation (satellite imagery, credit card data, web scraping); execution optimization for derivatives; real-time risk monitoring (VaR, Greeks); event-driven deal screening (NLP on 8-K, press releases) |

**Governance Implications:** Alternative data usage requires legal review and vendor attestation. Derivative risk monitoring AI must operate within real-time latency requirements. AIFMD imposes leverage limits and liquidity stress testing requirements that AI monitoring agents must respect. Event-driven strategies carry heightened market abuse risk (MAR) — AI must enforce trading blackouts.

---

### Multi-Asset Solutions — $12B AUM

| Attribute | Detail |
|-----------|--------|
| **AUM** | $12B |
| **Strategies** | Target-date funds ($5B), balanced strategies ($4B), tactical asset allocation ($3B) |
| **Investment Approach** | Cross-asset-class portfolio construction. Systematic rebalancing with tactical overlays. |
| **Key Products** | AssetCo LifePath Series (2025–2065 vintages), AssetCo 60/40 Balanced Fund, AssetCo Tactical Allocation |
| **Primary Clients** | Defined contribution plan sponsors, retail investors via sub-advisory, mid-market family offices |
| **Regulatory Overlay** | ERISA (DC plans), SEC (mutual fund sub-advisory), MiFID II (EU balanced funds), DOL fiduciary rule |
| **AI Opportunities** | Dynamic asset allocation (regime detection, macro factor models); automated rebalancing execution; glide path optimization; client suitability assessment; personalized reporting generation |

**Governance Implications:** ERISA imposes strict fiduciary standards — AI rebalancing agents must be auditable and operate within defined IPS (Investment Policy Statement) parameters. DOL fiduciary rule requires documentation of best-interest standard for all allocation decisions. Target-date fund glide paths must be disclosed and cannot be modified by AI without board approval.

---

### Private Markets — $8B AUM

| Attribute | Detail |
|-----------|--------|
| **AUM** | $8B |
| **Strategies** | PE co-investments ($4B), private credit ($3B), infrastructure ($1B) |
| **Investment Approach** | Illiquid, long-hold (5–12 year), fundamental underwriting. Quarterly NAV. |
| **Key Products** | AssetCo Private Equity Co-Investment Program, AssetCo Senior Secured Credit Fund, AssetCo Infrastructure Opportunities |
| **Primary Clients** | Large public pension funds, endowments, sovereign wealth funds |
| **Regulatory Overlay** | SEC (registered investment adviser, Form ADV Part 2), AIFMD (EU AIF distribution), state securities laws, LP agreement terms |
| **AI Opportunities** | Deal screening (financial model parsing, sector analysis); portfolio company monitoring (operational KPIs, covenant tracking); private credit underwriting (cashflow modeling, collateral analysis); NAV calculation assistance; LP reporting automation |

**Governance Implications:** Private markets data is highly confidential — deal information carries MNPI (material non-public information) risk. AI agents accessing deal room data must be strictly isolated from public markets trading. LP agreement terms vary per fund — AI must respect fund-specific constraints. Quarterly NAV calculations are auditable — AI-assisted calculations require human sign-off.

---

## Client Base

### Institutional Clients — $62B AUM

| Client Type | AUM Share | Representative Clients |
|-------------|-----------|----------------------|
| US public pension funds | 35% ($21.7B) | State and municipal retirement systems; teachers' funds |
| Corporate pension plans | 20% ($12.4B) | Fortune 500 defined benefit plans |
| Endowments & foundations | 15% ($9.3B) | University endowments, charitable foundations |
| Sovereign wealth funds | 15% ($9.3B) | APAC and Middle East government funds |
| Insurance general accounts | 15% ($9.3B) | Life and P&C carriers' investment portfolios |

Institutional clients typically have Separately Managed Accounts (SMAs) or commingled fund investments with detailed investment management agreements (IMAs) specifying benchmarks, risk limits, and reporting requirements. ERISA-governed plans require special attention to fiduciary standards and prohibited transactions.

### High-Net-Worth Clients — $18B AUM

Served through the Wealth Management channel primarily via registered investment adviser (RIA) partnerships and select family office direct relationships. Average account size: $12M. Suitability assessment, personalized reporting, and ESG preference integration are key service differentiators. Subject to SEC's Regulation Best Interest and applicable state fiduciary standards.

### Retail / Sub-Advisory — $5B AUM

AssetCo provides sub-advisory services to three mutual fund complexes, managing specific sleeves of their funds under white-label arrangements. AssetCo is named in each fund's prospectus as a sub-adviser. Regulatory compliance obligations flow from the fund complex (the registered investment company), but AssetCo must maintain compliance with its own investment guidelines and the fund's IPS.

---

## Geographic Presence

| Office | Jurisdiction | Headcount | Primary Functions |
|--------|-------------|-----------|-------------------|
| **New York (HQ)** | SEC, FINRA | ~1,100 | Investment management, trading, US compliance, technology, operations, senior leadership |
| **London** | FCA, PRA | ~500 | EMEA distribution, FCA-regulated funds (OEIC, FCP), MiFID II compliance, European institutional client coverage |
| **Frankfurt** | BaFin, ESMA | ~200 | UCITS fund management, ESMA regulatory coordination, German institutional clients, SFDR ESG disclosure |
| **Singapore** | MAS | ~200 | APAC sovereign wealth mandates, MAS Capital Markets Services licensed entity, regional institutional client development |

### Regulatory Jurisdiction Details

**New York — US Regulatory Framework**
- SEC registration as investment adviser (Form ADV)
- FINRA membership for broker-dealer activities
- CFTC CPO/CTA registration for derivatives-heavy strategies
- ERISA compliance for pension fund clients
- FinCEN AML/BSA requirements

**London — UK/EU Regulatory Framework**
- FCA authorization as an Alternative Investment Fund Manager (AIFM)
- FCA authorization as MiFID investment firm
- MiFID II: best execution, transaction reporting, research unbundling (RPA)
- UK AIFMD: leverage limits, depositary requirements, reporting to FCA
- UK GDPR / Data Protection Act 2018

**Frankfurt — EU Regulatory Framework**
- BaFin-supervised ManCo (management company) for UCITS funds
- ESMA guidelines compliance for fund management
- SFDR (Sustainable Finance Disclosure Regulation): Article 6/8/9 fund classifications
- EU AI Act compliance (effective 2026): high-risk AI system classification under Annex III for financial services

**Singapore — APAC Regulatory Framework**
- MAS Capital Markets Services (CMS) licence
- MAS Technology Risk Management (TRM) Guidelines
- MAS Notice on Prevention of Money Laundering (MAS 626)
- PDPA (Personal Data Protection Act) for data residency

---

## Technology Landscape

### Core Investment Systems

| System | Vendor | Function | Integration Points |
|--------|--------|----------|--------------------|
| Bloomberg AIM | Bloomberg | Order Management System (OMS) | Pre-trade compliance, FIX order routing |
| Aladdin | BlackRock | Risk analytics, portfolio analytics, fixed income analytics | Daily risk reporting, scenario analysis |
| Eagle PACE | SS&C Eagle | Investment accounting, NAV calculation, performance attribution | Fund accounting, client reporting |
| FlexTrade EMS | FlexTrade | Execution Management System (EMS) | Algo execution, TCA, broker connectivity |
| Charles River IMS | Charles River | Portfolio management, compliance monitoring | Pre-trade, post-trade compliance rules |

### Data Infrastructure

| Layer | Technology | Detail |
|-------|-----------|--------|
| Data Warehouse | Snowflake | Central analytics platform; multi-cloud (AWS primary, Azure DR) |
| Market Data | Bloomberg Terminal / B-PIPE | Real-time and reference data; $6M annual contract |
| Alternative Data | Refinitiv Eikon, proprietary vendors | News sentiment, ESG scores, satellite imagery (for Alternatives) |
| Internal Alpha Signals | Python/R, internal model registry | 12-quant team; signals published to Snowflake for portfolio teams |
| Data Classification | Four tiers: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED | Enforced by DLP tooling and logical access controls |

### Cloud & Infrastructure

| Component | Detail |
|-----------|--------|
| Primary Cloud | AWS (us-east-1 for US operations, eu-west-1 for EMEA) |
| Disaster Recovery | Azure (West Europe) |
| Network | Dedicated AWS Direct Connect circuits (NY, London); VPN for Singapore, Frankfurt |
| Identity | Okta (SSO, MFA); CyberArk (PAM for privileged access) |
| Security | Palo Alto NGFW; Darktrace (network anomaly detection); CrowdStrike (EDR) |

### AI/ML Environment

| Component | Detail |
|-----------|--------|
| Research Compute | AWS SageMaker (model training); on-premise GPU cluster (proprietary alpha research) |
| Model Registry | Internal MLflow instance; model cards, lineage, versioning |
| Languages | Python (primary), R (statistical analysis), Rust (latency-critical execution) |
| Frameworks | PyTorch, scikit-learn, statsmodels, LangChain (for LLM agents) |
| LLM Access | Anthropic Claude API, OpenAI GPT-4 (via API); no training on client data |
| Agent Frameworks | Claude Code (Anthropic), LangGraph, CrewAI — all subject to Sentinel-Ops SOE governance |

### Technical Debt & Challenges

AssetCo's technology stack reflects 38 years of accumulated systems. Key challenges include:

- **Data silos:** Bloomberg AIM, Aladdin, and Eagle PACE each maintain their own position of record. Reconciliation is partially manual and runs nightly.
- **Manual compliance workflows:** Pre-trade compliance rules are maintained in three separate systems (Charles River, Bloomberg AIM, manual spreadsheets for alternatives). AI governance requires a unified control point.
- **Legacy reporting infrastructure:** Client reports are generated by a combination of Eagle PACE, Advent APX (for HNW), and a custom-built PDF generation system. AI-assisted reporting requires careful integration without breaking existing delivery SLAs.
- **Access control fragmentation:** User provisioning spans Okta, Bloomberg entitlements, Aladdin access groups, and Eagle PACE roles. No single identity graph exists.
- **T+1 settlement pressure:** The SEC's T+1 mandate (effective May 2024) has compressed trade operations timelines. Operations team is stretched; AI automation for settlement exception management is a priority.

---

## The AI Imperative

AssetCo's AI Enablement initiative is driven by six converging pressures:

### 1. Alpha Generation
Quantitative signals have become table stakes among institutional asset managers. AssetCo's 12-person quant team is small relative to larger competitors. AI-augmented factor analysis, NLP-based earnings sentiment, and alternative data integration are critical to maintaining alpha generation in an increasingly competitive landscape. The investment in AI research tooling is estimated to generate 30–50bps of incremental alpha per strategy if implemented correctly.

### 2. Real-Time Risk Management
Managing $85B across five asset classes, four jurisdictions, and hundreds of counterparties requires continuous risk monitoring. Current Aladdin-based risk runs are batch (overnight and intraday T+2). AI-based real-time exposure monitoring, pre-trade risk simulation, and limit breach alerting would reduce the response time for risk events from hours to seconds.

### 3. Compliance Automation
AssetCo operates under more than 20 distinct regulatory frameworks across SEC, FINRA, FCA, ESMA, BaFin, MAS, CFTC, and applicable local rules. Compliance staff manually review approximately 2,400 regulatory documents per year. AI-assisted regulatory change monitoring, pre-trade compliance checking, and reporting automation are essential as headcount growth cannot match regulatory complexity growth.

### 4. Operational Efficiency
T+1 settlement has compressed the time available for trade matching, fails resolution, and NAV computation. NAV calculation for Private Markets funds involves complex waterfall calculations currently managed in Excel. AI automation of exception management, reconciliation, and NAV assistance is a direct operational necessity.

### 5. Client Experience
Institutional clients increasingly expect customized reporting, ESG attribution, and scenario analysis on demand. HNW clients expect digital access comparable to wealth management platforms. AI-generated client reports, suitability analysis, and interactive portfolio analytics would improve both client retention and new business conversion.

### 6. Competitive Pressure
BlackRock operates a 1,000+ person technology team with $1B+ annual technology investment. Vanguard, Fidelity, and State Street have comparable AI budgets. AssetCo's $14M AI Enablement budget is a small fraction of what the largest managers spend. Governance-first AI deployment — deploying fewer, better-governed AI tools — is AssetCo's strategic response to resource constraints.

---

## The Governance Challenge

AssetCo's AI governance requirements are among the most demanding of any regulated industry. Seven distinct governance obligations apply:

### Fiduciary Duty
As a registered investment adviser, AssetCo owes a fiduciary duty to all advisory clients — a higher standard than mere suitability. Every AI-generated recommendation that influences investment decisions must be defensible as in the client's best interest. AI agents cannot make autonomous investment decisions outside defined parameters without violating this duty.

### Multi-Jurisdictional Compliance
Four regulatory regimes with conflicting requirements apply simultaneously:
- SEC requires specific books and records retention (17 CFR 275.204-2): 5–7 years for most records
- MiFID II requires best execution documentation and transaction reporting within T+1
- ESMA/SFDR requires ESG disclosure aligned to AI-generated ESG scores
- MAS Technology Risk Management guidelines require AI systems to be auditable and controllable

### Information Barriers (Chinese Walls)
AssetCo maintains information barriers between:
- Research (fundamental analysis) and Trading (execution)
- Investment banking advisory (for M&A-related strategies) and public markets
- Private Markets deal teams and public markets portfolio managers

These barriers are enforced by Compliance (Policy Wall management), Technology (logical access controls), and physical office layout. AI agents must respect these barriers — an AI agent used by a research analyst cannot have read access to trading positions, and vice versa.

### Model Risk Management (SR 11-7)
The OCC/Federal Reserve SR 11-7 guidance on model risk management applies to all quantitative models used in investment management. AI/ML models are explicitly in scope. Requirements include:
- Model development documentation (purpose, methodology, assumptions, limitations)
- Model validation by an independent team
- Model performance monitoring and back-testing
- Model inventory maintained in the model registry

### Data Classification
AssetCo maintains a four-tier data classification scheme:

| Tier | Definition | Examples | AI Access Rules |
|------|-----------|---------|-----------------|
| **PUBLIC** | Released to public domain | Press releases, regulatory filings | Any agent may read |
| **INTERNAL** | Non-sensitive internal use | Internal memos, org charts | Agents with INTERNAL clearance |
| **CONFIDENTIAL** | Client data, financial data | Portfolio holdings, client PII, trade records | Role-specific agents only |
| **RESTRICTED** | MNPI, deal data, regulatory investigation | M&A deal information, regulatory exam materials | Named individuals and specific agents only |

### Audit and Record Retention
Investment decisions, trade records, client communications, and compliance approvals must be retained for 7+ years under SEC rules. Every AI agent interaction that influences an investment decision or client recommendation must be captured in an immutable audit trail sufficient to reconstruct the decision for regulatory examination.

### Operational Risk
A single errant AI trade could exceed risk limits on a fund, trigger a regulatory breach, or harm clients. The firm's operational risk framework (aligned to Basel II/III) requires that AI systems be subject to the same change management, access control, and incident management processes as any other critical system.

---

## Why Sentinel-Ops

AssetCo evaluated six AI governance platforms before selecting Sentinel-Ops. The selection rationale maps directly to AssetCo's governance obligations:

| Governance Requirement | Sentinel-Ops Capability |
|----------------------|------------------------|
| Fiduciary duty — AI actions must stay within defined, auditable parameters | SOE enforcement per agent: Identity, Data Access, and Tool Action constraints |
| Real-time enforcement without latency impact on trading | Deterministic pre-filter handles 95% of tool calls in <1ms; AI reasoning for 5% ambiguous cases in 2–5s |
| Information barrier enforcement | Data access rules (readAllow/readDeny glob patterns) enforce Chinese wall data isolation per agent SOE |
| Model risk (SR 11-7) — AI decisions must be documented | Chronicle module: immutable, append-only audit trail for every SOE decision |
| Multi-framework compliance — SEC, MiFID II, AIFMD, EU AI Act | Compliance report generation in OSCAL format; regulatory framework mapping in Chronicle |
| Custom risk scoring aligned to AssetCo's risk model | Arbiter webhook integration: AssetCo-specific risk scoring replaces default scoring engine |
| Custom audit classification for regulatory examination | Chronicle webhook integration: regulatory document classification per SEC/FCA requirements |
| Fail-safe behavior — AI must fail closed, not open | Fail-CLOSED default: if the SOE gate cannot evaluate, the tool call is blocked |
| Agent framework agnostic — Claude, LangGraph, CrewAI in use | Framework-agnostic hook integration; SOE gate operates on tool call events regardless of framework |

Sentinel-Ops was deployed initially in shadow mode across three pilot applications — the Portfolio Analytics Agent, the Compliance Monitoring Agent, and the Client Reporting Agent — before being elevated to full enforcement mode. This audit-phase protocol (shadow → warn → soft enforce → full enforce) aligned with AssetCo's change management requirements and SR 11-7 model validation process.

---

## Document References

This document is the foundation of the AssetCo AI Platform documentation series. The following documents build on this narrative:

| Document | Title | Description |
|----------|-------|-------------|
| **00** | Company Narrative *(this document)* | AssetCo business context, history, org structure, and governance obligations |
| **[01](./01-operating-model.md)** | AI Operating Model | How AI agents are governed, deployed, and monitored at AssetCo; the three-layer bounded authority model; wave-based rollout plan |
| **[02](./02-agent-catalog.md)** | Agent Catalog | Inventory of all AI agents deployed at AssetCo: purpose, SOE definition, owning team, regulatory classification |
| **[03](./03-soe-governance.md)** | SOE Governance Framework | SOE definition schema, information barrier enforcement, data classification enforcement, compliance mapping |
| **[04](./04-compliance-mapping.md)** | Regulatory Compliance Mapping | Detailed mapping of SEC, MiFID II, AIFMD, EU AI Act, and MAS TRM requirements to Sentinel-Ops controls |
| **[05](./05-implementation-roadmap.md)** | Implementation Roadmap | Phased deployment plan: pilot applications, wave-based rollout, acceptance criteria, go-live milestones |

### Application-Level Documentation

| Document | Application | Description |
|----------|------------|-------------|
| **[apps/portfolio-analytics-agent.md](./apps/portfolio-analytics-agent.md)** | Portfolio Analytics Agent | SOE definition, risk budget, allowed data sources, equities and fixed income use cases |
| **[apps/compliance-monitoring-agent.md](./apps/compliance-monitoring-agent.md)** | Compliance Monitoring Agent | Regulatory change monitoring, pre-trade compliance check SOE, cross-jurisdiction rules |
| **[apps/client-reporting-agent.md](./apps/client-reporting-agent.md)** | Client Reporting Agent | Personalized report generation SOE, suitability guardrails, PII handling rules |
| **[apps/trading-execution-agent.md](./apps/trading-execution-agent.md)** | Trading Execution Agent | Highest-risk classification; strict tool action bounds; real-time enforcement requirements |
| **[apps/private-markets-screening-agent.md](./apps/private-markets-screening-agent.md)** | Private Markets Screening Agent | RESTRICTED data access; deal room isolation; MNPI barrier enforcement |

### Compliance Documentation

| Document | Description |
|----------|-------------|
| **[compliance/sec-exam-readiness.md](./compliance/sec-exam-readiness.md)** | How Sentinel-Ops audit trail supports SEC examination; record retention mapping |
| **[compliance/mifid-ii-mapping.md](./compliance/mifid-ii-mapping.md)** | MiFID II best execution and transaction reporting obligations; AI agent compliance |
| **[compliance/eu-ai-act-assessment.md](./compliance/eu-ai-act-assessment.md)** | EU AI Act high-risk classification assessment; conformity obligations |
| **[compliance/sr-11-7-model-risk.md](./compliance/sr-11-7-model-risk.md)** | SR 11-7 model risk management application to Sentinel-Ops governed AI models |

---

*AssetCo Investment Management is a fictional company created for demonstration purposes. All AUM figures, client relationships, regulatory registrations, and personnel are illustrative. This documentation series is designed to showcase Sentinel-Ops SOE governance in a realistic asset management context.*

*This document is maintained by the AssetCo AI Platform team. For questions, contact the platform team via the internal AI Enablement program portal.*
