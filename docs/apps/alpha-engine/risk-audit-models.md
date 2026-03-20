# AlphaEngine — Risk Scoring and Audit Models

**Application:** AlphaEngine
**Document:** apps/alpha-engine/risk-audit-models.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** CRO, CCO, Model Risk, Platform Engineering, Internal Audit

---

## 1. Overview

This document defines the risk scoring model and audit classification framework that Sentinel-Ops applies to AlphaEngine operations. The risk model governs how the Arbiter module scores individual tool calls and cumulative session trajectories. The audit model defines the event taxonomy that Chronicle uses to classify, log, and retain every AlphaEngine decision.

Both models are calibrated to AlphaEngine's HIGH_RISK classification. The guiding principle is that any agent action affecting client capital deployment — directly or indirectly — carries inherent fiduciary risk and must be scored, logged, and retained accordingly.

---

## 2. Risk Scoring Model

### 2.1 Risk Factors

Arbiter computes a risk score for each AlphaEngine tool call based on the following factors. Scores are additive; the total score is compared against the agent's per-call limit (soft threshold) and the daily risk budget (hard limit).

#### Factor 1: Allocation Magnitude

Measures the scale of portfolio change proposed by an optimization or rebalancing action.

| Condition | Risk Score |
|---|---|
| Incremental adjustment (aggregate weight change <2% across portfolio) | 1–3 |
| Moderate rebalancing (aggregate weight change 2–10%) | 4–8 |
| Large rebalancing (aggregate weight change 10–25%) | 9–15 |
| Major restructuring (aggregate weight change >25%) | 16–25 |
| Full portfolio reconstruction | 25+ (escalate to Sentinel AI) |

**Rationale:** Large aggregate weight changes represent material shifts in client capital deployment. A full portfolio reconstruction carries fiduciary risk disproportionate to an incremental drift correction.

---

#### Factor 2: Concentration Change

Measures how close the proposed allocation moves to IPS concentration limits.

| Condition | Risk Score |
|---|---|
| Proposed weight is <50% of IPS concentration limit | 0 |
| Proposed weight is 50–75% of IPS limit | 1–3 |
| Proposed weight is 75–90% of IPS limit | 4–8 |
| Proposed weight is 90–99% of IPS limit (near-breach) | 9–15 |
| Proposed weight equals or exceeds IPS limit | HARD DENY — SOE blocks, Arbiter flags trajectory |

**Rationale:** Near-breach trajectories indicate that the optimizer is consistently proposing allocations at or near constraint boundaries. Arbiter monitors this pattern across a session; repeated near-miss events may indicate a model that is systematically straining against its constraints, warranting PM review.

---

#### Factor 3: ESG Constraint Proximity

Measures how close the proposed portfolio ESG score is to the SFDR mandate minimum.

| Condition | Risk Score |
|---|---|
| Portfolio ESG score >20 points above minimum | 0 |
| Portfolio ESG score 10–20 points above minimum | 1 |
| Portfolio ESG score 5–10 points above minimum | 2–4 |
| Portfolio ESG score 1–5 points above minimum (near-breach) | 5–10 |
| Portfolio ESG score at or below minimum | HARD DENY — SOE blocks |

**Rationale:** SFDR Article 8/9 breaches expose AssetCo to regulatory sanction and reputational harm with ESG-focused institutional clients. Near-breach proximity is an early warning requiring PM attention.

---

#### Factor 4: Mandate Deviation

Measures deviation between the proposed allocation and the client's IPS benchmark allocation.

| Condition | Risk Score |
|---|---|
| Active risk (tracking error) within 50% of IPS tracking error budget | 0 |
| Active risk 50–75% of budget | 1–3 |
| Active risk 75–90% of budget | 4–8 |
| Active risk 90–100% of budget | 9–15 |
| Active risk exceeds IPS tracking error ceiling | HARD DENY |

**Rationale:** Excessive tracking error deviation from the benchmark represents a breach of the client's agreed mandate parameters — a fiduciary risk under both SEC Advisers Act and MiFID II suitability.

---

#### Factor 5: Factor Tilt Magnitude

Measures unintended factor exposure introduced by the proposed allocation (relative to mandate's target factor profile).

| Condition | Risk Score |
|---|---|
| All factor exposures within 0.1 SD of target | 0 |
| One or more factors 0.1–0.2 SD from target | 1–3 |
| One or more factors 0.2–0.4 SD from target | 4–7 |
| One or more factors >0.4 SD from target (material unintended tilt) | 8–12 |

**Rationale:** Unintended factor tilts may cause unexpected tracking error, performance attribution gaps, and mandate non-compliance. Factor-analyst feeds factor constraint recommendations to the optimizer; systematic high-tilt scores indicate the optimizer is not properly incorporating these constraints.

---

#### Factor 6: Cross-Mandate Correlation

Measures whether the proposed allocation increases systemic concentration risk across multiple mandates simultaneously.

| Condition | Risk Score |
|---|---|
| Proposed position is not correlated with positions in other mandates | 0 |
| Moderate cross-mandate correlation (r > 0.4 to >25% of mandates with similar position) | 2–5 |
| High cross-mandate correlation (r > 0.7 to >50% of mandates) | 6–12 |
| Systemic concentration (same position appearing across mandates representing >$5B AUM) | 13–20 + Beacon alert |

**Rationale:** AlphaEngine manages optimization across hundreds of mandates. If the optimizer systematically pushes many mandates into the same position, AssetCo faces firm-level concentration risk not visible at the individual mandate level. This is a cross-agent pattern that Beacon monitors.

---

### 2.2 Risk Budget Consumption

| Agent | Daily Limit | Soft Threshold (per call) | Hard Block |
|---|---|---|---|
| portfolio-optimizer | 500 points | 25 points → Sentinel AI review | >500 cumulative → block session |
| rebalancer | 300 points | 15 points → Sentinel AI review | >300 cumulative → block session |
| allocation-advisor | 200 points | 20 points → Sentinel AI review | >200 cumulative → block session |
| factor-analyst | 400 points | 10 points → Sentinel AI review | >400 cumulative → block session |

**Budget reset:** Daily at 00:00 UTC.

**Trajectory analysis:** Arbiter monitors the rate of budget consumption within a session. If >50% of the daily budget is consumed in the first hour of a session (abnormal acceleration), Arbiter flags the trajectory and notifies the platform team. This may indicate a loop condition or an optimization run with unusually high constraint strain.

---

## 3. Audit Classification Model

### 3.1 Event Taxonomy

Chronicle classifies every AlphaEngine event into one of the following categories. All events are immutable, append-only, and retained for 7 years per SEC Rule 204-2.

#### Category: PORTFOLIO_OPTIMIZATION

Logged for every portfolio-optimizer invocation that produces an output.

| Field | Description |
|---|---|
| `eventType` | `PORTFOLIO_OPTIMIZATION` |
| `agentId` | `alpha-engine/portfolio-optimizer` |
| `optimizationRunId` | Unique run identifier |
| `mandateId` | Client mandate reference |
| `optimizationMode` | `MEAN_VARIANCE`, `RISK_PARITY`, `FACTOR_TARGETED` |
| `inputSignalVersions` | Version/timestamp of alpha signals and ESG scores used |
| `activeConstraints` | All IPS constraints active at time of run |
| `bindingConstraints` | Constraints that were actively binding (prevented a preferred allocation) |
| `objectiveFunctionValue` | Optimization objective achieved |
| `factorContributions` | Factor decomposition of expected active return |
| `ipsVersion` | Version of IPS document applied |
| `agentVersion` | SOE definition version |
| `riskScore` | Arbiter risk score for this run |

---

#### Category: REBALANCE_TRIGGER

Logged when the rebalancer detects drift exceeding threshold and generates a trade list.

| Field | Description |
|---|---|
| `eventType` | `REBALANCE_TRIGGER` |
| `agentId` | `alpha-engine/rebalancer` |
| `rebalanceRunId` | Unique rebalance run ID |
| `mandateId` | Client mandate reference |
| `driftMeasurement` | Maximum security weight deviation at trigger time |
| `driftThreshold` | Configured threshold for mandate |
| `triggerSecurities` | ISINs that breached drift threshold |
| `estimatedTransactionCost` | Estimated cost of rebalancing trade list |
| `taxLotMethod` | FIFO / LIFO / SPECIFIC_ID (if applicable) |
| `tradeListId` | Reference to trade list written to trading/trade-lists/ |

---

#### Category: ALLOCATION_PROPOSAL

Logged for every allocation-advisor proposal output. Includes a separate sub-event when human approval is recorded.

| Field | Description |
|---|---|
| `eventType` | `ALLOCATION_PROPOSAL` / `ALLOCATION_PROPOSAL_APPROVED` |
| `agentId` | `alpha-engine/allocation-advisor` |
| `proposalId` | Unique proposal identifier |
| `mandateId` | Client mandate reference |
| `macroRegime` | Macro regime classification at time of proposal |
| `proposedAssetClassWeights` | Cross-asset-class allocation targets |
| `ipsConstraintsActive` | IPS constraints applied to proposal |
| `eriisaRationaleIncluded` | Boolean — ERISA mandate rationale document attached |
| `humanApprovalEvent` | (Sub-event) `approverIdentity`, `approvalTimestamp` |
| `promotedToActive` | Boolean — whether proposal was subsequently activated |

---

#### Category: FACTOR_ANALYSIS

Logged for every factor-analyst computation cycle.

| Field | Description |
|---|---|
| `eventType` | `FACTOR_ANALYSIS` |
| `agentId` | `alpha-engine/factor-analyst` |
| `reportId` | Factor report identifier |
| `portfolioId` | Portfolio analyzed |
| `factorExposures` | 5-factor exposure vector |
| `benchmarkRelativeExposures` | Active factor tilts vs. benchmark |
| `untendedTiltsDetected` | List of factors with exposure >0.2 SD from target |
| `constraintRecommendations` | Factor constraints recommended to optimizer |

---

#### Category: FIDUCIARY_CONSTRAINT_ENFORCED

Logged every time the SOE gate blocks an action due to a fiduciary constraint violation attempt.

| Field | Description |
|---|---|
| `eventType` | `FIDUCIARY_CONSTRAINT_ENFORCED` |
| `agentId` | Agent that attempted the constrained action |
| `constraintType` | `CONCENTRATION_LIMIT`, `ESG_FLOOR`, `TRACKING_ERROR_CEILING`, `ASSET_CLASS_ELIGIBILITY`, `PAI_EXCLUSION` |
| `proposedValue` | The value the agent attempted to write |
| `limitValue` | The IPS limit that was violated |
| `mandateId` | Mandate reference |
| `decision` | `DENY` |
| `escalated` | Boolean — whether escalated to Sentinel AI |

---

#### Category: IPS_VIOLATION_ATTEMPT

Logged specifically for attempts to write allocations that would breach the IPS. Separate from general fiduciary constraint enforcement to allow dedicated compliance reporting.

| Field | Description |
|---|---|
| `eventType` | `IPS_VIOLATION_ATTEMPT` |
| `agentId` | Agent that attempted the violation |
| `ipsClause` | The specific IPS clause that would have been breached |
| `proposedAllocation` | Proposed weight or allocation |
| `ipsLimit` | Defined limit in the mandate |
| `severity` | `WARNING` (75–90% of limit) / `CRITICAL` (>90% of limit) / `BREACH` (at or above limit) |

---

#### Category: CHINESE_WALL_BLOCK

Logged if any AlphaEngine agent attempts to access a pre-publication research path.

| Field | Description |
|---|---|
| `eventType` | `CHINESE_WALL_BLOCK` |
| `agentId` | Agent that attempted the access |
| `attemptedPath` | Path the agent attempted to read |
| `deniedPattern` | SOE readDeny pattern that matched |
| `decision` | `DENY` |
| `escalated` | `true` — all chinese wall block attempts are auto-escalated to CCO notification queue |

---

### 3.2 Compliance Report Mapping

| Regulatory Examination | Primary Chronicle Events Used |
|---|---|
| SEC examination — investment decision records | `PORTFOLIO_OPTIMIZATION`, `ALLOCATION_PROPOSAL`, `ALLOCATION_PROPOSAL_APPROVED` |
| SEC examination — fiduciary duty documentation | `FIDUCIARY_CONSTRAINT_ENFORCED`, `IPS_VIOLATION_ATTEMPT` |
| MiFID II suitability audit | `PORTFOLIO_OPTIMIZATION` (activeConstraints + ipsVersion fields), `ALLOCATION_PROPOSAL` |
| SFDR Article 8/9 compliance | `PORTFOLIO_OPTIMIZATION` (ESG score fields), `FIDUCIARY_CONSTRAINT_ENFORCED` (ESG_FLOOR type) |
| ERISA fiduciary examination | `ALLOCATION_PROPOSAL` (eriisaRationaleIncluded field), `ALLOCATION_PROPOSAL_APPROVED` |
| EU AI Act Art.14 human oversight audit | `ALLOCATION_PROPOSAL_APPROVED` (humanApprovalEvent field) |
| Information barrier breach investigation | `CHINESE_WALL_BLOCK` |
| SR 11-7 model performance review | `PORTFOLIO_OPTIMIZATION` (full time series for backtesting) |

---

### 3.3 Retention Schedule

| Event Category | Retention Period | Authority |
|---|---|---|
| All investment decision events | 7 years | SEC Rule 204-2 (17 CFR 275.204-2) |
| IPS violation attempts | 7 years | SEC Rule 204-2 + internal model risk requirement |
| ERISA allocation proposals | 7 years | ERISA §107 records retention |
| SFDR compliance events | 10 years | SFDR RTS (Commission Delegated Regulation 2022/1288) |
| Chinese wall block events | 7 years | SEC information barrier program requirements |
| Factor analysis reports | 5 years | SR 11-7 model performance monitoring |

All audit events are stored in append-only Chronicle storage. Immutability is enforced at the infrastructure layer — no agent, no human operator, and no administrative process can modify or delete an audit event after it is written. Record deletion requests (e.g., under GDPR right-to-erasure) are satisfied through pseudonymization of client-identifiable fields in a separate client data layer; the audit trail investment decision records are retained in full as required by the applicable financial regulation, which takes precedence over GDPR Art.17(3)(b) where conflicting.
