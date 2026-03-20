# RiskCompass — Product Specification

**Document:** apps/risk-compass/product-spec.md
**Application:** RiskCompass — Real-Time Risk Analytics
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** Sarah Nakamura, Chief Risk Officer
**Classification:** Internal — Restricted

---

## 1. Executive Summary

RiskCompass is AssetCo's real-time risk analytics platform, providing continuous Value-at-Risk (VaR) computation, stress testing, exposure monitoring, and limit enforcement across all $85 billion in assets under management. It is the first AI application deployed in the AssetCo AI Platform rollout (Phase 1) because its architecture is analytically read-only — it computes, monitors, and alerts, but never executes. No position is modified, no trade is placed, and no order is generated as a result of any RiskCompass agent action.

RiskCompass replaces an overnight batch risk model sourced from BlackRock Aladdin with a continuous, intraday view that enables the risk function to respond to limit approaches before they become limit breaches, and to quantify the portfolio impact of market shocks in real time rather than the following morning.

---

## 2. Business Context

### 2.1 AssetCo's Risk Function

AssetCo manages $85B across five business lines: Global Equities ($32B), Fixed Income ($24B), Alternatives ($14B), Multi-Asset Solutions ($11B), and Private Markets ($4B). The risk function — led by CRO Sarah Nakamura — is responsible for:

- Monitoring aggregate firm-level and fund-level market risk exposure against pre-approved risk budgets
- Enforcing regulatory capital limits under Basel III/IV for the firm's registered entities
- Reporting leverage and risk metrics to regulators under AIFMD (Art.15-16), Dodd-Frank (Form PF), and AIFMD Annex IV
- Running liquidity stress tests quarterly as required under AIFMD
- Maintaining independence from portfolio management functions — the risk team does not optimize or execute; it monitors and constrains

### 2.2 Why Real-Time Matters

Prior to RiskCompass, AssetCo's primary risk model ran overnight in Aladdin. Risk managers received end-of-day VaR reports by 7:30 AM each morning. This was adequate for long-only equity and investment-grade fixed income, which move within predictable daily ranges.

The Alternatives division — launched in 2012 under Dr. Elena Voss — introduced long/short equity, global macro, and relative value strategies that exhibit intraday exposure profiles dramatically different from end-of-day snapshots. A 2023 internal review found that the overnight model missed two intraday limit approaches that resolved before close — but would have constituted reportable limit breaches had they persisted. Under AIFMD Art.15 and Basel III FRTB, "it resolved by close" is not a valid defense if the breach occurred intraday.

The introduction of T+1 settlement in the US (May 2024) further compressed the risk management window. Risk calculations that previously could wait for overnight processing must now be available within the same trading day.

**RiskCompass closes this gap** by running VaR calculations on a rolling hourly schedule intraday, with on-demand recalculation capability triggered by market events or portfolio manager request.

---

## 3. Problem Statement

| Problem | Impact | Regulation |
|---------|--------|-----------|
| Overnight-only VaR misses intraday limit approaches | Potential unreported limit breaches under AIFMD Art.15 | AIFMD Art.15(3)(b) |
| No real-time cross-fund single-name exposure aggregation | Firm-level concentration risk invisible during market hours | Basel III large exposure rules |
| Manual stress test execution (2-3 day cycle) | Unable to respond to live market shocks (e.g., rate decision, credit event) | AIFMD Art.16, FRTB IMA |
| Limit breach notification via email — 20-30 min lag | Risk managers learn of breaches after further damage | Internal risk policy |
| Siloed risk views per fund — no firm-level aggregation | Cannot see combined single-name exposure across Equities + Alternatives | FRTB consolidated reporting |

---

## 4. Solution: The Four-Agent System

RiskCompass deploys four specialized agents that divide risk analytics responsibilities without creating circular dependencies:

```
Bloomberg AIM (positions) ─────────────┐
Aladdin (risk factors, benchmarks) ────┤
Snowflake (historical data) ────────────┤──► var-calculator ──► VaR reports + alerts
AlphaEngine positions ──────────────────┤
TradeSentinel executed trades ──────────┤──► stress-tester ──► stress P&L by fund
OpsFabric settled positions ────────────┘
                                          ──► exposure-monitor ──► concentration alerts
                                          ──► limit-enforcer ──► breach notifications
                                                    │
                                          ComplianceShield (limit breach events)
                                          Human risk managers (escalation)
```

No agent in this flow writes back to any source system. The arrows are read-only data flows and alerting outputs.

---

## 5. User Stories — CRO Perspective (Sarah Nakamura)

**US-01 — Intraday VaR Visibility**
As CRO, I want to see updated VaR figures for every fund and at the firm level at least hourly during market hours, so that I am never more than one hour behind the true risk position.

*Acceptance:* VaR recalculated on hourly schedule during NYSE market hours (9:30 AM – 4:00 PM ET). On-demand recalculation available within 5 minutes of request. VaR reports accessible in risk dashboard.

**US-02 — Stress Test on Demand**
As CRO, I want to run a stress scenario against the current live portfolio within 10 minutes of a market shock, so that I can assess impact and communicate to portfolio managers before the shock propagates.

*Acceptance:* Pre-configured scenarios (GFC 2008 replay, rate shock +300bps, credit spread widening 200bps, EM currency crisis) executable on-demand. Custom scenario parameter entry supported. Output: fund-level and firm-level stress P&L within 10 minutes.

**US-03 — Firm-Level Single-Name Exposure**
As CRO, I want to see the firm's total exposure to any single issuer aggregated across all funds and strategies — including both long and short positions — so that I can identify hidden concentration risk.

*Acceptance:* exposure-monitor aggregates cross-fund positions for any issuer query. Drift alert generated when any issuer reaches 80% of the firm-wide single-name limit.

**US-04 — Limit Breach Notification Within 2 Minutes**
As CRO, I want to receive an automated alert within 2 minutes of any fund breaching a pre-set risk limit, with context including which limit, by how much, and the contributing positions.

*Acceptance:* limit-enforcer checks limit compliance every 5 minutes. Breach notification delivered via Slack (#risk-alerts channel) and email within 2 minutes of detection. Notification includes limit name, threshold, current value, breach magnitude, and top-5 contributing positions.

**US-05 — Pre-Trade Risk Assessment**
As a portfolio manager, I want to query RiskCompass for the expected VaR impact of a proposed trade before execution, so that I can avoid placing orders that would breach limits.

*Acceptance:* var-calculator accepts on-demand "what-if" VaR calculation with a proposed position delta. Returns incremental VaR and updated firm/fund VaR with the hypothetical position. Response within 5 minutes.

**US-06 — Regulatory Limit Monitoring (AIFMD Leverage)**
As CRO, I want the system to continuously monitor leverage ratios under both the gross method and commitment method as required by AIFMD, alerting me when either calculation approaches 90% of the regulatory limit.

*Acceptance:* limit-enforcer monitors AIFMD gross method and commitment method leverage for all alternative funds. Alert at 90% of regulatory limit. Breach event logged to ComplianceShield for AIFMD Annex IV reporting.

---

## 6. Functional Requirements Per Agent

### 6.1 var-calculator

| Requirement | Detail |
|-------------|--------|
| VaR methodologies | Parametric (variance-covariance), Historical Simulation (1 year / 2 year lookback), Monte Carlo (10,000 scenarios minimum) |
| Scope | Fund level, strategy level, firm level; long, short, net |
| Scheduled runs | Hourly during market hours (9:30–16:00 ET); daily EOD run at 16:30 ET |
| On-demand runs | Within 5 minutes of request; supports "what-if" delta analysis |
| Confidence intervals | 95% (internal monitoring), 99% (regulatory Basel III), 99.9% (stress override) |
| Holding period | 1-day (internal), 10-day (Basel III regulatory capital) |
| Output destinations | Risk dashboard, Chronicle audit trail, alert queue (if approaching limit) |
| Data reads | All fund positions (Bloomberg AIM), risk factors (Aladdin), historical returns (Snowflake), benchmark data |
| Backtesting | Daily P&L backtesting against prior-day VaR prediction; results logged for Basel III model validation |

### 6.2 stress-tester

| Requirement | Detail |
|-------------|--------|
| Pre-configured scenarios | 2008 GFC replay (peak drawdown, Sep–Nov 2008); 2020 COVID crash (Feb–Mar 2020); Rate shock +300bps parallel; Rate shock -200bps parallel; Credit spread widening +200bps (IG), +500bps (HY); EM currency crisis (-20% EM FX basket); Equity market shock -30% global equities |
| Custom scenarios | Parameter entry: equity shock %, rate shift bps, credit spread bps, FX shock %, commodity shock % |
| Output | Stress P&L by fund, by strategy, firm total; top-10 P&L contributors and detractors; liquidity impact estimate |
| AIFMD liquidity stress | Quarterly liquidity stress test: 10% / 20% / 30% redemption scenarios; days-to-liquidate output |
| Response time | Pre-configured scenarios: < 10 minutes; custom scenarios: < 15 minutes |
| Data reads | Current positions (all funds), macro factor sensitivities (Aladdin), historical scenario factor paths (Snowflake) |
| Deny | Pre-publication research; trade order data; client-identifiable data |

### 6.3 exposure-monitor

| Requirement | Detail |
|-------------|--------|
| Monitoring frequency | Continuous (5-minute polling of position updates) |
| Exposure dimensions | Single-name issuer (cross-fund aggregated), sector (GICS), geography (country, region), factor (beta, duration, credit quality, FX), counterparty (prime broker, clearing house) |
| Cross-fund aggregation | Identifies firm-level exposure by aggregating equivalent positions across Equities, Fixed Income, Alternatives, Multi-Asset — including offsetting long/short positions in the same issuer |
| Concentration drift alert | Alert when any dimension reaches 80% of limit (early warning); second alert at 95% |
| Data reads | Broadest read scope of any agent in the firm: all 5 business line positions, all 5 trading applications, all asset classes |
| Output | Exposure dashboard (live), drift alerts to risk managers, limit-enforcer feed |

### 6.4 limit-enforcer

| Requirement | Detail |
|-------------|--------|
| Limit types | VaR limits (fund level, firm level); concentration limits (single-name, sector, geography); leverage ratios (AIFMD gross, AIFMD commitment, internal); tracking error bands (for benchmark-relative mandates); counterparty credit exposure limits |
| Monitoring frequency | Every 5 minutes during market hours; at market open and close |
| Breach action | Generate structured breach event; notify risk manager (Slack + email); log to Chronicle; flag to ComplianceShield; NO direct trading action |
| Near-breach action | Alert at 90% of limit (near-breach warning); 95% escalation to CRO |
| Human authority | Limit-enforcer CANNOT halt trading, cancel orders, modify positions, or instruct any trading system; all remediation authority rests with human risk managers |
| Escalation path | 90% threshold: risk manager notification; 100% threshold (breach): CRO + risk manager + ComplianceShield; persistent breach >30 min: CEO notification |
| Data reads | Risk limits configuration, current exposure metrics from exposure-monitor, VaR outputs from var-calculator |

---

## 7. Non-Functional Requirements

| Requirement | Target | Notes |
|-------------|--------|-------|
| VaR recalculation latency | < 5 minutes (on-demand), hourly (scheduled) | P95 latency target |
| Availability during market hours | 99.9% | 9:30–16:30 ET, Mon–Fri |
| Cross-fund aggregation completeness | 100% of positions included within 5 minutes of position update | No sampling or approximation in exposure aggregation |
| Audit trail completeness | 100% of risk calculations logged to Chronicle | No silent calculations |
| Limit breach notification latency | < 2 minutes from detection to delivery | Measured end-to-end |
| Data freshness | Position data no older than 5 minutes during market hours | Stale data threshold |
| Backtesting | Daily VaR backtesting; exceptions reported per Basel III traffic light framework | Automatic |

---

## 8. Integration Points

| System | Direction | Data | Protocol |
|--------|-----------|------|---------|
| Bloomberg AIM | Read | Current positions, trade blotter, sector/geography classifications | Bloomberg API (read-only key) |
| BlackRock Aladdin | Read | Risk factors, factor loadings, benchmark data, VaR risk model inputs | Aladdin REST API (read-only) |
| Snowflake (data warehouse) | Read | Historical returns (10 years), historical scenarios, backtesting data | Snowflake JDBC (read-only role) |
| AlphaEngine | Read | Model portfolio positions pre-execution | Internal API (read-only) |
| TradeSentinel | Read | Live executed trade blotter | Internal API (read-only) |
| OpsFabric | Read | Settled position records | Internal API (read-only) |
| ComplianceShield | Write (alerts only) | Limit breach events, leverage ratios for AIFMD reporting | Event queue (write to event topic only — not to ComplianceShield data store directly) |
| Risk Dashboard | Write | VaR reports, exposure visualizations, stress test results | Dashboard write API |
| Chronicle (Sentinel-Ops) | Write | All risk calculations, alerts, agent decisions | SOE audit hook (automatic) |

---

*Document owner: Sarah Nakamura, CRO. Review cycle: Quarterly or on material change to risk methodology.*
