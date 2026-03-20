# AssetCo — Operating Model

**Document Version:** 1.0
**Classification:** Internal
**Last Updated:** March 2026

---

## Overview

AssetCo is an $85B global asset manager headquartered in New York, with investment offices in London, Frankfurt, and Singapore. The firm manages capital across five business lines — Equities ($28B), Fixed Income ($22B), Alternatives ($15B), Multi-Asset ($12B), and Private Markets ($8B) — serving institutional clients including pension funds, sovereign wealth funds, endowments, and family offices.

This document describes AssetCo's investment operating model: the end-to-end value chain, business line specifics, data architecture, information barriers, and the technology stack that underpins daily operations. It establishes the organizational and data context within which the AssetCo AI Platform operates, and maps each stage of the investment process to the AI applications governed by Sentinel-Ops.

---

## Investment Value Chain

AssetCo's investment process follows a ten-stage value chain, from research ideation through client reporting. Each stage produces data consumed by downstream stages, and each stage is a candidate for AI augmentation subject to SOE-governed guardrails.

### 1. Research and Ideation

Portfolio managers and research analysts generate investment ideas through fundamental analysis, quantitative factor research, macroeconomic outlook, and ESG screening. Research notes are classified **Restricted** until formally published to the investment committee, at which point they become **Internal**.

**AI Application:** ResearchNexus — ingests earnings transcripts, SEC filings, alternative data feeds, and ESG reports; surfaces material developments and generates structured research summaries.

**Key constraint:** Pre-publication research is subject to strict information barrier controls. ResearchNexus outputs are SOE-gated to prevent leakage to trading teams prior to publication.

---

### 2. Portfolio Construction

Quantitative analysts and portfolio managers translate research convictions into model portfolios. This involves mean-variance optimization, factor exposure targeting, ESG tilt application, and regulatory constraint enforcement (concentration limits, liquidity thresholds, benchmark deviation bands).

**AI Application:** AlphaEngine — runs portfolio optimization, generates factor-aligned model portfolios, enforces mandate constraints, and produces the authoritative trade list delta.

**Key constraint:** AlphaEngine reads from published research signals only. SOE dataAccess rules enforce `readDeny` on ResearchNexus pre-publication artifacts.

---

### 3. Order Generation

Approved model portfolio changes are translated into order sets. Trade list generation includes crossing opportunities (internal netting across funds), order aggregation, and urgency tiering. Orders flow into Bloomberg AIM (OMS) as staged, pending orders requiring trader review.

**AI Application:** AlphaEngine (order staging), TradeSentinel (pre-trade compliance screening).

---

### 4. Execution

Traders route orders through FlexTrade EMS using smart order routing logic. Venue selection considers lit/dark pools, internalization opportunities, and broker liquidity. Transaction cost analysis (TCA) benchmarks are applied in real time (VWAP, arrival price, implementation shortfall).

**AI Application:** TradeSentinel — evaluates execution quality, flags anomalous order routing decisions, detects potential market impact or spoofing patterns, and enforces best-execution documentation requirements under MiFID II and Reg NMS.

---

### 5. Settlement and Clearing

Executed trades are affirmed and submitted to custodians and central counterparties (CCPs) for settlement. AssetCo operates on T+1 for US equities and T+2 for most European and APAC instruments. Settlement instructions flow through Eagle PACE to custodian networks (BNY Mellon, State Street). Failed trades are tracked and escalated per CSDR penalty regime thresholds.

**AI Application:** OpsFabric — automates settlement instruction generation, monitors fails, and triages corporate action elections.

---

### 6. Reconciliation

Operations teams reconcile positions, cash balances, and corporate actions daily against custodian records. Breaks are classified by root cause (timing, pricing, corporate action), prioritized by age and dollar value, and routed to resolution queues.

**AI Application:** OpsFabric — detects reconciliation breaks, classifies root cause, and routes to the appropriate resolver. Chronic break patterns are escalated to Technology.

---

### 7. NAV and Valuation

Fund accountants compute daily NAV for UCITS and 40-Act vehicles. Fair value pricing is applied for illiquid or suspended securities per ASC 820 / IFRS 13. Pricing sources are hierarchical: exchange close prices > evaluated pricing services (ICE, Bloomberg BVAL) > model-based fair value.

**AI Application:** OpsFabric — validates NAV inputs, flags stale prices, identifies securities requiring Level 2/3 fair value treatment, and supports pricing challenge workflows.

---

### 8. Risk Management

Aladdin is the primary risk platform. Risk teams compute daily VaR (historical and parametric), conduct scenario analysis, monitor limit utilization, and run liquidity stress tests. Cross-fund exposure aggregation is a key workflow given the multi-mandate structure.

**AI Application:** RiskCompass — aggregates Aladdin outputs with real-time position data, detects emergent cross-fund concentration, monitors drawdown trajectories, and generates intraday risk summaries for portfolio managers.

---

### 9. Compliance Monitoring

Compliance officers run pre-trade and post-trade rule checks against investment guidelines, regulatory mandates (UCITS eligible assets, 40-Act diversification, AIFMD leverage limits), and client-specific investment policy statements (IPS). Regulatory reporting obligations include EMIR trade reporting, MiFIR transaction reporting, Form PF, and SFDR sustainability disclosures.

**AI Application:** ComplianceShield — evaluates pre-trade orders against all applicable rule sets, flags post-trade violations, and auto-populates regulatory report templates. ComplianceShield operates in read-only surveillance mode; it cannot modify orders or portfolios.

---

### 10. Client Reporting

Quarterly performance attribution reports, regulatory disclosures (KIID, PRIIP, Form ADV), and bespoke client dashboards are prepared by the Client Reporting team. Performance is attributed using Brinson-Hood-Beebower decomposition and compared against benchmark.

**AI Application:** AdvisorLens — generates performance attribution narratives, drafts client-facing commentary, and populates regulatory disclosure templates from structured data sources.

---

## Business Line Operating Details

### Equities ($28B AUM)

**Investment Process:** Hybrid fundamental-quantitative model. Sector analysts provide bottom-up conviction scores; quantitative overlay optimizes portfolio construction for factor exposures (value, quality, momentum, low-volatility) within benchmark tracking error bands.

**Key Systems:** Bloomberg AIM (OMS), FlexTrade EMS, Aladdin (risk), Bloomberg Terminal (research), FactSet (attribution).

**Regulatory Requirements:**
- US: SEC Reg NMS (best execution), SEC Regulation FD (material information), Investment Company Act (40-Act diversification for registered funds)
- EU: MiFID II (best execution, transaction reporting), EMIR (derivatives reporting), SFDR (sustainability disclosures)
- APAC: MAS Fund Management regulations (Singapore), FCA COBS rules (London)

**Data Flows:** Bloomberg real-time prices → AIM → FlexTrade → execution reports → Eagle PACE → Aladdin. Internal alpha signals flow from AlphaEngine to AIM order staging. ESG scores from MSCI and Sustainalytics are applied at portfolio construction.

---

### Fixed Income ($22B AUM)

**Investment Process:** Credit committee reviews new issuances and monitors existing holdings. Duration management is centralized at the desk level with portfolio manager latitude for spread duration positioning. Liquidity tiering (on-the-run vs. off-the-run, IG vs. HY) governs position sizing.

**Key Systems:** Bloomberg AIM, Tradeweb (rates electronic trading), MarketAxess (credit electronic trading), Bloomberg BVAL (pricing), Moody's Analytics (credit models).

**Regulatory Requirements:**
- US: TRACE reporting for FINRA-member dealers, Volcker Rule compliance for any affiliated entity, ERISA for pension mandates
- EU: MiFIR pre- and post-trade transparency (bond-specific rules under SI regime), EMIR for CDS/IRS
- UK: FCA reporting, LIBOR transition compliance

**Data Flows:** ICE/Bloomberg evaluated prices → Eagle PACE (NAV). TRACE feeds → ComplianceShield (post-trade monitoring). Credit ratings from Moody's/S&P flow into RiskCompass for downgrade monitoring.

---

### Alternatives ($15B AUM)

**Investment Process:** Three distinct sub-strategies — long/short equity, global macro, and event-driven. Each strategy team operates with higher autonomy than long-only. Risk limits are strategy-level rather than portfolio-wide. Prime broker relationships (Goldman Sachs, Morgan Stanley) provide leverage and securities lending.

**Key Systems:** Bloomberg AIM, prime broker portals (Goldman Marquee, MS Matrix), Aladdin (consolidated risk), proprietary signal libraries.

**Regulatory Requirements:**
- EU: AIFMD (leverage limits, liquidity management, depositary requirements), SFDR
- US: Form PF (quarterly/annual reporting for SEC-registered advisers), Dodd-Frank swap reporting
- APAC: MAS Capital Markets Services licence requirements

**Data Flows:** Prime broker swap and margin feeds → Aladdin (consolidated exposure). Alternative data providers (satellite imagery, credit card panels, web scraping) feed proprietary signal libraries consumed by AlphaEngine. Event-driven deal data flows through ResearchNexus with strict information barrier enforcement.

---

### Multi-Asset ($12B AUM)

**Investment Process:** Cross-asset allocation engine rebalances continuously against strategic asset allocation targets. Tactical tilts are implemented by a dedicated overlay team. Rebalancing triggers include threshold breach, calendar-based rules, and client-specific mandates (e.g., target-date glide paths).

**Key Systems:** Bloomberg AIM (all asset class order management), Aladdin (cross-asset risk), Eagle PACE (multi-currency NAV), proprietary allocation engine.

**Regulatory Requirements:**
- ERISA: Prudent investor standard, diversification requirements, prohibited transaction rules for pension mandate clients
- EU: UCITS eligible asset rules for cross-listed funds, MiFID II suitability for retail target-date products
- Suitability documentation for all advisory mandates under SEC Reg BI

**Data Flows:** Aggregated position data from all business lines feeds the cross-asset allocation engine. RiskCompass provides unified cross-asset VaR. AlphaEngine handles rebalancing trade generation across equities, fixed income, and derivatives.

---

### Private Markets ($8B AUM)

**Investment Process:** Deal pipeline managed from origination through due diligence, IC approval, close, portfolio monitoring, and exit. Quarterly NAV computed using discounted cash flow and comparable transaction multiples (ASC 820 Level 3). J-curve modeling for fund performance projections.

**Key Systems:** Intralinks (deal collaboration), internal deal pipeline database, Burgiss (performance analytics), custom valuation models (Excel/Python).

**Regulatory Requirements:**
- EU: AIFMD (leverage, liquidity, depositary), SFDR Article 8/9 fund classifications
- US: Form PF (hedge fund and PE fund reporting), SEC registration for advisers >$150M AUM
- Reporting: ILPA reporting standards for LP communications, PCAP reporting

**Data Flows:** Portfolio company financials (quarterly) → valuation models → Eagle PACE (NAV). SFDR sustainability data flows from portfolio companies through OpsFabric to regulatory report generation. Private Markets is fully isolated from public markets data flows per information barrier policy.

---

## RACI Matrix

The following matrix maps accountability across the investment value chain. Roles: R = Responsible (does the work), A = Accountable (owns the outcome), C = Consulted (provides input), I = Informed (receives output), S = Support (provides tooling/infrastructure).

| Process Step | Portfolio Mgmt | Trading | Risk | Compliance | Operations | Technology |
|---|---|---|---|---|---|---|
| Research & Ideation | R/A | I | C | C | — | S |
| Portfolio Construction | R/A | C | C | C | — | S |
| Order Generation | R | A | C | C | — | S |
| Execution | C | R/A | C | C | — | S |
| Settlement & Clearing | I | C | — | C | R/A | S |
| Reconciliation | I | I | C | C | R/A | S |
| NAV & Valuation | C | — | C | C | R/A | S |
| Risk Monitoring | C | C | R/A | C | I | S |
| Compliance Monitoring | C | C | C | R/A | I | S |
| Client Reporting | R | I | C | C | A | S |

**Notes:**
- Portfolio Management holds dual R/A on research and construction because investment decisions are owned by fund managers, not a separate layer.
- Trading is Accountable for order generation because traders are the last human checkpoint before market interaction.
- Operations is Accountable for NAV because fund accounting is an operational function even though portfolio managers consult on fair value inputs.
- Technology provides support infrastructure across all steps but holds no business accountability for investment outcomes.

---

## Data Architecture

### Four-Tier Data Classification

| Classification | Examples | Access Controls |
|---|---|---|
| **PUBLIC** | Market data, published research, fund fact sheets, regulatory filings | No restrictions; accessible to all staff and external parties |
| **INTERNAL** | Internal research memos, strategy presentations, model portfolio targets, meeting minutes | AssetCo staff only; not for external distribution |
| **CONFIDENTIAL** | Client data, trade records, risk reports, P&L, personnel records | Need-to-know; role-based access; encrypted at rest and in transit |
| **RESTRICTED** | PII, protected characteristics, insider information, pre-publication research, deal pipeline data (Private Markets) | Strict access lists; information barrier enforcement; SOE-enforced dataAccess controls |

All AI application data access is governed by Sentinel-Ops SOE definitions. SOE `dataAccess.readDeny` patterns enforce classification boundaries at the tool-call level, preventing AI agents from reading data above their authorized tier.

### Data Flow Architecture

```
External Data Sources
  Bloomberg Terminal, Refinitiv Eikon, ICE Data, MSCI ESG,
  Sustainalytics, Moody's Analytics, Alternative Data Providers
                          |
                          v
              Data Lake — Snowflake (AWS us-east-1)
          [Classified ingestion, schema-on-read, row-level security]
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
    Research Models   Alpha Signals   Risk Analytics
    (ResearchNexus)  (AlphaEngine)   (RiskCompass)
          |               |               |
          v               v               v
    Published        Order Mgmt       Aladdin Risk
    Research         Bloomberg AIM    Platform
    (Internal)       (Confidential)   (Confidential)
                          |
                          v
              Execution — FlexTrade EMS
              [Best execution, TCA, venue selection]
                          |
                          v
              Settlement — Eagle PACE
              [Custodian instructions, T+1/T+2]
                          |
              +-----------+-----------+
              |                       |
              v                       v
      Position & Cash          Compliance Monitoring
      Reconciliation           (ComplianceShield)
      (OpsFabric)              [Surveillance, reporting]
              |
              v
      NAV & Valuation
      [Daily NAV, Level 2/3 fair value]
              |
              v
      Client Reporting
      (AdvisorLens)
      [Attribution, disclosures, dashboards]
```

---

## Information Barriers (Chinese Wall)

AssetCo maintains three primary information barriers enforced by policy, physical separation, and technical controls.

### Barrier 1: Research vs. Trading

Research analysts cannot view pending orders, trader positions, or order flow data. Trading desks cannot access pre-publication research, analyst conviction changes, or target price revisions prior to formal publication to the investment committee.

**Rationale:** Prevents front-running of research-driven trades and protects against insider trading liability under SEC Rule 10b-5 and FCA MAR.

**SOE Enforcement:** ResearchNexus SOE definition includes `dataAccess.readDeny: ["trading/orders/**", "trading/positions/**"]`. TradeSentinel SOE definition includes `dataAccess.readDeny: ["research/unpublished/**", "research/drafts/**"]`.

### Barrier 2: Private Markets vs. Public Markets

Private equity deal teams working on transactions in public companies cannot share material non-public information (MNPI) with public equity or credit analysts. Restricted list management is enforced by Compliance prior to any deal outreach.

**Rationale:** Prevents misuse of MNPI under US securities law and equivalent EU/UK market abuse regimes. AssetCo maintains a dynamic restricted list updated in real time as deal teams enter due diligence.

**SOE Enforcement:** Private Markets AI agents carry `dataAccess.readDeny: ["equities/**", "fixed-income/credit/**"]`. Public markets agents carry `dataAccess.readDeny: ["private-markets/deals/**", "private-markets/pipeline/**"]`.

### Barrier 3: Compliance Surveillance vs. All Business Lines

Compliance officers have read access to all trading activity, communications surveillance, and risk data for monitoring purposes. They cannot initiate trades, modify portfolios, or instruct operations. This ensures surveillance integrity without creating a conflict of interest.

**SOE Enforcement:** ComplianceShield carries a `toolActions` configuration that permits only `read` and `report` operations. All `write`, `edit`, and `bash` tool actions with side effects are denied. The SOE definition is marked immutable and requires human approval to modify.

---

## Cross-Application Data Dependencies

The seven AI applications are not independent — they form a directed data dependency graph. The following describes the key inter-application data flows:

| Source Application | Destination Application | Data Transferred | Classification |
|---|---|---|---|
| ResearchNexus (published only) | AlphaEngine | Structured alpha signals, conviction scores, ESG flags | Internal |
| AlphaEngine | TradeSentinel | Proposed trade lists, order sets, urgency tiers | Confidential |
| TradeSentinel | OpsFabric | Approved execution records, settlement instructions | Confidential |
| OpsFabric | RiskCompass | Settled position updates, cash movements | Confidential |
| RiskCompass | All (read) | Cross-fund exposure aggregates, VaR summaries | Confidential |
| ComplianceShield | All (read-only surveillance) | Pre-trade screens, post-trade alerts, violation flags | Confidential |
| AdvisorLens | Client Reporting | Performance attribution reports, disclosure drafts | Confidential / Public (post-release) |

**Critical dependency:** ResearchNexus outputs are gated by publication status. Unpublished research is classified **Restricted** and SOE `readDeny` rules prevent any downstream application from ingesting it until the Compliance team marks it published. This is the primary mechanism preventing AI-assisted front-running of proprietary research.

---

## Technology Stack Summary

| System | Vendor | Function | AI Applications Integrated |
|---|---|---|---|
| Bloomberg AIM | Bloomberg LP | Order Management System (OMS) — order staging, compliance pre-check, allocation | AlphaEngine, TradeSentinel, ComplianceShield |
| FlexTrade EMS | FlexTrade | Execution Management — smart order routing, algo selection, TCA | TradeSentinel |
| Aladdin | BlackRock Solutions | Risk analytics — VaR, scenario analysis, factor decomposition, liquidity | RiskCompass, ComplianceShield |
| Eagle PACE | SS&C Eagle | Fund accounting — NAV, position records, corporate actions, cash | OpsFabric, RiskCompass |
| Bloomberg Terminal | Bloomberg LP | Market data, news, research, pricing | ResearchNexus, AlphaEngine, RiskCompass |
| Refinitiv Eikon | LSEG | Supplemental market data, earnings estimates, M&A events | ResearchNexus, AlphaEngine |
| Tradeweb | Tradeweb Markets | Electronic fixed income trading — rates, government bonds | TradeSentinel (FI desk) |
| MarketAxess | MarketAxess | Electronic credit trading — IG/HY corporate bonds | TradeSentinel (FI desk) |
| Snowflake | Snowflake Inc. | Enterprise data lake — ingestion, transformation, analytics | All applications (read) |
| Burgiss | Burgiss Group | Private markets performance analytics — PME, TVPI, J-curve | AdvisorLens (PE reporting) |
| Intralinks | SS&C Intralinks | Secure deal collaboration — due diligence, LP portals | OpsFabric (Private Markets) |
| AWS (primary) | Amazon Web Services | Cloud infrastructure — ECS, S3, DynamoDB, Secrets Manager, WAF | All applications (hosting) |
| Azure (DR) | Microsoft Azure | Disaster recovery — geo-redundant failover | All applications (standby) |
| Sentinel-Ops | YadriWorks Inc. | SOE governance — pre-tool enforcement, audit trail, risk scoring | All applications (governance layer) |

---

## Operating Principles

**1. Human accountability is non-negotiable.** Every AI application operates in an advisory or augmentation capacity. Final authority for investment decisions, trade approval, and client communications rests with licensed human professionals.

**2. Data classification drives access control.** No AI application accesses data above its authorized classification. Sentinel-Ops SOE definitions encode these boundaries as machine-enforceable rules, not policy documents.

**3. Fail-closed by default.** If an AI application encounters an ambiguous data access request or a tool action outside its SOE, the action is blocked and escalated — it is never silently permitted. Availability is subordinated to safety.

**4. Audit trail is immutable.** Every AI action is logged to an append-only audit trail. No application — including the Sentinel-Ops governance layer — can modify or delete historical records.

**5. Information barriers are technical, not just policy.** Chinese wall enforcement is implemented at the SOE layer with cryptographically-scoped access controls, not reliant solely on staff training or honor systems.

---

*Next: [02-ai-applications.md](02-ai-applications.md) — detailed specification of the seven AI applications, their SOE definitions, and acceptance criteria.*
