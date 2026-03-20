# RiskCompass — Risk and Audit Models

**Document:** apps/risk-compass/risk-audit-models.md
**Application:** RiskCompass — Real-Time Risk Analytics
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** Sarah Nakamura, CRO / James Chen, CTO
**Classification:** Internal — Confidential

---

## 1. Overview

This document specifies the custom Arbiter risk scoring model and Chronicle audit model for RiskCompass. These models are configured at the application level within Sentinel-Ops and apply in addition to the platform-wide defaults.

Arbiter performs asynchronous risk scoring on every agent action — not to gate individual tool calls (that is Sentinel's job) but to detect cumulative risk trajectories that individually acceptable actions can create when combined. For RiskCompass, the primary Arbiter concern is query velocity and cross-fund aggregation scope: a legitimate single query is low risk, but 50 rapid cross-fund aggregation queries could indicate a data exfiltration attempt even though each query passes the SOE gate.

Chronicle records every RiskCompass agent action with structured audit metadata that maps directly to regulatory reporting requirements under Basel III, AIFMD, EU AI Act Art.12, and SR 11-7.

---

## 2. Arbiter Risk Model — RiskCompass

### 2.1 Design Rationale

RiskCompass agents are read-only, which eliminates an entire class of risks (position modification, unauthorized trading) that dominate Arbiter's concern for other applications. The residual risk dimensions for a read-only analytics system are:

1. **Data access scope** — are agents reading only what they need for a legitimate computation?
2. **Query velocity** — are agents querying at a rate consistent with scheduled analytics, or at a rate suggesting automated data scraping?
3. **Cross-fund aggregation scope** — when exposure-monitor aggregates, is it within its authorized cross-fund mandate?
4. **Limit proximity correlation** — are alert generation rates and limit-enforcer activity spiking in a pattern consistent with an actual market stress event, or with system misconfiguration?
5. **Output destination integrity** — are risk outputs being written to approved destinations (dashboard, Chronicle, ComplianceShield event queue) only?

### 2.2 Risk Scoring Factors

Each factor contributes to a normalized risk score (0–100). Arbiter computes a cumulative score across a 60-minute rolling window. Thresholds: Green (0–30), Yellow (31–60), Red (61–100).

#### Factor 1: Data Sensitivity of Positions Accessed (0–25 points)

| Data Type Accessed | Points | Rationale |
|-------------------|--------|-----------|
| Single fund, single asset class positions | 0–3 | Normal var-calculator scheduled run |
| Multiple funds, single asset class | 3–8 | Broader but routine for firm-level VaR |
| Cross-fund, cross-asset-class (all 5 lines) | 8–15 | Expected for exposure-monitor; elevated if other agents |
| Cross-fund + derivative positions + counterparty data simultaneously | 15–20 | High-value data combination; verify agent is exposure-monitor |
| Accessing denied paths (readDeny violations blocked, but attempts logged) | 20–25 | Sentinel blocks; Arbiter escalates pattern of attempts |

**Calibration:** exposure-monitor routinely scores 8–15 on this factor and should not trigger Yellow threshold on Factor 1 alone. The 5-minute polling pattern is pre-authorized in its riskBudget (500/day, 60/hour).

#### Factor 2: Query Velocity (0–25 points)

| Velocity Pattern | Points | Rationale |
|-----------------|--------|-----------|
| ≤ scheduled rate (within riskBudget hourly limit) | 0–5 | Normal scheduled or on-demand operation |
| 110–150% of hourly limit | 5–12 | Acceptable burst; within onDemandBurst allowance |
| 150–200% of hourly limit | 12–18 | Unusual; investigate concurrent requests |
| >200% of hourly limit | 18–25 | Likely loop, retry storm, or unauthorized automation |
| Velocity spike: >5× normal rate in <5 minutes | 22–25 | Immediate Yellow regardless of absolute count |

#### Factor 3: Cross-Fund Aggregation Scope (0–20 points)

This factor applies specifically to exposure-monitor and var-calculator when they execute firm-level aggregation queries.

| Aggregation Scope | Points | Rationale |
|------------------|--------|-----------|
| Single fund / single strategy | 0–2 | Routine; expected for fund-level VaR or stress test |
| 2–3 funds, same business line | 2–5 | Normal for within-division exposure checks |
| All funds in 1 business line | 5–8 | Legitimate for equity or fixed income exposure sweep |
| Cross-business-line (2–3 divisions) | 8–12 | Expected for exposure-monitor; elevated for other agents |
| All 5 business lines simultaneously | 12–20 | Only exposure-monitor is authorized; if var-calculator or stress-tester triggers this pattern, escalate |

**Note:** exposure-monitor's SOE explicitly authorizes all-5-business-line reads. Arbiter's role here is to flag if a different agent executes a cross-fund aggregation pattern that matches exposure-monitor's signature.

#### Factor 4: Limit Proximity and Alert Rate (0–15 points)

| Pattern | Points | Rationale |
|---------|--------|-----------|
| Normal market conditions, no limits approached | 0–2 | Baseline |
| 1–3 limits at 80%+ threshold | 2–6 | Normal stress monitoring; expected to increase alert rate |
| >5 limits simultaneously at 80%+ threshold | 6–10 | High market stress; elevated monitoring warranted |
| Limit breach event generated | 8–12 | Important signal; not inherently suspicious but warrants review |
| >10 breach events in 60 minutes (same or different limits) | 12–15 | Either extreme market stress or limit configuration error; escalate |
| Limit-enforcer generating alerts to non-approved destinations | 15 | Sentinel blocks; Arbiter flags immediately |

#### Factor 5: Output Destination Integrity (0–15 points)

| Pattern | Points | Rationale |
|---------|--------|-----------|
| All outputs to approved destinations (dashboard, Chronicle, ComplianceShield event queue) | 0 | Normal |
| Attempt to write to non-risk-dashboard path | 5–10 | Sentinel blocks; Arbiter escalates pattern |
| Attempt to write to trading system path | 10–15 | Sentinel blocks immediately; Arbiter flags as CRITICAL |
| Attempt to write to client PII path | 10–15 | Sentinel blocks immediately; Arbiter flags as CRITICAL |
| Successful write to any path (any write succeeds) | 15 | Impossible under SOE; if logged, indicates SOE bypass — CRITICAL |

### 2.3 Cumulative Score Thresholds and Actions

| Score Range | Label | Arbiter Action |
|-------------|-------|---------------|
| 0–30 | Green | No action. Log score to Chronicle for trend analysis. |
| 31–60 | Yellow | Log to Chronicle with full factor breakdown. Notify CRO and CISO via Sentinel-Ops internal alert. No agent interruption. |
| 61–85 | Red | Log to Chronicle. Notify CRO, CISO, CCO. Sentinel-Ops Beacon cross-references against other platform agents for correlated anomaly. Consider temporary rate limiting. |
| 86–100 | Critical | Log to Chronicle. Immediate notification to CRO, CISO, CCO. Sentinel automatically reduces agent riskBudget by 50% for remainder of session. Incident workflow triggered. |

### 2.4 Risk Decay

RiskCompass agents benefit from accelerated risk decay relative to the platform default. Because RiskCompass is read-only, actions do not compound in the way that write-capable agent actions do. The decay schedule:

| Time Since Last Elevated Score | Decay Rate | Rationale |
|--------------------------------|-----------|-----------|
| 0–15 minutes | None | Maintain elevated monitoring during active stress |
| 15–30 minutes | 20% per 5 min | Moderate decay if no further elevated actions |
| 30–60 minutes | 30% per 5 min | Faster decay for read-only operations |
| >60 minutes of clean activity | Full reset to baseline | Read-only actions do not carry forward-looking risk |

---

## 3. Chronicle Audit Model — RiskCompass

### 3.1 Audit Categories

Chronicle organizes RiskCompass events into five primary categories, each with a distinct schema and retention policy.

#### Category 1: risk-calculation

Logged for every VaR computation (parametric, historical, Monte Carlo), every stress test execution, and every scheduled or on-demand risk report generation.

```json
{
  "auditCategory": "risk-calculation",
  "eventType": "var-calculation | stress-test-execution | es-calculation",
  "agent": "var-calculator | stress-tester",
  "timestamp": "ISO-8601 UTC",
  "sessionId": "string",
  "calculationId": "string (unique per run)",
  "modelId": "MDL-VAR-001 | MDL-STRESS-001",
  "modelVersion": "string",
  "methodology": "parametric | historical-simulation | monte-carlo | stress-scenario",
  "scope": {
    "level": "fund | strategy | firm",
    "funds": ["string"],
    "assetClasses": ["string"],
    "crossFund": true
  },
  "inputs": {
    "positionSnapshotTimestamp": "ISO-8601 UTC",
    "riskFactorVersion": "string",
    "historicalLookbackDays": 500,
    "dataSourcesRead": ["bloomberg-aim/positions/**", "aladdin/covariance-matrices/**"]
  },
  "outputs": {
    "varValue": "number",
    "confidenceLevel": "0.95 | 0.99 | 0.999",
    "holdingPeriodDays": "1 | 10",
    "currency": "USD",
    "fundId": "string"
  },
  "regulatoryGrade": true,
  "complianceMapping": ["Basel III FRTB §181", "AIFMD Art.15(3)(b)"]
}
```

**Retention:** 7 years. Reason: Basel III requires VaR model evidence available for supervisory review at any time during the model's operational life; AIFMD Art.15 requires evidence of ongoing risk monitoring.

#### Category 2: stress-scenario-execution

Logged for each individual stress scenario run (distinct from the risk-calculation category's general logging of the stress-tester agent starting a session).

```json
{
  "auditCategory": "stress-scenario-execution",
  "eventType": "predefined-scenario | custom-scenario | aifmd-liquidity-stress",
  "agent": "stress-tester",
  "timestamp": "ISO-8601 UTC",
  "calculationId": "string",
  "scenarioId": "SCEN-001 | SCEN-002 | ... | CUSTOM",
  "scenarioName": "string",
  "scenarioParameters": {
    "equityShockPct": "number | null",
    "rateShiftBps": "number | null",
    "creditSpreadIGBps": "number | null",
    "creditSpreadHYBps": "number | null",
    "fxShockPct": "number | null",
    "historicalPeriod": "string | null"
  },
  "trigger": "scheduled | on-demand | aifmd-quarterly | cro-request",
  "requestedBy": "string | null",
  "outputs": {
    "firmStressPnL": "number",
    "worstFundId": "string",
    "worstFundPnL": "number",
    "liquidationDays10pctRedemption": "number | null"
  },
  "aifmdQuarterly": false,
  "complianceMapping": ["AIFMD Art.16(1)", "Basel III FRTB §181(h)", "Dodd-Frank Title II"]
}
```

**Retention:** 7 years. Reason: AIFMD Art.16 liquidity stress test results must be available for NCA review; Basel III stressed VaR evidence required for FRTB IMA approval.

#### Category 3: exposure-alert

Logged for every exposure alert generated by exposure-monitor, including early warnings (80% threshold), velocity alerts, and full concentration alerts.

```json
{
  "auditCategory": "exposure-alert",
  "eventType": "concentration-warning | velocity-alert | counterparty-alert | factor-alert",
  "agent": "exposure-monitor",
  "timestamp": "ISO-8601 UTC",
  "alertId": "string",
  "dimension": "single-name | sector | geography | counterparty | factor | duration | credit-quality",
  "entityId": "string (ISIN, GICS sector, country code, etc.)",
  "entityName": "string",
  "aggregationScope": {
    "fundsAggregated": ["string"],
    "assetClassesAggregated": ["string"],
    "crossFundAggregation": true
  },
  "currentExposure": "number",
  "limitValue": "number",
  "thresholdPct": "80 | 90 | 95 | 100",
  "complianceMapping": ["Basel III CRR2 Art.395", "AIFMD Art.15(3)(a)"]
}
```

**Retention:** 5 years. Reason: Early warning alerts are routine operational events; 5-year retention satisfies SEC Rule 204-2 (5-year books and records requirement).

#### Category 4: limit-breach-detection

Logged for every limit breach event generated by limit-enforcer, including the full escalation chain.

```json
{
  "auditCategory": "limit-breach-detection",
  "eventType": "limit-breach | near-breach-warning | breach-resolved",
  "agent": "limit-enforcer",
  "timestamp": "ISO-8601 UTC",
  "breachEventId": "string",
  "limitId": "string",
  "limitName": "string",
  "limitType": "var-limit | concentration-limit | leverage-aifmd-gross | leverage-aifmd-commitment | tracking-error | counterparty-limit | liquidity-limit",
  "fundId": "string",
  "thresholdValue": "number",
  "currentValue": "number",
  "breachMagnitude": "number",
  "breachMagnitudePct": "number",
  "contributingPositions": [
    {
      "isin": "string",
      "name": "string",
      "contribution": "number"
    }
  ],
  "escalationChain": [
    {
      "recipient": "string",
      "channel": "slack | email | escalation-workflow",
      "timestamp": "ISO-8601 UTC",
      "acknowledged": false
    }
  ],
  "complianceShieldEventId": "string",
  "remediationAction": null,
  "comment_remediationAction": "Always null for limit-enforcer. Remediation is taken by human risk managers; their actions are logged by ComplianceShield, not RiskCompass.",
  "complianceMapping": [
    "AIFMD Art.15(4) leverage limits",
    "Basel III FRTB §183 VaR limits",
    "EU AI Act Art.14 human oversight",
    "Dodd-Frank Title VII §23.600"
  ]
}
```

**Retention:** 7 years. Reason: Regulatory limit breach events are subject to the highest retention standard. AIFMD requires evidence of limit monitoring for NCA review; Basel III requires evidence of internal limit framework effectiveness for FRTB IMA approval; EU AI Act Art.12 requires logging for HIGH RISK AI system lifetime.

#### Category 5: cross-fund-aggregation

A dedicated audit category for firm-level cross-fund aggregation runs by exposure-monitor. These events are specifically logged to provide evidence of AIFMD Art.15 and Basel III consolidated reporting compliance.

```json
{
  "auditCategory": "cross-fund-aggregation",
  "eventType": "firm-level-aggregation | intraday-snap | on-demand-query",
  "agent": "exposure-monitor",
  "timestamp": "ISO-8601 UTC",
  "aggregationRunId": "string",
  "fundsAggregated": ["string"],
  "assetClassesAggregated": ["string"],
  "totalPositionsRead": "number",
  "aggregationDimensions": ["single-name", "sector", "geography", "counterparty", "factor"],
  "topConcentrations": [
    {
      "dimension": "string",
      "entityId": "string",
      "entityName": "string",
      "exposureUSD": "number",
      "exposurePctAUM": "number",
      "fundsContributing": ["string"]
    }
  ],
  "dataFreshnessSeconds": "number",
  "complianceMapping": [
    "AIFMD Art.15(3)(a)",
    "Basel III CRR2 Art.395 consolidated exposure",
    "Dodd-Frank Title I systemic risk",
    "EU AI Act Art.12 record-keeping"
  ]
}
```

**Retention:** 5 years. Reason: Firm-level exposure snapshots are operational records; 5-year retention satisfies SEC Rule 204-2 minimum.

---

## 4. Audit Retention Schedule

| Audit Category | Retention Period | Basis | Storage Tier |
|----------------|-----------------|-------|-------------|
| risk-calculation | 7 years | Basel III FRTB model validation evidence; AIFMD Art.15(3)(b) | S3 Glacier (archival after 2 years) |
| stress-scenario-execution | 7 years | AIFMD Art.16 liquidity stress evidence; Basel III stressed VaR | S3 Glacier (archival after 2 years) |
| limit-breach-detection | 7 years | AIFMD limit framework evidence; Basel III FRTB IMA; EU AI Act Art.12 | S3 Standard (1 year hot), Glacier (6 years) |
| exposure-alert | 5 years | SEC Rule 204-2 books and records | S3 Standard (6 months hot), Glacier (4.5 years) |
| cross-fund-aggregation | 5 years | SEC Rule 204-2; AIFMD Art.15 demonstration | S3 Standard (6 months hot), Glacier (4.5 years) |

**GDPR Note:** Audit records do not contain personal data (positions are identified by ISIN/fund ID, not by client). No GDPR retention conflict applies to RiskCompass audit records.

---

## 5. Compliance Report Templates

Chronicle generates the following standing reports on automated schedules for RiskCompass:

| Report | Frequency | Content | Recipient | Regulation |
|--------|-----------|---------|-----------|-----------|
| VaR Backtesting Traffic Light | Weekly | Exception count vs. Basel III thresholds; YTD exception rate | CRO, Model Validation Committee | Basel III BCBS 352 §183(g) |
| AIFMD Leverage Monitor | Monthly | Gross method + commitment method leverage by fund; limit utilization % | CRO, CCO | AIFMD Art.15(4), Art.24(4) |
| AIFMD Liquidity Stress Report | Quarterly | Days-to-liquidate at 10%/20%/30% redemption by alternative fund | CRO, ComplianceShield | AIFMD Art.16(1) |
| Limit Breach Summary | Monthly | All breach events by fund, limit type, magnitude, duration, resolution | CRO, CCO, Board Risk Committee | Internal governance; AIFMD Art.15; Basel III |
| EU AI Act Art.12 Audit Summary | Quarterly | Calculation counts, model versions in use, data sources accessed, backtesting performance | CRO, CTO, CCO | EU AI Act Art.12 |
| SR 11-7 Model Performance | Quarterly | VaR model: backtesting exceptions, P&L comparison vs. predicted; Stress model: coverage ratio | Model Validation Committee | SR 11-7 ongoing monitoring |

---

*Document owner: Sarah Nakamura, CRO. Changes to risk scoring factors or audit schemas require CRO approval and must be reflected in an updated conformity assessment.*
