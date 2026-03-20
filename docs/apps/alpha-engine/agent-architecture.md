# AlphaEngine — Agent Architecture

**Application:** AlphaEngine
**Document:** apps/alpha-engine/agent-architecture.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** CTO, Head of Quant Research, Model Risk, Engineering

---

## 1. Architecture Overview

AlphaEngine is composed of four agents operating in a directed pipeline. The `factor-analyst` and `portfolio-optimizer` run in a tightly coupled inner loop during each optimization cycle. The `rebalancer` monitors portfolio state continuously and invokes the optimizer when drift thresholds are breached. The `allocation-advisor` operates independently of the optimization pipeline, serving the Multi-Asset Solutions team with cross-asset-class recommendations that require human approval before any downstream action.

All four agents operate within Sentinel-Ops SOE enforcement. The SOE gate validates every tool call — data reads, writes, compute invocations — against the agent's SOE definition before execution. Fiduciary constraints (IPS limit checks, concentration enforcement, ESG minimums) are enforced at the SOE layer as hard denies, not as soft advisory signals within the agent's reasoning.

```
                    ┌─────────────────────────────────────┐
                    │         ResearchNexus               │
                    │  /published/** (chinese wall gate)  │
                    └──────────┬──────────┬───────────────┘
                               │ alpha    │ ESG
                               │ signals  │ scores
              ┌────────────────▼──────────▼──────────────┐
              │             factor-analyst                │
              │   Computes factor exposures (5-factor)    │
              │   READ-ONLY — no write access             │
              └────────────────────┬──────────────────────┘
                                   │ factor constraint
                                   │ recommendations
              ┌────────────────────▼──────────────────────┐
              │           portfolio-optimizer             │
              │   Mean-variance + factor optimization     │
              │   IPS/ESG hard constraints enforced       │
              └──────────┬─────────────────────┬──────────┘
                         │ target portfolios   │ model portfolios
        ┌────────────────▼───────────┐         │
        │         rebalancer         │         ▼
        │  Drift monitoring          │   portfolios/optimized/**
        │  Delta trade list gen      │
        └────────────────┬───────────┘
                         │ trade lists
                         ▼
                  trading/trade-lists/**
                  (TradeSentinel pickup)

              ┌────────────────────────────────────────────┐
              │          allocation-advisor                │
              │  Cross-asset allocation proposals          │
              │  ALL proposals: human approval required    │
              └────────────────────────────────────────────┘
                         │ proposals → portfolios/proposals/**
                         │ (gated — cannot self-execute)
```

---

## 2. Agent Specifications

### 2.1 portfolio-optimizer

**Role:** Core optimization engine. Constructs optimal target portfolio allocations for each mandate, enforcing hard IPS and ESG constraints.

**Inputs:**
- Alpha signals and factor forecasts from ResearchNexus (`/published/signals/**`)
- Risk factor covariance matrices from the factor library (`/data/factors/**`)
- Mandate-specific IPS documents (`/mandates/ips/**`) defining concentration limits, tracking error bounds, duration targets, credit quality floors
- ESG scores and PAI metrics from ResearchNexus (`/published/esg/**`)
- Factor constraint recommendations from `factor-analyst`

**Processing:**
- Constructs the optimization problem: maximize expected return (or factor target proximity) subject to hard constraints
- Hard constraints enforced: max single-name weight (per IPS), max sector weight (per IPS), max country weight (per IPS), tracking error vs. benchmark, duration target (±X years for fixed income mandates), credit quality floor (e.g., minimum BBB- average), SFDR Article 8/9 ESG score floor, PAI exclusion list, EU Taxonomy alignment floor
- Solves using quadratic programming; produces Pareto frontier for configurable risk-aversion parameters
- Logs factor contributions to active return, binding constraints, and objective function value for every output

**Outputs:**
- Optimized target portfolios written to `portfolios/optimized/**`
- Model portfolios (strategy-level, pre-mandate customization) written to `portfolios/model/**`
- Optimization audit record written to Chronicle (Chronicle.log call — append only)

**Hard SOE constraints:**
- DENY: any proposed allocation where single-name weight > IPS max (fiduciary enforcement)
- DENY: any proposed allocation that increases sector concentration above IPS sector limit
- DENY: any proposed allocation to asset class not permitted in mandate IPS
- DENY: reads to `research-nexus/pre-publication/**` (chinese wall)
- DENY: writes to `trading/**`, `compliance/**`, `clients/**`, `mandates/**`

**Risk budget:** 500 risk points per day (HIGH_RISK classification — each optimization run consumes risk budget proportional to position count and constraint count)

---

### 2.2 rebalancer

**Role:** Continuous portfolio drift monitor. Detects when live portfolio weights have drifted from target weights beyond configured thresholds. Generates delta trade lists (buy/sell instructions) to return portfolios to target.

**Inputs:**
- Current live portfolio positions (`/portfolios/live/**`) — intraday position feeds
- Target portfolios from `portfolio-optimizer` (`/portfolios/optimized/**`)
- Transaction cost estimates (`/data/market/transaction-costs/**`)
- Tax lot records (`/portfolios/tax-lots/**`) for tax-aware rebalancing mandates

**Processing:**
- For each mandate, computes weight deviation: |actual_weight - target_weight| per security
- Triggers rebalancing when any security weight deviation exceeds the mandate's configured drift threshold (default: 2%; configurable per mandate down to 0.5%)
- Constructs delta trade list: for each security requiring rebalancing, calculates the target quantity adjustment
- Applies transaction cost budget: if total estimated transaction cost of rebalancing exceeds cost budget (configurable per mandate), defers low-priority rebalances and flags for PM review
- Tax lot selection: for mandates with tax-aware rebalancing, applies FIFO/LIFO/specific-ID lot selection rules
- Validates delta trade list against IPS constraints before output (does not output a trade list that would breach mandate limits)

**Outputs:**
- Delta trade lists written to `trading/trade-lists/**` (TradeSentinel pickup directory)
- Rebalancing event records written to `portfolios/rebalance/**`
- Rebalancing audit record logged to Chronicle

**Hard SOE constraints:**
- DENY: direct order submission to any OMS or execution venue — rebalancer generates trade LISTS only, execution authority belongs to TradeSentinel
- DENY: reads to `research-nexus/pre-publication/**`
- DENY: writes to `compliance/**`, `clients/**`, `mandates/**`
- DENY: modification of target portfolios (read-only to `portfolios/optimized/**`)

**Risk budget:** 300 risk points per day

---

### 2.3 allocation-advisor

**Role:** Cross-asset-class allocation recommendations for the Multi-Asset Solutions team. Assists with macro regime-based allocation decisions for target-date funds, balanced strategies, and tactical allocation mandates. ALL outputs are proposals — none can be acted on without explicit human PM approval.

**Inputs:**
- Macro regime signals (`/data/macro/**`): yield curve, inflation, growth indicators, credit spreads
- Asset class valuation metrics (`/data/valuations/**`): equity P/E spreads, yield spreads, commodity curves
- Client risk profiles (anonymized) (`/clients/risk-profiles/**`): risk score, investment horizon, asset class constraints
- ERISA mandate constraints (`/mandates/erisa/**`): for pension and DC plan mandates

**Processing:**
- Ingests macro regime classification (expansion, contraction, late cycle, crisis) and asset class valuations
- Applies client-specific IPS constraints: asset class floor/ceiling, risk score alignment, prohibited asset classes
- For ERISA mandates: applies prudent expert standard documentation requirements — proposals include structured rationale covering why the allocation is in the plan beneficiaries' best interest
- Generates allocation proposal: target weights by asset class with confidence interval and macro rationale
- Flags proposals that require additional human judgment (e.g., tactical allocation changes >5% in a single asset class, exposure to asset classes not in mandate's approved list)

**Outputs:**
- Allocation proposals written to `portfolios/proposals/**` ONLY
- Proposals are NOT automatically passed to `portfolio-optimizer` or `rebalancer` — they sit in the proposals directory pending human PM sign-off
- Human approval event logged before any proposal is promoted to active allocation

**Hard SOE constraints:**
- DENY: any write outside `portfolios/proposals/**` (strict proposal isolation)
- DENY: direct invocation of `portfolio-optimizer` or `rebalancer` (human must approve and initiate)
- DENY: reads to individual client PII (`/clients/pii/**`) — uses anonymized risk profiles only
- DENY: reads to `research-nexus/pre-publication/**`
- EU AI Act Art.14 compliance: SOE enforces that no allocation proposal results in downstream execution without a human approval event in the audit trail

**Risk budget:** 200 risk points per day

---

### 2.4 factor-analyst

**Role:** Computes factor exposures across all model and live portfolios. Identifies unintended factor tilts relative to mandate factor targets. Feeds factor constraint recommendations to `portfolio-optimizer`. Performs attribution analysis. READ-ONLY — has no write access to any production system.

**Inputs:**
- Live portfolio positions (`/portfolios/live/**`) — read-only
- Model portfolios (`/portfolios/model/**`) — read-only
- Benchmark composition data (`/data/benchmarks/**`)
- Factor library: Barra-compatible factor loadings (`/data/factors/**`)
- Security master and fundamental data (`/data/securities/**`)

**Processing:**
- Computes 5-factor exposure vector for each portfolio: value (B/P, E/P), momentum (12-1 month returns), quality (ROE, leverage), size (log market cap), low-volatility (trailing realized vol)
- Computes benchmark-relative factor exposures: active factor tilts vs. benchmark
- Compares active factor tilts to mandate's target factor profile from IPS
- Identifies unintended tilts: factor deviations exceeding a configurable warning threshold (default: 0.2 standard deviation units)
- Generates factor constraint recommendations for `portfolio-optimizer`: if value tilt is 0.4 SD above target, recommend tightening the value exposure constraint in the next optimization run
- Performs factor attribution: decomposes trailing active return into factor contributions + idiosyncratic

**Outputs:**
- Factor exposure reports written to `portfolios/factor-reports/**`
- Factor constraint recommendations passed to `portfolio-optimizer` (internal pipeline, not a user-facing write)
- Attribution summaries written to `portfolios/attribution/**`

**Hard SOE constraints:**
- DENY: ALL writes to ANY directory outside `portfolios/factor-reports/**` and `portfolios/attribution/**`
- DENY: writes to `trading/**`, `portfolios/optimized/**`, `portfolios/model/**`, `portfolios/live/**`
- DENY: any tool action classified as write-to-production (bash commands, API calls, file edits to source data)
- DENY: reads to `research-nexus/pre-publication/**`

**Risk budget:** 400 risk points per day (higher budget reflects read-only nature — factor computation is frequent and low risk)

---

## 3. Agent Interaction Summary

| Interaction | From | To | Data | Gate |
|---|---|---|---|---|
| Factor constraint feed | factor-analyst | portfolio-optimizer | Factor exposure deviations, recommended constraints | Internal pipeline, SOE-audited |
| Alpha signal read | portfolio-optimizer | ResearchNexus | Published signals, ESG scores | SOE enforces published-only path |
| Target portfolio write | portfolio-optimizer | portfolios/optimized/ | Optimized target weights | SOE allows — within write path |
| Drift trigger | rebalancer | portfolios/live/ | Current position read | SOE allows — read only |
| Trade list output | rebalancer | trading/trade-lists/ | Delta trade list | SOE allows — trade-list path only |
| Allocation proposal | allocation-advisor | portfolios/proposals/ | Cross-asset proposal | SOE allows — proposals path only |
| Downstream execution | allocation-advisor | (blocked) | N/A | SOE DENIES any path to execution |

---

## 4. Fiduciary Enforcement Architecture

The SOE's fiduciary enforcement layer operates at the pre-filter stage — before any AI reasoning, before any tool call executes. This means:

1. **IPS limits are machine-enforced, not agent-enforced.** The portfolio-optimizer cannot "decide" to exceed a concentration limit because the SOE gate blocks the write before it happens. The agent does not need to be trusted to self-limit; the enforcement is external and deterministic.

2. **Pre-publication access is structurally impossible.** The chinese wall is not a policy reminder in the agent's system prompt — it is a hard readDeny pattern in the SOE definition. The agent cannot read `research-nexus/pre-publication/**` regardless of what instruction it receives.

3. **Human approval gate is SOE-enforced.** The allocation-advisor's write scope is physically limited to `portfolios/proposals/**`. There is no code path by which a proposal can become an active allocation without a human creating an approval event that is logged to the audit trail. The SOE gate validates the approval event before permitting the promotion write.

4. **Every fiduciary-relevant decision is logged.** Chronicle captures: optimization inputs (factor signals, IPS constraints active), optimization outputs (target weights, binding constraints), rebalancing trigger (drift measurement, threshold, timestamp), and proposal-to-active promotion (human approver identity, approval timestamp). This log is append-only and cannot be modified by any agent or human operator.
