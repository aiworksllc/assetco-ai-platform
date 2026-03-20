# RiskCompass — Regulatory Mapping

**Document:** apps/risk-compass/regulatory-mapping.md
**Application:** RiskCompass — Real-Time Risk Analytics
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** David Okonkwo, CCO / Sarah Nakamura, CRO
**Classification:** Internal — Restricted

---

## 1. Overview

RiskCompass operates at the intersection of five major regulatory frameworks: Basel III/IV (FRTB market risk capital), Dodd-Frank (systemic risk monitoring), AIFMD (alternative fund risk management and leverage limits), EU AI Act (HIGH RISK AI system obligations), and SR 11-7 (model risk management). Each regulation imposes specific requirements on how risk calculations are performed, validated, documented, and monitored — and each requirement is directly satisfied by specific SOE controls enforced by Sentinel-Ops.

This document provides a complete regulatory-to-SOE control mapping so that AssetCo's compliance team, external auditors, and regulators can trace every regulatory obligation to the specific technical control that satisfies it.

---

## 2. Basel III/IV — FRTB Market Risk Capital

### 2.1 Applicable Requirements

The Fundamental Review of the Trading Book (FRTB), finalized under Basel III and effective for AssetCo's registered entities from 2026, mandates specific standards for internal VaR models used in regulatory capital calculations.

| Requirement | Regulation Reference | RiskCompass Control |
|-------------|---------------------|---------------------|
| VaR model approval before use in capital calculations | BCBS 352, §183 | `var-calculator` model version registered in Model Inventory (MDL-VAR-001) before deployment; SR 11-7 independent validation required before approval |
| Expected Shortfall (ES) as primary metric (FRTB IMA) | BCBS 352, §181(c) | var-calculator computes ES at 97.5% confidence (FRTB IMA standard) in addition to 99% VaR; both metrics logged to Chronicle |
| Daily P&L backtesting with traffic light framework | BCBS 352, §183(g) | Daily backtesting logged to Chronicle; Green (0-4 annual exceptions), Yellow (5-9), Red (10+); Red status automatically escalated to CRO and Model Validation Committee |
| 10-day holding period for regulatory capital VaR | BCBS 352, §181(b) | var-calculator produces 10-day VaR = 1-day VaR × √10 for all trading book positions |
| 99% confidence interval for regulatory capital | BCBS 352, §181(a) | 99% VaR is the designated regulatory output; 95% VaR used for internal monitoring only |
| Firm-wide consolidated trading book risk | BCBS 352, §55-56 | exposure-monitor provides firm-level aggregation across all trading book positions for consolidated capital calculation |
| Large exposure limits (single counterparty ≤ 25% Tier 1 capital) | CRR2 Art.395 | exposure-monitor monitors counterparty exposure; limit-enforcer alerts at 80% of large exposure limit |
| Stress testing for FRTB Stressed VaR | BCBS 352, §181(h) | stress-tester runs historical stress scenarios using the 2008 GFC period as the primary FRTB stress period; stressed ES output to ComplianceShield |

### 2.2 SOE Controls Satisfying Basel III/IV

| SOE Mechanism | What It Enforces |
|---------------|-----------------|
| `var-calculator` model registration gate (SR 11-7 MDL-VAR-001) | Prevents unvalidated model from running against production positions; SOE blocks deployment if model version not in approved registry |
| Chronicle append-only log of every VaR calculation | Creates immutable backtesting evidence trail for supervisory review |
| `var-calculator` readAllow: `aladdin/var-model-inputs/**` | Ensures VaR uses Aladdin's approved factor model, not an unvalidated alternative data source |
| limit-enforcer → ComplianceShield breach event for VaR limit | Triggers regulatory capital recalculation workflow when VaR approaches approved internal limit |

---

## 3. Dodd-Frank Act — Systemic Risk Monitoring

### 3.1 Applicable Requirements

| Requirement | Regulation Reference | RiskCompass Control |
|-------------|---------------------|---------------------|
| Systemic risk contribution monitoring | Dodd-Frank Title I, §165 | exposure-monitor tracks firm-level concentration and counterparty exposure that contribute to systemic risk indicators |
| Form PF — Aggregate risk metrics for large hedge fund advisers | Dodd-Frank §404, SEC Rule 204(b)-1 | var-calculator daily output feeds ComplianceShield's Form PF data aggregation; limit-enforcer publishes quarterly risk summary to ComplianceShield |
| Swap dealer risk management requirements | Dodd-Frank Title VII, CFTC §23.600 | limit-enforcer monitors counterparty exposure on OTC derivatives; exposure-monitor aggregates CDS and derivative positions firm-wide; compliance events published to ComplianceShield |
| Liquidity stress testing for swap dealers | CFTC §23.600(c)(3) | stress-tester runs AIFMD-mandated liquidity stress tests that are also submitted for Dodd-Frank liquidity reporting |
| Orderly liquidation planning — liquidity modeling under stress | Dodd-Frank Title II | stress-tester's AIFMD liquidity stress output (days-to-liquidate at 10%/20%/30% redemption) satisfies Dodd-Frank liquidity modeling requirement for alternative strategies |

### 3.2 SOE Controls Satisfying Dodd-Frank

| SOE Mechanism | What It Enforces |
|---------------|-----------------|
| exposure-monitor readAllow: `bloomberg-aim/derivative-positions/**`, `bloomberg-aim/credit-default-swaps/**` | Explicit SOE authorization for derivative position reads, required for swap dealer monitoring |
| limit-enforcer → `compliance_shield.publish_breach_event` | Structured event feed to ComplianceShield for Form PF data collection; SOE toolAction explicitly allows this publication |
| stress-tester `snowflake.query_liquidity` allowed | SOE authorizes liquidity historical data access required for Dodd-Frank stress test scenarios |

---

## 4. AIFMD — Alternative Investment Fund Managers Directive

### 4.1 Applicable Requirements

AIFMD applies to AssetCo's Alternatives division ($14B AUM) and imposes the most detailed risk management requirements of any regulation applicable to RiskCompass.

| Requirement | AIFMD Reference | RiskCompass Control |
|-------------|----------------|---------------------|
| Functionally and hierarchically independent risk management system | Art.15(1) | RiskCompass is architecturally isolated from AlphaEngine and TradeSentinel; zero write access enforced by SOE prevents risk system from influencing trading decisions; independence is structural, not merely organizational |
| Risk management system must identify, measure, manage, monitor all relevant risks | Art.15(3)(a) | All four agents collectively cover: market risk (var-calculator), liquidity risk (stress-tester AIFMD), counterparty risk (exposure-monitor), concentration risk (exposure-monitor), leverage risk (limit-enforcer AIFMD leverage) |
| VaR and related risk measures computed and monitored at least monthly; daily for leveraged funds | Art.15(3)(b) | var-calculator runs hourly during market hours, satisfying "daily" for all alternative funds regardless of leverage; exceeds minimum requirement |
| Quarterly liquidity stress tests | Art.16(1) | stress-tester pre-configured AIFMD liquidity stress (10%/20%/30% redemption scenarios) runs quarterly; output logged to Chronicle for Annex IV submission |
| Leverage limits — gross method and commitment method | Art.15(4), Annex I | limit-enforcer monitors gross method (typically ≤300% NAV) and commitment method (typically ≤200% NAV) for each alternative fund; alerts at 90%, breach event at 100% |
| Leverage reporting to NCAs | Art.24(4) | limit-enforcer publishes AIFMD leverage metrics to ComplianceShield; ComplianceShield generates Annex IV report for NCA submission |
| Risk management policies reviewed at least annually | Art.15(5) | SOE definitions are version-controlled; annual review cycle enforced; changes require CRO + Model Risk Committee approval before SOE update |

### 4.2 AIFMD Art.15 Independence Evidence

A key regulatory question under AIFMD Art.15 is whether the risk management function is genuinely independent from portfolio management. The SOE architecture provides structural evidence:

- `var-calculator`, `stress-tester`, and `exposure-monitor` have no write access to AlphaEngine's model portfolio paths
- `limit-enforcer` cannot issue any instruction to AlphaEngine or TradeSentinel (SOE deny: `alphaengine.submit*`, `tradesentinel.*`)
- The SOE denies are enforced deterministically at the gate — they cannot be overridden by the agents at runtime
- Chronicle creates an immutable record of what each agent accessed and produced, providing an auditable independence demonstration

---

## 5. EU AI Act — HIGH RISK System Obligations

RiskCompass is classified HIGH RISK under EU AI Act Annex III, Category 5(b) (AI systems used in financial services that influence investment decisions or capital allocation). VaR outputs influence capital allocation decisions and regulatory capital requirements; limit breach alerts directly constrain trading activity. Full conformity assessment is required before deployment.

### 5.1 Article-by-Article Mapping

| EU AI Act Article | Requirement | RiskCompass Implementation |
|-------------------|-------------|---------------------------|
| **Art.9 — Risk Management System** | Continuous risk management system for HIGH RISK AI throughout lifecycle | Arbiter risk scoring runs asynchronously on every agent action; riskBudget enforcement prevents runaway computation; daily VaR backtesting provides ongoing performance monitoring of the AI model itself |
| **Art.10 — Data Governance** | Training/input data must be relevant, representative, and free from errors | SOE readAllow paths explicitly enumerate approved data sources (Aladdin, Bloomberg AIM, Snowflake); readDeny blocks unapproved/unvalidated data sources; data provenance for every calculation logged to Chronicle |
| **Art.11 — Technical Documentation** | Technical documentation before market placement; kept up to date | This document, agent-architecture.md, and soe-definitions.md constitute the technical documentation package; version-controlled in the same repo as the SOE definitions |
| **Art.12 — Record-Keeping** | Automatic logging throughout system lifetime | Chronicle logs every risk calculation, every limit check, every alert generated; append-only (even RiskCompass agents cannot modify Chronicle records); 7-year retention for regulatory calculations |
| **Art.13 — Transparency** | Sufficient information for users to interpret output | Every VaR output includes: model methodology, confidence level, holding period, data snapshot timestamp, model version (MDL-VAR-001), input data sources; logged to Chronicle and surfaced in risk dashboard |
| **Art.14 — Human Oversight** | Human oversight measures; ability to intervene and correct | limit-enforcer's alert-only design is the primary Art.14 control: humans receive every limit approach and breach notification; humans make all remediation decisions; SOE structurally prevents AI from taking autonomous corrective action |
| **Art.15 — Accuracy and Robustness** | Performance metrics; resilience against manipulation | Daily VaR backtesting (Art.15 accuracy monitoring); inputs are from authenticated, SOE-gated data sources (robustness against data feed manipulation); model version registry prevents degraded model deployment |
| **Art.17 — Quality Management** | Quality management system | Mapped to AssetCo Model Governance Framework (MGF); annual SR 11-7 model validation serves as AI Act Art.17 QMS review |
| **Art.72 — Serious Incident Reporting** | Report serious incidents within 15 days | Beacon anomaly detection feeds incident classification workflow; Chronicle provides the incident evidence package; ComplianceShield generates the EU AI Act Art.72 notification to the relevant NCA |

### 5.2 Conformity Assessment Status

| Requirement | Status | Evidence |
|-------------|--------|---------|
| Technical documentation complete | Complete | This document set (product-spec.md, agent-architecture.md, soe-definitions.md, regulatory-mapping.md, risk-audit-models.md) |
| EU AI Act Art.9 risk management | Implemented | Arbiter risk scoring + riskBudget enforcement |
| EU AI Act Art.12 record-keeping | Implemented | Chronicle append-only audit trail, 7-year retention |
| Independent validation (SR 11-7 / Art.9) | Required before production | Model Risk Committee validation of MDL-VAR-001 and MDL-STRESS-001 |
| Human oversight (Art.14) | Implemented | limit-enforcer alert-only architecture; no autonomous remediation |

---

## 6. SR 11-7 — Model Risk Management

SR 11-7 (OCC/Federal Reserve supervisory guidance on model risk management) applies to var-calculator and stress-tester as quantitative models used in material business and regulatory capital decisions.

| SR 11-7 Requirement | Model | RiskCompass Control |
|--------------------|-------|---------------------|
| Model Inventory registration before use | MDL-VAR-001 (var-calculator), MDL-STRESS-001 (stress-tester) | SOE identity block includes `srr117ModelId` field; deployment blocked if model ID not in ComplianceShield's approved model registry |
| Independent validation before deployment | MDL-VAR-001, MDL-STRESS-001 | Model Risk Committee validation required; validation report stored in ComplianceShield; SOE deployment approval requires validation sign-off |
| Ongoing monitoring — performance and backtesting | MDL-VAR-001 | Daily VaR backtesting results logged to Chronicle; traffic light report generated weekly; Yellow status triggers Model Validation Committee review within 30 days |
| Challenger model / benchmarking | MDL-VAR-001 | Parametric VaR serves as challenger to Historical Simulation; both computed daily; material divergence (>20%) triggers model validation review |
| Model documentation | Both models | Conceptual soundness, methodology, data, assumptions, limitations documented in model validation report (stored in ComplianceShield) |
| Model change management | Both models | SOE version field (`"version": "1.0.0"`) changes with any model update; new version requires re-validation before production deployment |

---

## 7. Summary Control Matrix

| Regulation | Article/Section | Specific Requirement | SOE Control | Agent |
|------------|----------------|---------------------|-------------|-------|
| Basel III FRTB | BCBS 352 §183 | Model approval | Model registry gate | var-calculator |
| Basel III FRTB | BCBS 352 §183(g) | Daily backtesting | Chronicle immutable log | var-calculator |
| Basel III FRTB | BCBS 352 §181(b) | 10-day holding period | Hardcoded in computation | var-calculator |
| Basel III FRTB | CRR2 Art.395 | Large exposure limits | Limit monitoring at 80% alert | exposure-monitor |
| Dodd-Frank | Title VII §23.600 | Swap dealer risk monitoring | Derivative position reads + limit alerts | exposure-monitor, limit-enforcer |
| Dodd-Frank | §404 Rule 204(b)-1 | Form PF data | Breach event feed to ComplianceShield | limit-enforcer |
| AIFMD | Art.15(1) | Risk management independence | Zero write to trading systems (SOE structural) | All 4 agents |
| AIFMD | Art.15(3)(b) | VaR computed daily | Hourly scheduled runs | var-calculator |
| AIFMD | Art.16(1) | Quarterly liquidity stress | Pre-configured AIFMD scenario | stress-tester |
| AIFMD | Art.15(4) | Leverage monitoring | Gross + commitment method limits | limit-enforcer |
| AIFMD | Art.24(4) | Leverage reporting to NCAs | ComplianceShield event feed | limit-enforcer |
| EU AI Act | Art.9 | Risk management system | Arbiter + riskBudget + backtesting | All 4 agents |
| EU AI Act | Art.10 | Data governance | SOE readAllow/readDeny explicit paths | All 4 agents |
| EU AI Act | Art.12 | Record-keeping | Chronicle 7-year retention | All 4 agents |
| EU AI Act | Art.14 | Human oversight | Alert-only limit-enforcer | limit-enforcer |
| EU AI Act | Art.15 | Accuracy/robustness | Daily backtesting + model registry | var-calculator |
| EU AI Act | Art.72 | Serious incident reporting | Beacon + Chronicle + ComplianceShield | Platform-level |
| SR 11-7 | Full guidance | Model risk management | Model registry + validation gate | var-calculator, stress-tester |

---

*Document owner: David Okonkwo, CCO. Review cycle: Quarterly or on regulatory change. This mapping should be presented to regulators during examination preparation.*
