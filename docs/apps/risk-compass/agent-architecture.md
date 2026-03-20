# RiskCompass — Agent Architecture

**Document:** apps/risk-compass/agent-architecture.md
**Application:** RiskCompass — Real-Time Risk Analytics
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** James Chen, CTO / Sarah Nakamura, CRO
**Classification:** Internal — Restricted

---

## 1. Architecture Overview

RiskCompass is a read-only, analytics-only system. All four agents draw from the same position and market data sources, compute different dimensions of risk, and publish outputs exclusively to read-only destinations (dashboards, alert channels, audit trail). No agent has write access to any position system, trade execution system, or order management system.

```
DATA SOURCES (Read-Only)
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Bloomberg AIM│  │   Aladdin    │  │  Snowflake   │  │  Internal    │
  │  (positions) │  │(risk factors)│  │ (historical) │  │ trading apps │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                 │                  │
         └─────────────────┴─────────────────┴──────────────────┘
                                     │
                           ┌─────────▼──────────────────────────┐
                           │       RISKCOMPASS AGENTS            │
                           │                                     │
                           │  ┌──────────────────────────────┐  │
                           │  │      var-calculator          │  │
                           │  │  Parametric / Historical /   │  │
                           │  │  Monte Carlo VaR             │  │
                           │  └──────────────┬───────────────┘  │
                           │                 │                   │
                           │  ┌──────────────▼───────────────┐  │
                           │  │       stress-tester          │  │
                           │  │  Scenario P&L / Liquidity    │  │
                           │  │  Stress / AIFMD Liquidity    │  │
                           │  └──────────────┬───────────────┘  │
                           │                 │                   │
                           │  ┌──────────────▼───────────────┐  │
                           │  │     exposure-monitor         │  │
                           │  │  Cross-fund aggregation /    │  │
                           │  │  Concentration / Factor      │  │
                           │  └──────────────┬───────────────┘  │
                           │                 │                   │
                           │  ┌──────────────▼───────────────┐  │
                           │  │      limit-enforcer          │  │
                           │  │  VaR limits / Leverage /     │  │
                           │  │  Concentration limits        │  │
                           │  └──────────────┬───────────────┘  │
                           └─────────────────┼───────────────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
     ┌────────▼────────┐          ┌──────────▼──────────┐       ┌──────────▼────────┐
     │  Risk Dashboard │          │  ComplianceShield   │       │  Chronicle Audit  │
     │  (read-only UI) │          │  (limit breach feed)│       │  (immutable log)  │
     └─────────────────┘          └─────────────────────┘       └───────────────────┘
```

---

## 2. Agent: var-calculator

### 2.1 Purpose

`var-calculator` is the quantitative core of RiskCompass. It computes VaR at three methodological levels — parametric (variance-covariance), historical simulation, and Monte Carlo — across all funds, strategies, and at the firm level. It is the authoritative source of risk capital estimates for internal limit monitoring and for regulatory capital reporting under Basel III/IV FRTB.

### 2.2 Inputs

| Input | Source | Update Frequency |
|-------|--------|-----------------|
| Current positions (all 5 business lines) | Bloomberg AIM | Real-time (5-min lag maximum) |
| Risk factor loadings, covariance matrices | Aladdin risk model | Daily calibration, intraday updates for major factor moves |
| Historical return series (2-year, 10-year) | Snowflake historical store | Daily refresh; static for current session |
| Benchmark compositions | Aladdin | Daily |
| Model portfolio deltas (pre-execution) | AlphaEngine internal API | On-demand for "what-if" queries |
| FX rates, commodity spot prices | Bloomberg (via AIM feed) | Real-time |

### 2.3 Computations

**Parametric VaR (Delta-Normal):**
- Constructs position-weighted factor exposure vector
- Multiplies by covariance matrix from Aladdin risk model
- Applies 95% and 99% confidence multipliers (1.645 and 2.326)
- Holding periods: 1-day (monitoring), 10-day (Basel III capital = 1-day × √10)

**Historical Simulation VaR:**
- Revalues current portfolio against 500-day (2-year) and 2,500-day (10-year) historical factor return paths
- Sorts P&L distribution; VaR = 5th percentile (95%) or 1st percentile (99%)
- Captures fat tails and non-linearity not reflected in parametric approach
- Used as primary methodology for FRTB IMA (Internal Models Approach) compliance

**Monte Carlo VaR:**
- Generates 10,000 correlated scenario paths from covariance matrix + fat-tail adjustment (Student-t, ν=5)
- Full repricing of non-linear instruments (options, structured products in Alternatives book)
- Holding period: 1-day and 10-day
- Used for Alternatives book where parametric underestimates due to optionality

**Daily Backtesting:**
- Compares prior-day VaR prediction against actual daily P&L
- Logs exceptions (P&L exceeds VaR) to Chronicle
- Generates traffic light report: Green (0-4 exceptions/year), Yellow (5-9), Red (10+) per Basel III framework
- Red status triggers automatic escalation to CRO and model validation committee

### 2.4 Outputs

| Output | Destination | Trigger |
|--------|-------------|---------|
| VaR report (fund, strategy, firm) | Risk dashboard | Hourly scheduled; on-demand |
| Near-limit alert | limit-enforcer → risk manager | VaR reaches 80% of limit |
| What-if VaR response | Requesting agent / PM interface | On-demand query |
| Backtesting exception log | Chronicle | Daily |
| Regulatory VaR (99%, 10-day) | ComplianceShield | Daily EOD |

### 2.5 SOE Posture

Read-only across all position and market data sources. Zero write access to any upstream system. Cannot place, modify, or cancel any order or position. riskBudget: 200 tool calls/day.

---

## 3. Agent: stress-tester

### 3.1 Purpose

`stress-tester` evaluates portfolio resilience against historical market crises and hypothetical stress scenarios. It answers the question: "If the 2008 financial crisis happened today, what would our P&L impact be?" It also runs the mandatory quarterly AIFMD liquidity stress tests.

### 3.2 Inputs

| Input | Source | Notes |
|-------|--------|-------|
| Current positions | Bloomberg AIM | Same feed as var-calculator |
| Factor sensitivities (DV01, beta, spread DV01, FX delta) | Aladdin | Per-instrument sensitivities |
| Historical scenario factor paths | Snowflake | Pre-stored for standard scenarios |
| Custom scenario parameters | On-demand request | PM/risk manager input |
| Liquidity profiles (bid-ask, ADV) | Bloomberg (via AIM) | For AIFMD liquidity stress |

### 3.3 Pre-Configured Scenarios

| Scenario ID | Name | Factor Shocks | Historical Reference |
|-------------|------|--------------|---------------------|
| SCEN-001 | 2008 GFC Peak | Equity -40%, Credit spread HY +1200bps, IG +500bps, Vol +180%, USD safe-haven +15% | Sep–Nov 2008 |
| SCEN-002 | 2020 COVID Crash | Equity -33%, Credit spread HY +600bps, Vol +250%, Oil -65%, USD +8% | Feb–Mar 2020 |
| SCEN-003 | Rate Shock Up | Parallel shift +300bps across all tenors; equity multiple compression -15% | Hypothetical |
| SCEN-004 | Rate Shock Down | Parallel shift -200bps; credit spread tightening -100bps | Hypothetical |
| SCEN-005 | Credit Spread Widening | IG +200bps, HY +500bps, equity -20%, duration neutral | Hypothetical |
| SCEN-006 | EM Currency Crisis | EM FX -20% vs. USD basket, EM equities -30%, EM sovereign spread +400bps | 2013 Taper Tantrum analog |
| SCEN-007 | Global Equity Bear | All equity -30%, flight to quality (US Treasuries +5%, Bund +4%), VIX +150% | Hypothetical |

### 3.4 Outputs

For each scenario execution:
- Stress P&L by fund (absolute and % of NAV)
- Stress P&L by strategy
- Firm-level aggregate stress P&L
- Top-10 P&L contributors (largest stress losers)
- Top-10 P&L detractors
- Post-stress VaR estimate (immediate follow-on risk)
- AIFMD quarterly: days-to-liquidate under 10%, 20%, 30% redemption assumptions

### 3.5 Data Access Restrictions

`stress-tester` does NOT have access to:
- Pre-publication research from ResearchNexus (to prevent research timing information leaking into stress scenario design)
- Trade order data (pending orders, order routing details) from TradeSentinel
- Client-identifiable records (AdvisorLens client files)
- Deal room data (Private Markets deal files)

### 3.6 SOE Posture

Read-only. Cannot write to any source system. riskBudget: 100 tool calls/day (lower than var-calculator due to computational intensity of Monte Carlo stress runs).

---

## 4. Agent: exposure-monitor

### 4.1 Purpose

`exposure-monitor` is the agent with the broadest data access of any agent in the AssetCo AI Platform. It must aggregate positions across all five business lines and all seven AI applications to produce a consolidated firm-level view of exposures. This cross-fund aggregation is the critical capability that no single fund-level system can provide — only by seeing all positions simultaneously can the firm detect that it has, for example, 8% of firm AUM in a single issuer split across three different strategies.

### 4.2 Aggregation Scope

| Dimension | What Is Aggregated | Alert Threshold |
|-----------|-------------------|----------------|
| Single-name issuer | Long + short equity, corporate bonds, CDS, convertibles in any issuer, across all funds | 5% of firm AUM (hard limit 6%) |
| Sector (GICS Level 1) | Net exposure by GICS sector across all equity and credit strategies | 25% of equity AUM |
| Geography (country) | Net country exposure including FX forwards | 20% of firm AUM |
| Geography (region) | EM aggregate, EMEA, APAC | 40% of firm AUM |
| Duration (interest rate) | Aggregate DV01 across all fixed income and macro strategies | DV01 limit in $-terms |
| Credit quality | Net exposure by rating bucket (AAA/AA, A, BBB, HY, NR) | HY limit 15% of FI book |
| Counterparty | Gross exposure to each prime broker, OTC counterparty | 20% of firm AUM |
| FX | Net FX exposure by currency after hedges | Per-currency and total FX VaR |
| Factor | Beta to SPX, duration, EM beta, credit beta | Factor VaR contribution |

### 4.3 Cross-Fund Netting Logic

`exposure-monitor` applies the following netting rules for firm-level exposure:
- Equity long + equity short in same ISIN = net, reported as net long/short
- Bond long + CDS protection in same issuer = net credit exposure reported
- Fund-level currency hedges reduce firm-level FX exposure where hedge is traceable to underlying position
- Private Markets positions marked at last valuation; intraday exposure treated as static between valuation dates

### 4.4 Concentration Drift Detection

Rather than simply comparing current exposure to limits, `exposure-monitor` detects drift:
- Calculates 5-day rolling average exposure by dimension
- Flags when current exposure deviates from rolling average by >15% in a single day (concentration velocity alert)
- This catches rapid builds in exposure that may approach a limit within the current trading session even if the limit is not yet at risk

### 4.5 Outputs

| Output | Destination | Trigger |
|--------|-------------|---------|
| Exposure dashboard update | Risk dashboard | Every 5 minutes |
| Early warning alert (80% of limit) | Risk manager + limit-enforcer | On threshold crossing |
| Concentration velocity alert | Risk manager | On >15% intraday drift |
| Cross-fund single-name report | CRO request | On-demand |
| Firm-level leverage metrics | limit-enforcer (AIFMD) | Hourly |

### 4.6 SOE Posture

Broadest readAllow of any agent in the platform. Zero write access to any system. Does not read: trade execution routing details (unnecessary for exposure calculation), order management data (pending but unexecuted orders are excluded from exposure — only settled and executed positions), client PII from AdvisorLens. riskBudget: 500 tool calls/day (highest — continuous monitoring).

---

## 5. Agent: limit-enforcer

### 5.1 Purpose

`limit-enforcer` is the enforcement layer of RiskCompass. It continuously compares current risk metrics — drawn from var-calculator and exposure-monitor — against the firm's pre-set risk limit framework and generates structured alerts and escalations when limits are approached or breached.

**Critical constraint:** `limit-enforcer` has NO authority to take remediation action. It cannot halt trading, cancel orders, modify positions, or issue instructions to any trading system. Its sole outputs are: notifications to human risk managers, events to ComplianceShield, and logs to Chronicle. Remediation authority rests exclusively with human risk managers.

### 5.2 Limit Framework

| Limit Category | Examples | Monitoring Frequency |
|----------------|----------|---------------------|
| VaR limits | Fund-level 99% VaR as % of NAV; Firm-level VaR | Every 5 minutes |
| AIFMD leverage | Gross method ≤ 300% NAV; Commitment method ≤ 200% NAV (alternative funds) | Hourly |
| Concentration limits | Single-name 5% of firm AUM; Sector 25% of equity AUM | Every 5 minutes |
| Tracking error | Fund-level tracking error vs. benchmark (mandate-specific bands) | Every 5 minutes |
| Counterparty limits | OTC counterparty gross exposure ≤ 20% firm AUM | Hourly |
| Liquidity limits | % of portfolio liquidatable in 5 days ≥ 80% | Daily |

### 5.3 Escalation Logic

```
Metric reaches 80% of limit  →  Near-breach warning → Risk Manager (Slack + email)
Metric reaches 90% of limit  →  Escalation Warning → Risk Manager + Deputy CRO
Metric reaches 95% of limit  →  Pre-breach Alert → CRO direct notification
Metric reaches 100% (breach) →  BREACH EVENT:
                                    • Immediate Slack alert to #risk-alerts
                                    • Email to CRO, risk manager, CCO
                                    • Structured event to ComplianceShield
                                    • Chronicle log (immutable)
                                    • If breach persists >30 min: CEO notification
Metric remains in breach >2h →  ESCALATION PROTOCOL: CRO must acknowledge or
                                    escalate to executive committee
```

### 5.4 What limit-enforcer CANNOT Do

The following actions are explicitly denied in `limit-enforcer`'s SOE definition and cannot be overridden at runtime:
- Sending trade cancellation instructions to TradeSentinel or Bloomberg AIM
- Placing, modifying, or cancelling any order in any OMS
- Modifying position records in any system
- Changing risk limits (read-only access to limits configuration)
- Suppressing or deleting an alert that has been generated (alerts are append-only)
- Contacting counterparties or prime brokers directly

### 5.5 ComplianceShield Integration

When a limit breach event is generated, `limit-enforcer` publishes a structured event to ComplianceShield's event queue containing:
- Limit type and identifier
- Fund(s) affected
- Threshold value and current value
- Breach magnitude (absolute and % over limit)
- Timestamp (UTC)
- Preceding metric trajectory (last 60 minutes)

ComplianceShield uses these events for AIFMD Annex IV reporting, regulatory capital calculations, and audit trail cross-referencing.

### 5.6 SOE Posture

Read: risk limits configuration, current exposure metrics (from exposure-monitor), VaR outputs (from var-calculator).
Write: alert/notification tools, event queue (to ComplianceShield event topic only), Chronicle via SOE audit hook.
Deny: all trade tools, all OMS tools, all position modification tools, all order tools.
riskBudget: 300 tool calls/day.

---

## 6. Agent Interaction Diagram

```
                 DATA LAYER (Read-Only)
    Bloomberg AIM ──────────────────────────────────────────┐
    Aladdin ────────────────────────────────────────────────┤
    Snowflake ──────────────────────────────────────────────┤
    AlphaEngine / TradeSentinel / OpsFabric ────────────────┤
                                                            │
                                              ┌─────────────▼──────┐
                           ┌──────────────────│   var-calculator   │
                           │  VaR metrics     │  (hourly + on-demand│
                           │                  └────────────────────┘
                           │
               ┌───────────▼──────────────────────────────────────────────────┐
               │                   limit-enforcer                             │
               │  (reads VaR from var-calculator, exposure from               │
               │   exposure-monitor, limits from config store)                │
               └───┬───────────────────────────────────────────────┬──────────┘
                   │ Breach events                                 │ Near-breach
                   │                                               │ warnings
    ┌──────────────▼────┐                              ┌──────────▼──────────┐
    │ ComplianceShield  │                              │   Risk Manager      │
    │ (event queue)     │                              │   (Slack/email)     │
    └───────────────────┘                              └─────────────────────┘
                   │
    ┌──────────────▼────┐
    │    Chronicle      │
    │ (immutable audit) │
    └───────────────────┘

               ┌───────────────────────────────────────────────────────────┐
               │                 exposure-monitor                          │
               │  (reads ALL position data; publishes to limit-enforcer    │
               │   + risk dashboard; continuous 5-min polling)             │
               └───────────────────────────────────────────────────────────┘

               ┌───────────────────────────────────────────────────────────┐
               │                  stress-tester                            │
               │  (reads positions + Snowflake historical scenarios;       │
               │   outputs to risk dashboard on-demand or scheduled)       │
               └───────────────────────────────────────────────────────────┘
```

---

## 7. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| var-calculator and exposure-monitor are independent agents | Prevents circular dependency: exposure-monitor feeds data to limit-enforcer without depending on VaR output; var-calculator can run what-if calculations independently |
| limit-enforcer reads from exposure-monitor, not directly from position feeds | Consolidates cross-fund aggregation logic in exposure-monitor; limit-enforcer consumes the aggregated view, not raw position data |
| stress-tester runs independently from VaR schedule | Stress tests are computationally intensive; decoupling ensures scheduled VaR runs are never delayed by a concurrent stress scenario execution |
| All 4 agents share the same read-only data layer | Consistency: all agents see the same position snapshot for a given calculation run, preventing contradictory risk views |
| limit-enforcer alerts go to ComplianceShield via event queue, not direct API write | SOE-enforced: limit-enforcer cannot write to ComplianceShield's data store directly; it can only publish to a designated event topic, preventing inadvertent overwrites of compliance records |

---

*Document owner: James Chen, CTO. Review cycle: Quarterly or on material change to agent architecture.*
