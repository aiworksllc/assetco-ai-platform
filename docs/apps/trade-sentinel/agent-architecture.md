# TradeSentinel — Agent Architecture

**Application:** TradeSentinel
**Document:** agent-architecture.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** Platform Engineering, Compliance Technology, Security Architecture

---

## 1. Architecture Overview

TradeSentinel operates as a 3-agent system coordinated through the Sentinel-Ops orchestrator. The agents are architecturally separated by time horizon (pre-trade, intraday, post-trade) and by authority: only `order-router` has write access to the order staging directory; `execution-monitor` is alert-only; `tca-analyzer` is strictly read-only across the entire trading stack.

This separation of duties is not a process control — it is enforced deterministically by each agent's SOE definition. The Sentinel-Ops gate evaluates every tool call at runtime and blocks any action not explicitly permitted by the agent's SOE, regardless of what the AI model attempts.

```
Bloomberg AIM (OMS)
  │  Trade lists (FIX 4.4)
  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        order-router                                  │
│                                                                      │
│  1. Read trade list from AlphaEngine                                 │
│  2. Fetch real-time quotes + venue depth (Bloomberg B-PIPE)          │
│  3. Run SOR scoring: liquidity, spread, impact, fees, fill rate      │
│  4. Validate NBBO compliance (Reg NMS Rule 611)                      │
│  5. Apply mandate pre-trade checks (RiskCompass limits)              │
│  6. Write venue selection rationale → trading/orders/staged/         │
│  7. Submit execution instruction → FlexTrade EMS                     │
│                                                                      │
│  SOE Write Access: trading/orders/staged/** ONLY                     │
│  SOE Deny: research-nexus/pre-publication/**, research-nexus/draft/**│
└───────────────────────────┬─────────────────────────────────────────┘
                            │ FlexTrade EMS
                            ▼
                    NYSE / NASDAQ / BATS
                    Chi-X / Turquoise / Dark Pools
                            │ Fill confirmations
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     execution-monitor                                │
│                                                                      │
│  1. Monitor open orders in real time                                 │
│  2. Compute interval slippage vs. VWAP / arrival / IS benchmarks    │
│  3. Detect anomaly patterns (spoofing, wash trading, leakage)        │
│  4. Generate MAR Art.12 alerts → trading/alerts/                     │
│  5. Create draft STR records → ComplianceShield                      │
│                                                                      │
│  SOE Write Access: trading/alerts/**, trading/monitoring/** ONLY     │
│  SOE Deny: order modification of any kind                            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ Fill data (post-trade)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      tca-analyzer                                    │
│                                                                      │
│  1. Read completed execution records (historical only)               │
│  2. Compute TCA metrics: explicit, implicit, opportunity costs       │
│  3. Benchmark against VWAP, arrival, IS, close                       │
│  4. Compute per-venue fill quality statistics                        │
│  5. Generate MiFID II RTS 28 quarterly reports                       │
│  6. Write reports → compliance/reports/tca/ ONLY                     │
│                                                                      │
│  SOE Write Access: compliance/reports/tca/** ONLY                    │
│  SOE Deny: ALL write/execute tools outside report path               │
│  SOE Deny: live-orders/** (post-trade only; cannot see open orders)  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Agent Detail: order-router

### 2.1 Purpose

`order-router` is the sole execution decision-maker in TradeSentinel. It receives trade lists from AlphaEngine via Bloomberg AIM, evaluates execution venue options, selects the optimal routing strategy, documents the rationale, and submits execution instructions to FlexTrade EMS.

### 2.2 Smart Order Routing Logic

For each order, `order-router` evaluates a scored matrix of candidate venues:

| Scoring Dimension | Weight | Data Source |
|---|---|---|
| Available liquidity at touch | 30% | Real-time order book depth (B-PIPE) |
| Bid-ask spread | 20% | Real-time quote feed |
| Estimated market impact | 20% | Historical fill data + order size vs. ADV |
| All-in fee schedule | 15% | Venue fee schedule cache |
| Historical fill rate | 10% | 90-day rolling fill statistics per venue |
| Settlement risk score | 5% | CSD/custodian connectivity status |

Orders above a configurable ADV participation threshold are automatically split across venues (iceberg / TWAP / VWAP algo) to minimise market impact. Dark pool routing is applied first for block orders (>$500K notional) before lit venue submission.

### 2.3 Pre-Trade Checks (SOE-Enforced)

Before any execution instruction is submitted, `order-router` must pass all of the following SOE-enforced pre-trade checks:

- NBBO validation: bid/ask for the instrument must be fetched and the proposed limit price must satisfy Reg NMS Rule 611
- Mandate compliance: instrument not on restricted securities list; concentration limits not breached post-fill
- Risk budget: Arbiter risk score for this agent must not be at ceiling
- Rationale record: venue selection rationale must be successfully written to `trading/orders/staged/` before the FlexTrade submission tool call is permitted
- Human approval gate: orders above €500K notional (configurable) must carry a `human-approved: true` flag in the order context; orders without this flag are blocked by SOE

### 2.4 System Connections

- **Reads from:** Bloomberg AIM (trade lists), Bloomberg B-PIPE (market data), RiskCompass (exposure limits), venue fee schedule cache
- **Writes to:** `trading/orders/staged/` (rationale records + staged orders)
- **Submits to:** FlexTrade EMS (execution instructions via FIX 4.2)
- **Blocked from:** All ResearchNexus paths; client PII; deal room data

---

## 3. Agent Detail: execution-monitor

### 3.1 Purpose

`execution-monitor` provides real-time surveillance of all open orders during their execution lifecycle. It computes intraday execution quality metrics, detects patterns indicative of market abuse, and generates alerts and STR drafts for the compliance function. It cannot modify, cancel, or replace orders under any condition.

### 3.2 Benchmark Monitoring

`execution-monitor` tracks each open order against three benchmarks simultaneously:

| Benchmark | Calculation | Alert Threshold |
|---|---|---|
| VWAP | Volume-weighted average price from order start time to current time | Slippage >10bp vs. VWAP |
| Arrival Price | Mid-quote at time of order receipt | IS cost >15bp vs. arrival |
| Implementation Shortfall | Total cost including market impact and delay | IS >25bp total |

Interval slippage is computed every 5 minutes. A 2-sigma deviation from the venue's historical slippage distribution triggers an anomaly alert.

### 3.3 Market Abuse Pattern Detection

`execution-monitor` continuously evaluates execution data against the following MAR Art.12 indicator patterns:

| Pattern | Detection Logic | MAR Reference |
|---|---|---|
| Spoofing / Layering | Large order placed, then cancelled >80% within 30s before fill on opposite side | Art.12(2)(b) |
| Wash trading | Buy and sell orders in same instrument within same account cluster, same price band, <60s apart | Art.12(2)(a) |
| Order leakage | Correlated adverse price movement in same instrument >2bp before fill, on 3+ consecutive orders | Art.12(1)(a) |
| Ramping | Progressively increasing order sizes in same direction over <2-hour window, last order >3x first | Art.12(2)(c) |
| Momentum ignition | Cluster of rapid orders triggering stop-loss cascade in illiquid instrument | Art.12(1)(b) |

Detected patterns are classified: MONITOR (log only), ALERT (notify compliance desk), STR_CANDIDATE (auto-draft suspicious transaction report). STR candidates are routed to ComplianceShield for compliance officer review within 15 minutes.

### 3.4 Authority Limits

`execution-monitor` has **zero order modification authority**. The only actions it can take are:

- Write alert records to `trading/alerts/`
- Write monitoring snapshots to `trading/monitoring/`
- Send alert notifications to ComplianceShield via the internal event bus
- Escalate to human compliance desk (creates escalation event in ComplianceShield)

Order cancellation for orders above a defined notional threshold requires human approval. Below threshold, only `order-router` can cancel staged orders.

---

## 4. Agent Detail: tca-analyzer

### 4.1 Purpose

`tca-analyzer` performs post-trade analysis of execution quality. It has no real-time execution visibility — it operates exclusively on completed fill records. It is the source of MiFID II RTS 28 quarterly best execution reports and implementation shortfall attribution reports delivered to portfolio managers and the compliance function.

### 4.2 TCA Methodology

For each completed order, `tca-analyzer` computes a full cost decomposition:

| Cost Component | Definition | Measurement |
|---|---|---|
| Explicit — Commission | Broker/venue commission per share | Actual from execution record |
| Explicit — Venue fees | Exchange/ATS access and clearing fees | Actual from fee confirmation |
| Implicit — Spread | Half-spread at time of order initiation | Quoted spread at arrival timestamp |
| Implicit — Market impact | Price movement attributable to order flow | Arrival-to-fill price delta, participation-adjusted |
| Implicit — Slippage | Execution price vs. benchmark price | VWAP/IS delta |
| Opportunity cost | Alpha decay on unfilled portions | Price at decision time vs. close |

### 4.3 RTS 28 Report Generation

Quarterly reports cover the top 5 execution venues by instrument class (equities, bonds, ETFs, derivatives), including:
- Total volume executed and number of orders per venue
- Percentage of passive vs. aggressive fills
- Average execution cost vs. VWAP
- Fill rate and average time to fill
- Narrative summary of execution quality observations and any venue de-weighting actions taken

Reports are published to `compliance/reports/tca/YYYY-QQ/` following the RTS 28 template structure.

### 4.4 Read-Only Enforcement

`tca-analyzer` is the strictest agent in the TradeSentinel SOE:

- It has **no read access to live orders** (`trading/orders/active/**` is explicitly denied)
- It has **no write access** outside `compliance/reports/tca/**`
- All execute-type tool actions (bash commands, API calls that mutate state) are denied
- If `tca-analyzer` attempts any write outside its permitted path, the SOE gate blocks the action and logs a `separation-of-duties-violation` event

---

## 5. Chinese Wall Data Flow

The following diagram shows precisely what TradeSentinel CAN and CANNOT read from ResearchNexus.

```
ResearchNexus Storage Layout
─────────────────────────────────────────────────────────────────
research-nexus/
├── pre-publication/          ← BLOCKED for ALL TradeSentinel agents
│   ├── drafts/               ← BLOCKED — MAR Art.10, Reg FD
│   ├── analyst-notes/        ← BLOCKED — potential MNPI
│   └── pending-approval/     ← BLOCKED — not yet public
│
├── analyst-workspace/        ← BLOCKED for ALL TradeSentinel agents
│   └── {analyst-id}/         ← BLOCKED — internal working files
│
└── published/                ← PERMITTED for order-router (market context only)
    ├── reports/              ← PERMITTED — publicly released research
    │   └── {date}/{ticker}/  ← PERMITTED — post-publication gate
    └── esg-scores/           ← PERMITTED — published ESG data only
        └── published/        ← PERMITTED — taxonomy-aligned scores

─────────────────────────────────────────────────────────────────
                         CHINESE WALL
─────────────────────────────────────────────────────────────────

TradeSentinel CAN read:                TradeSentinel CANNOT read:
  research-nexus/published/**            research-nexus/pre-publication/**
  (only after publication gate)          research-nexus/draft/**
                                         research-nexus/analyst-workspace/**
                                         research-nexus/pending-approval/**

Enforcement mechanism: SOE readDeny rules in all 3 agent SOE definitions.
These are deterministic glob-match denies evaluated in <1ms at the
Sentinel-Ops pre-filter. No AI reasoning involved — the path is either
on the deny list or it is not. Deny rules take precedence over allow rules.

Violation handling: Any attempt to read a denied path generates a
`chinese-wall-violation-attempt` audit event, triggers a Beacon anomaly
alert, and escalates to the compliance team. The tool call is blocked
regardless of the rationale provided by the AI model.
```

### 5.1 Why Published Research Is Permitted

`order-router` has read access to `research-nexus/published/**` because:
1. The information is already public — no MNPI concern once through the publication gate
2. Published ESG scores may affect SFDR PAI pre-trade checks required by mandate
3. AlphaEngine has already incorporated published research into trade lists; order-router needs the same baseline

The publication gate itself is enforced by ResearchNexus's SOE, not TradeSentinel's. TradeSentinel relies on the path structure: anything in `published/` has been through the human approval and publication workflow.

---

## 6. Agent Interaction Summary

| Agent | Time Horizon | Authority | Can Read Live Orders | Can Write Orders | Can Modify Orders |
|---|---|---|---|---|---|
| order-router | Pre-trade | Route + stage orders | Yes (staged only) | Yes (staged only) | No (resubmit only) |
| execution-monitor | Intraday / real-time | Alert + escalate | Yes (all open orders) | No | No |
| tca-analyzer | Post-trade | Analyse + report | No (historical only) | No (reports only) | No |

---

*This document is part of the AssetCo AI Platform documentation suite. Architecture diagrams reflect the logical data flow enforced by Sentinel-Ops SOE definitions. Physical deployment topology is documented separately in the infrastructure runbook.*
