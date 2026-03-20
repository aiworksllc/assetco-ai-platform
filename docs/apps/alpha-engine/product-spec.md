# AlphaEngine — Product Specification

**Application:** AlphaEngine
**Domain:** Portfolio Optimization
**Document:** apps/alpha-engine/product-spec.md
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** Thomas Reeves (CIO, Equities), Anna Belova (CIO, Fixed Income)
**EU AI Act Classification:** HIGH RISK — Annex III, Category 5b
**Audience:** CIO, CTO, CCO, Head of Quant Research, Model Risk

---

## 1. Business Context

AssetCo manages $85 billion in client assets across five business lines: Equities ($28B), Fixed Income ($22B), Alternatives ($15B), Multi-Asset Solutions ($12B), and Private Markets ($8B). Portfolio construction and rebalancing decisions are made across more than 200 active mandates, each with its own Investment Policy Statement (IPS), benchmark, concentration limits, ESG requirements, and regulatory overlay.

The portfolio management function operates under strict fiduciary obligations. As a registered investment adviser under the SEC Advisers Act, AssetCo owes clients the best-interest standard — the highest duty in US financial law. For pension mandates governed by ERISA, the prudent expert standard applies. For EU-distributed funds, MiFID II suitability obligations and SFDR sustainability disclosure requirements constrain product construction. Across all jurisdictions, every allocation decision must be defensible as appropriate given the client's mandate, risk profile, and current market conditions.

The scale of this mandate — 200+ individual investment strategies across four jurisdictions, with daily rebalancing triggers, factor constraints, ESG tilts, and real-time risk limit feeds — has outpaced the capacity of manual portfolio construction processes.

---

## 2. Problem Statement

Manual portfolio construction at AssetCo scale suffers from five compounding limitations:

**Capacity constraint.** Portfolio managers cannot simultaneously monitor drift across 200+ mandates, re-optimize against factor constraints, apply ESG tilts, and validate against IPS limits in real time. In practice, rebalancing happens in batches, meaning portfolios operate off-target for extended periods.

**IPS constraint enforcement.** Each mandate has a unique IPS defining concentration limits (per-issuer, per-sector, per-country), tracking error bounds, liquidity requirements, and permitted asset classes. Manual cross-checking against these constraints is error-prone and time-consuming.

**ESG mandate complexity.** AssetCo manages Article 8 and Article 9 SFDR-classified funds requiring ESG minimum score thresholds, principal adverse impact (PAI) metric monitoring, and EU Taxonomy alignment screening. Manual application of ESG constraints across portfolio construction is inconsistent across portfolio managers.

**Factor exposure drift.** Portfolios accumulate unintended factor tilts over time as security weights drift and market conditions evolve. Without continuous factor attribution, managers discover unintended exposures only at periodic review, often after they have already impacted performance.

**Audit trail gaps.** When regulators or clients ask why a particular allocation was made, or why a rebalancing was triggered, manual processes produce inconsistent documentation. SEC Rule 204-2 requires 7-year retention of all investment decision records — a standard that ad-hoc documentation cannot reliably meet.

---

## 3. Solution: AlphaEngine

AlphaEngine is a 4-agent AI system that automates portfolio construction, rebalancing, and factor analysis within a Sentinel-Ops Safe Operating Envelope. The SOE enforces fiduciary constraints deterministically — the agents cannot output allocations that violate IPS limits, and every optimization decision is logged immutably to the Chronicle audit trail.

AlphaEngine does not replace portfolio managers. It handles the computational mechanics of optimization, drift monitoring, and factor attribution so that managers can focus on strategy, client relationships, and the judgment calls that require human discretion. All material allocation proposals from the allocation-advisor agent require explicit human approval before downstream action.

**Core capabilities:**
- Mean-variance optimization and risk-parity portfolio construction across equity and fixed income mandates
- Factor-based portfolio construction targeting value, momentum, quality, size, and low-volatility exposures
- ESG tilt application with SFDR Article 8/9 constraint enforcement and PAI monitoring
- Continuous portfolio drift monitoring with configurable rebalancing thresholds
- Delta trade list generation (buy/sell lists) output to TradeSentinel for execution
- Cross-asset-class allocation proposals for Multi-Asset Solutions mandates (human approval required)
- Immutable, explainable audit trail for every optimization decision with factor contributions and binding constraints

---

## 4. User Stories

### Thomas Reeves — CIO, Equities ($28B AUM)

> "I run 47 separate equity mandates. Each one has different sector concentration limits, tracking error budgets, and — increasingly — ESG requirements from the client's IPS. My team manually reviews rebalancing triggers once a week. By the time we act, some portfolios are 4–5% off target weight. I need a system that watches every mandate continuously and generates a clean delta trade list the moment drift exceeds threshold, already validated against the IPS so my traders don't have to second-guess the compliance check."

**AlphaEngine response:** The `rebalancer` agent monitors all equity mandates against target weights continuously. When drift crosses the configured threshold (default: 2% from target weight), it generates a delta trade list that has already been validated against the mandate's IPS constraints by the `portfolio-optimizer`. The trade list is passed to TradeSentinel ready for execution. Thomas's team reviews and approves the trigger; the computation has already been done.

> "My quant team spends significant time computing factor exposures on the portfolio to check that our value tilt hasn't accidentally drifted toward momentum or small-cap. I want to see factor attribution on demand, and I want the optimizer to know what our target factor profile is so it can correct drift in factor space, not just weight space."

**AlphaEngine response:** The `factor-analyst` agent computes factor exposures continuously and feeds them to the `portfolio-optimizer`. The optimizer operates with explicit factor constraints from the IPS, correcting not just weight drift but factor drift. Thomas can query current factor attribution at any time.

---

### Anna Belova — CIO, Fixed Income ($22B AUM)

> "Fixed income is harder than equity from a mandate perspective. I have insurance general account clients with Solvency II asset eligibility constraints, pension clients with duration-matching requirements, and short-duration mandates with strict credit quality floors. The ERISA mandates require me to document that every rebalancing decision was made pursuant to the IPS and in the plan's best interest. I can't do that with a spreadsheet and a weekly review."

**AlphaEngine response:** The `portfolio-optimizer` ingests mandate-specific IPS documents and enforces constraints as hard boundaries in the optimization — duration targets, credit quality floors, sector limits, and asset class eligibility screens are enforced in the SOE definition, not as soft guidelines. The Chronicle audit trail generates a structured log for every rebalancing event including the IPS constraints active at the time of the decision, creating the documentation that ERISA examiners expect.

> "I'm also under pressure from clients on SFDR. Two of my IG credit funds are classified Article 8. I need to be sure that when the optimizer suggests a new corporate bond position, it has already screened for PAI metrics and ESG minimum scores before it hits my desk."

**AlphaEngine response:** The `portfolio-optimizer` reads ESG scores from the ResearchNexus published signals feed and enforces SFDR Article 8/9 minimum thresholds as hard constraints in the optimization. Positions that would breach PAI thresholds are excluded before the allocation is proposed. ESG constraint compliance is logged in the audit trail per allocation.

---

## 5. Functional Requirements

### 5.1 Portfolio Optimization

| Requirement | Detail |
|---|---|
| Mean-variance optimization | Markowitz efficient frontier computation with configurable risk aversion parameter per mandate |
| Risk-parity construction | Equal risk contribution weighting mode for mandates where specified |
| Factor-targeted optimization | Objective function supports explicit factor exposure targets (value, momentum, quality, size, low-vol) |
| Hard IPS constraint enforcement | Per-mandate constraints: max single-name weight, max sector weight, max country weight, tracking error bounds, duration target (fixed income), credit quality floor |
| ESG constraint enforcement | SFDR Art.8/9 minimum ESG score thresholds, PAI exclusion screening, EU Taxonomy alignment floor |
| Transaction cost awareness | Optimizer minimizes turnover subject to a configurable transaction cost budget; does not generate unnecessary trades |

### 5.2 Rebalancing

| Requirement | Detail |
|---|---|
| Continuous drift monitoring | Monitors portfolio weight vs. target weight; configurable drift threshold per mandate (default 2%) |
| Rebalancing trigger detection | Triggers delta trade list generation when drift threshold breached |
| Tax lot awareness | Rebalancing considers tax lot selection (FIFO, LIFO, specific identification) where applicable |
| Transaction cost estimate input | Reads transaction cost estimates from market data feed; incorporates in delta trade list sizing |
| Trade list output | Delta trade list formatted for TradeSentinel ingestion; includes ISIN, direction, quantity, account reference |

### 5.3 Allocation Advisory (Multi-Asset)

| Requirement | Detail |
|---|---|
| Cross-asset-class allocation proposals | Macro regime-based allocation recommendations across equity, fixed income, alternatives, cash |
| Client risk profile matching | Allocation proposals constrained by client risk score, investment horizon, and IPS asset class limits |
| ERISA fiduciary documentation | For pension mandates: proposals include IPS reference, rationale, and prudent expert standard documentation |
| Human approval gate | ALL allocation proposals require explicit human approval before downstream action; system cannot self-execute |

### 5.4 Factor Analysis

| Requirement | Detail |
|---|---|
| Factor exposure computation | Barra-compatible 5-factor model: value, momentum, quality, size, low-volatility |
| Benchmark-relative attribution | Factor contributions to active return vs. benchmark |
| Unintended tilt detection | Flags factor exposures that deviate materially from mandate's target factor profile |
| Optimizer feed | Factor exposure outputs fed to portfolio-optimizer as factor constraint inputs |

---

## 6. Integration Architecture

| Integration | Direction | Data | Constraint |
|---|---|---|---|
| ResearchNexus | AlphaEngine reads | Published alpha signals, ESG scores, factor data | Published directory only — pre-publication paths denied by SOE |
| RiskCompass | RiskCompass reads AlphaEngine | Proposed allocations, model portfolios | Read-only by RiskCompass; AlphaEngine does not query RiskCompass at optimization time |
| TradeSentinel | AlphaEngine writes | Delta trade lists | Write access to `trading/trade-lists/**` only; no execution authority |
| IPS Document Store | AlphaEngine reads | Investment Policy Statements, mandate constraints | Read-only; SOE denies any write to mandate documents |

---

## 7. EU AI Act Obligations

AlphaEngine is classified **HIGH RISK** under EU AI Act Annex III, Category 5b (Financial Services — systems making or assisting in allocation decisions affecting access to financial resources). This classification triggers the following obligations before production deployment in the EU:

- **Art.9 Risk management system:** Documented risk management framework identifying, analyzing, and mitigating foreseeable risks in portfolio optimization outputs
- **Art.10 Data governance:** Training and validation data documentation; bias testing for factor models
- **Art.13 Transparency:** Explainable optimization output required — factor contributions, binding constraints, and objective function parameters logged per allocation
- **Art.14 Human oversight:** Human approval gate for all material allocation proposals; cannot be bypassed
- **Art.15 Accuracy, robustness, cybersecurity:** Model performance monitoring (backtesting, stress testing); SR 11-7 model validation

Full conformity assessment must be completed before AlphaEngine processes live client capital in EU-regulated mandates.

---

*Document maintained by the AssetCo AI Platform team. AlphaEngine is a component of the AssetCo AI Platform governed by Sentinel-Ops SOE enforcement.*
