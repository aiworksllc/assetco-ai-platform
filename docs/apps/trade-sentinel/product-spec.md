# TradeSentinel — Product Specification

**Application:** TradeSentinel
**Domain:** Trade Execution
**Document:** product-spec.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** Head of Trading, CTO, CCO, Compliance Technology
**EU AI Act Classification:** HIGH RISK — Annex III, Category 5(b)

---

## 1. Business Context

AssetCo manages $85B in assets across equities, fixed income, multi-asset, and alternative strategies for institutional clients, pension funds, and sophisticated retail investors. At typical portfolio turnover rates for an active manager of this scale, AssetCo generates in excess of **$15B in annual trading volume** across 4 regulatory jurisdictions (US, EU, UK, Singapore) and 20+ execution venues spanning lit exchanges, dark pools, and alternative trading systems.

Execution quality is not an operational concern — it is an alpha concern. At $15B annual volume, a 1 basis point improvement in execution quality translates to **$1.5M of additional net return per year, directly attributable to clients**. Best execution failure, by contrast, exposes AssetCo to client harm, regulatory liability under MiFID II Article 27, and reputational risk with fiduciary counterparties.

The current execution infrastructure relies on FlexTrade EMS and Bloomberg AIM (OMS) with manual venue selection decisions by the trading desk. This approach has three fundamental scaling problems:

1. **Complexity**: Routing intelligently across 20+ venues in real time, factoring in liquidity, spread, fee schedules, dark pool availability, and market impact, exceeds what a manual workflow can optimise consistently.
2. **Documentation burden**: MiFID II Article 27 and RTS 28 require that every order carry a documented venue selection rationale and that AssetCo publish quarterly and annual best execution reports covering the top 5 execution venues per asset class. Generating this documentation manually is error-prone and labour-intensive.
3. **Anomaly detection latency**: Manual monitoring of open orders against VWAP and arrival price benchmarks cannot operate in real time across dozens of simultaneous orders. Slippage and potential market abuse indicators are identified after the fact, if at all.

---

## 2. Problem Statement

| Problem | Business Impact | Regulatory Impact |
|---|---|---|
| Manual venue selection cannot optimise across 20+ venues in real time | Sub-optimal fills; estimated 2-3bp annual execution drag | MiFID II Art.27 — failure to take "all sufficient steps" for best execution |
| Best execution rationale not documented per-order | Documentation effort consuming 2 FTE on trading desk | MiFID II Art.27(6) — must demonstrate best execution on request; RTS 28 quarterly publication required |
| Execution anomaly detection is post-trade and manual | Slippage identified after material losses; potential market abuse undetected | MAR Art.12 — wash trading and spoofing liability; STR filing obligation under MAR Art.16 |
| No systematic NBBO validation before order submission | Potential Rule 611 trade-throughs at peak volume | Reg NMS Rule 611 — order protection rule violation risk |
| Chinese wall relies on desk convention, not technical enforcement | Pre-publication research access not technically restricted | Reg FD and MAR Art.10 — front-running liability on MNPI if convention fails |

---

## 3. Solution Overview

TradeSentinel is a 3-agent AI execution system that operates within the Sentinel-Ops Safe Operating Envelope. It automates intelligent order routing, real-time execution quality monitoring, and post-trade transaction cost analysis — while generating the full MiFID II audit trail required for regulatory compliance.

**The 3-agent architecture enforces strict separation of duties by design:**

- `order-router` makes and documents venue selection decisions; it is the only agent with write access to the order staging directory
- `execution-monitor` monitors open orders in real time and raises alerts; it cannot modify orders
- `tca-analyzer` operates post-trade and is strictly read-only; it cannot influence any live order under any condition

This separation is enforced by the SOE, not by convention. The tca-analyzer's SOE definition contains a complete deny on all write and execute tool actions. If it attempts to modify an order — whether due to a model hallucination, prompt injection, or software error — the Sentinel-Ops gate blocks the action and logs a separation-of-duties violation.

---

## 4. User Stories

### Head of Trading

> As Head of Trading, I want every order submitted through FlexTrade to carry a documented venue selection rationale so that when the FCA or ESMA requests best execution evidence, I can produce it within hours rather than weeks.

> As Head of Trading, I want the system to automatically detect when our VWAP execution is deteriorating versus benchmark so I can investigate potential information leakage or counterparty gaming before the end of the trading day.

> As Head of Trading, I want TradeSentinel to flag orders showing potential spoofing or wash trading patterns in real time so that I can escalate to compliance immediately, not after the quarterly surveillance review.

### Compliance Officer

> As Compliance Officer, I want MiFID II RTS 28 quarterly reports generated automatically with venue-level fill quality metrics so that I can publish them on schedule without a manual data extraction exercise.

> As Compliance Officer, I want a technical guarantee that TradeSentinel agents cannot read pre-publication research from ResearchNexus, so that I can demonstrate to regulators that the chinese wall is enforced at the system level, not just by policy.

> As Compliance Officer, I want every STR-triggering pattern detected by the execution monitor to automatically create a draft suspicious transaction report for my review, so that the 4-hour reporting window under MAR Art.16 is achievable.

### Portfolio Manager

> As Portfolio Manager, I want to know that my trade lists are being executed with measurable best execution quality, and that implementation shortfall is being tracked against the IS benchmark, so I can evaluate whether execution is a meaningful drag on my alpha generation.

### Chief Risk Officer

> As CRO, I want orders above a defined notional threshold to require trader review before execution, and I want that gate enforced by the SOE, not by a process checklist, so that the EU AI Act Art.14 human oversight obligation is technically demonstrated.

---

## 5. Functional Requirements

### 5.1 Order Routing

| ID | Requirement |
|---|---|
| FR-01 | Receive trade lists from AlphaEngine via Bloomberg AIM OMS in FIX 4.2/4.4 format |
| FR-02 | Evaluate candidate execution venues: NYSE, NASDAQ, BATS, Chi-X Europe, Turquoise, Cboe Europe, and configured dark pools and ATS |
| FR-03 | Apply smart order routing logic scoring each venue on: available liquidity, bid-ask spread, market impact estimate, fee schedule, historical fill rate, and settlement risk |
| FR-04 | Validate NBBO compliance for US equities before submitting any order (Reg NMS Rule 611) |
| FR-05 | Generate a structured venue selection rationale record for every order before submission to FlexTrade EMS |
| FR-06 | Block order submission if venue selection rationale record cannot be written (fail-closed) |
| FR-07 | Support order types: market, limit, VWAP algo, TWAP algo, implementation shortfall algo, dark-only, lit-only |
| FR-08 | Apply client mandate pre-trade checks: restricted securities list, concentration limits, SFDR PAI thresholds |
| FR-09 | Orders above configurable notional threshold require human trader approval via Bloomberg AIM before submission (EU AI Act Art.14 gate) |

### 5.2 Execution Monitoring

| ID | Requirement |
|---|---|
| FR-10 | Monitor all open orders in real time against VWAP, arrival price, and implementation shortfall benchmarks |
| FR-11 | Calculate interval slippage (5-minute intervals) and cumulative slippage against participation-rate-adjusted benchmark |
| FR-12 | Detect anomaly patterns: unusual slippage (>2 sigma vs. venue historical), order fill clustering, potential spoofing patterns (large order placement + rapid cancellation), wash trading indicators |
| FR-13 | Detect potential order leakage: correlated price movement against order direction before fill |
| FR-14 | Generate real-time alerts to compliance team for MAR Art.12 indicator patterns |
| FR-15 | Automatically create draft STR record when MAR Art.16 suspicious transaction indicators exceed configured threshold |
| FR-16 | Route alerts and STR drafts to ComplianceShield for compliance officer review |
| FR-17 | Execution monitor CANNOT cancel or modify orders; alert-only with human escalation for actions above threshold |

### 5.3 Transaction Cost Analysis

| ID | Requirement |
|---|---|
| FR-18 | Post-trade computation of: explicit costs (commissions, fees), implicit costs (market impact, slippage, spread), opportunity costs (unfilled portions) |
| FR-19 | Benchmark execution quality against: VWAP, arrival price, implementation shortfall (IS), close price |
| FR-20 | Compute per-venue fill quality statistics: average slippage vs. arrival, fill rate, average time to fill, reject rate |
| FR-21 | Generate MiFID II RTS 28 quarterly best execution reports: top 5 venues by instrument class, quality of execution metrics, narrative summary |
| FR-22 | Generate MiFID II RTS 27 venue quality data consumption and analysis |
| FR-23 | Identify systematic execution quality issues: venue degradation over time, algo performance drift, time-of-day slippage patterns |
| FR-24 | TCA reports output to `compliance/reports/tca/` directory only; tca-analyzer has zero write access outside this path |

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Latency** | order-router venue selection decision: <100ms end-to-end from trade list receipt to FlexTrade EMS submission |
| **Availability** | 99.99% uptime during market hours (07:00–22:00 CET, 09:30–16:00 ET) — 52 minutes maximum unplanned downtime per year during market hours |
| **Throughput** | Sustain 500 orders/minute peak; daily capacity of 50,000 orders |
| **Venue connectivity** | FIX protocol connectivity to all configured venues; automatic failover to secondary venue if primary connectivity degrades |
| **Audit latency** | Every order decision written to Chronicle audit trail within 500ms of the routing decision; blocking writes (fail-closed if audit cannot be written) |
| **Data isolation** | Chinese wall enforced at the infrastructure level: TradeSentinel agent processes have no network-level access to ResearchNexus pre-publication storage paths |
| **Resilience** | Market hours kill-switch operable by Head of Trading within 30 seconds; all in-flight orders cancelled or suspended on kill-switch activation |
| **Model validation** | order-router SOR model must pass independent validation per SR 11-7 before deployment and annually thereafter |
| **EU AI Act Art.14** | Human oversight gate for orders above €500K notional (configurable per mandate); SOE enforces the gate deterministically |

---

## 7. Integration Points

| System | Direction | Protocol | Data |
|---|---|---|---|
| Bloomberg AIM (OMS) | Inbound | FIX 4.4 / Bloomberg API | Trade lists from AlphaEngine; mandate constraints |
| FlexTrade EMS | Outbound | FIX 4.2 | Execution instructions from order-router |
| NYSE / NASDAQ / BATS | Outbound (via FlexTrade) | FIX 4.2 | Order submission (never direct; always via EMS) |
| Chi-X Europe / Turquoise | Outbound (via FlexTrade) | FIX 4.2 | EU venue routing |
| Market data feed | Inbound | Bloomberg B-PIPE / Refinitiv | Real-time quotes, NBBO, venue depth |
| ComplianceShield | Outbound | Internal event bus | MAR alerts, STR drafts, RTS 28 reports |
| RiskCompass | Inbound | Internal API | Real-time exposure limits, pre-trade risk checks |
| ResearchNexus | **BLOCKED** | SOE deny rule | All pre-publication paths blocked at SOE gate |

---

*This document is part of the AssetCo AI Platform documentation suite. All financial figures are illustrative. Regulatory requirements should be validated by Legal and Compliance before implementation.*
