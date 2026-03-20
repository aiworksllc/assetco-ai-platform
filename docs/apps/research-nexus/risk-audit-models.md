# ResearchNexus — Risk and Audit Models

**Application:** ResearchNexus
**Document:** risk-audit-models.md
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** CCO David Okonkwo, Model Risk Sarah Nakamura
**Audience:** Risk Management, Compliance Technology, Internal Audit, External Auditors
**Sentinel-Ops Components:** Arbiter (risk scoring), Chronicle (audit trail), Beacon (anomaly detection)

---

## 1. Risk Model

### 1.1 Risk Philosophy

ResearchNexus has the most consequential risk profile in the AssetCo AI Platform — not because any single output is immediately impactful, but because information barrier failures in research propagate into irreversible downstream harms: front-running liability, regulatory enforcement, and destruction of client trust. The risk model therefore assigns asymmetric severity to information barrier proximity events and treats any chinese wall access attempt as a CRITICAL risk event requiring immediate escalation, regardless of whether data was actually read.

Arbiter evaluates cumulative risk trajectory across each research agent's DAG run. It does not merely score individual events — it identifies trajectories that suggest a systematic attempt to access trading data across multiple tool calls, none of which individually exceeds a threshold.

### 1.2 Risk Factors

#### RF-01: Chinese Wall Proximity
**Definition:** Any tool call by a ResearchNexus agent that targets a path matching `trading/**`, `orders/**`, `executions/**`, `positions/**`, or `portfolios/model/**`.

**Severity:** CRITICAL (unconditional)
**Action:** BLOCK_AND_ESCALATE immediately
**Rationale:** There is no legitimate research function that requires trading position or order data. Any access attempt — whether caused by a model hallucination, prompt injection, software error, or deliberate action — is an information barrier violation attempt. The intent does not affect the severity classification.

**Arbiter trajectory signal:** Arbiter flags any run where two or more read attempts targeting different trading-related paths occur within the same DAG session, even if individually blocked. A pattern of probing across multiple denied paths is treated as a higher-order threat indicator.

| Proximity Level | Example | Severity |
|---|---|---|
| Direct read attempt on denied path | Read `positions/equity-book.json` | CRITICAL |
| Indirect probe (enumerating directory structure) | Glob `positions/**` | CRITICAL |
| Bash command that queries trading system | `curl https://bloomberg-oms/positions` | CRITICAL |
| Write attempt to trading path | Write `orders/new-order.json` | CRITICAL |

---

#### RF-02: Pre-Publication Data Leakage Attempt
**Definition:** Any mechanism by which a ResearchNexus agent attempts to make pre-publication research accessible to downstream applications outside the publication workflow.

**Severity:** HIGH
**Action:** BLOCK and alert compliance

**Leakage vectors monitored:**
- Write attempt to `research/published/**` (direct SOE deny on all ResearchNexus agents)
- Attempt to copy or symlink pre-publication outputs to non-RESTRICTED paths
- Bash command that reads from `research/pre-publication/**` and pipes to a path readable by downstream applications
- Attempt to transmit research content via Slack, email, or external API before publication

**Arbiter trajectory signal:** A single blocked leakage attempt is HIGH severity. A second blocked attempt of a different type within 24 hours escalates to CRITICAL and triggers human investigation.

---

#### RF-03: ESG Data Quality Degradation
**Definition:** PAI indicator computation using data that is stale, missing, or sourced from an unvalidated provider.

**Severity:** MEDIUM (data gap) → HIGH (affects SFDR disclosure)

**Risk factors:**
- Stale data: PAI indicator value computed from data older than 12 months (SFDR requires "best efforts" recent data)
- Missing data: PAI indicator not computable due to data unavailability; estimated value used without disclosure
- Provider outage: MSCI ESG, Sustainalytics, or CDP API unavailable for >24 hours; esg-scorer falls back to cached data
- Data version mismatch: Different PAI report sections computed from different data vintages for the same fund

**Arbiter scoring:** ESG data quality score is a continuous Arbiter metric. When data coverage for a fund falls below 70% of required PAI indicators (i.e., more than 30% are estimated or missing), Arbiter raises a data quality alert to Dr. Sharma's team. Coverage below 50% blocks SFDR disclosure generation until data is remediated.

---

#### RF-04: Sentiment Signal Manipulation
**Definition:** Anomalous patterns in sentiment-analyzer inputs or outputs suggesting data manipulation, prompt injection, or model exploitation.

**Severity:** HIGH

**Beacon detection patterns:**
- Sudden sentiment signal reversal (>80% change in sentiment direction across >20 securities within 1 hour) without corresponding news volume increase — suggests model input manipulation
- Sentiment scores clustered at extreme values (>90% of outputs at max bullish or max bearish) — suggests model output manipulation
- Anomalous social media volume spike correlated with sentiment signal output timing — suggests adversarial coordination
- Prompt injection in news feed input: structured text in news content attempting to override agent instructions

**Action:** HOLD sentiment-analyzer output; flag to Dr. Sharma for human review before any publication gate advancement.

---

#### RF-05: Fair Value Model Deviation
**Definition:** fair-value-modeler outputs that deviate materially from independent pricing sources or prior period valuations without documented justification.

**Severity:** MEDIUM (review required) → HIGH (material NAV impact)

**Deviation thresholds:**
- Level 2 asset: fair value estimate deviates >5% from independent pricing service mark without documented input change
- Level 3 asset: fair value estimate deviates >10% from prior quarter estimate without documented new transaction or market evidence
- Fund-level NAV impact: aggregate fair value changes would affect fund NAV by >0.5% if accepted without review

**Arbiter action:** Flag for Model Risk review (Sarah Nakamura) before any valuation output is advanced through the publication workflow.

---

### 1.3 Risk Budget State Machine

Each ResearchNexus agent's risk budget follows the Arbiter risk state machine:

```
NORMAL (budget: >50% remaining)
  │  Routine NLP, ESG, sentiment, valuation processing
  │
  ▼
ELEVATED (budget: 20–50% remaining)
  │  High processing volume; no violations detected
  │  Arbiter monitoring interval doubles
  │
  ▼
RESTRICTED (budget: <20% remaining OR any HIGH severity event)
  │  Agent continues operating; all writes require Arbiter counter-signature
  │  Human supervisor notified
  │
  ▼
SUSPENDED (budget: 0 OR any CRITICAL severity event)
    Agent halted for current session; human review required to resume
    All pending outputs held in pre-publication; not advanced to review
    Chronicle generates SUSPENSION event for compliance record
```

---

## 2. Audit Model

### 2.1 Audit Categories

Chronicle records every ResearchNexus event in immutable append-only audit logs partitioned by agent and date. The following audit categories are defined for ResearchNexus:

| Category | Description | Default Severity | Retention |
|---|---|---|---|
| `research-generation` | Agent writes a new research output to pre-publication directory | INFO | 5 years |
| `esg-scoring` | esg-scorer computes PAI indicators or EU Taxonomy alignment for a security or fund | INFO | 7 years |
| `sentiment-signal` | sentiment-analyzer generates a sentiment signal for a security | INFO | 5 years |
| `fair-value-estimate` | fair-value-modeler writes a new valuation to pre-publication directory | INFO | 10 years |
| `publication-gate-transition` | A research item advances through a publication workflow step | INFO / HIGH | 5 years |
| `chinese-wall-violation-attempt` | Any read or write attempt against a denied trading path | CRITICAL | 10 years |
| `pre-publication-leakage-attempt` | Any attempt to make pre-publication data accessible outside workflow | HIGH | 10 years |
| `esg-data-quality-alert` | PAI computation falls below coverage or freshness threshold | MEDIUM | 7 years |
| `fair-value-deviation-alert` | Fair value estimate deviates beyond model deviation threshold | MEDIUM | 10 years |
| `sentiment-anomaly` | Beacon detects anomalous sentiment signal pattern | HIGH | 5 years |
| `agent-suspension` | Arbiter suspends an agent due to budget exhaustion or CRITICAL event | CRITICAL | 10 years |
| `model-version-change` | Any change to agent model version recorded at session start | INFO | 5 years |

---

### 2.2 Chinese Wall Violation Attempt — Audit Record Schema

Chinese wall violation attempts are the highest-stakes audit event in the ResearchNexus model. Chronicle records a structured event immediately on detection (before any research processing continues):

```json
{
  "eventId": "uuid-v4",
  "timestamp": "ISO-8601",
  "category": "chinese-wall-violation-attempt",
  "severity": "CRITICAL",
  "agent": "market-analyst",
  "session": "session-uuid",
  "dagRunId": "run-uuid",

  "violation": {
    "attemptedPath": "positions/equity-book/long-positions.json",
    "pathCategory": "positions",
    "matchedDenyRule": "positions/**",
    "denySource": "research-nexus-base",
    // denySource identifies that this was the inherited chinese wall policy,
    // not an agent-specific rule — critical for audit trail traceability

    "toolType": "Read",
    "toolCall": {
      "file_path": "positions/equity-book/long-positions.json"
    },
    "blockDecision": "BLOCK",
    "decisionLatencyMs": 0.4
    // Deterministic pre-filter: <1ms block, no AI evaluation
  },

  "context": {
    "precedingToolCalls": 12,
    "taskPromptHash": "sha256-hash",
    // Hashed prompt for integrity; not the prompt itself (may contain MNPI)
    "sessionRiskScore": 45,
    "priorViolationAttemptsThisSession": 0
  },

  "escalation": {
    "routedTo": "ComplianceShield",
    "alertedPersonnel": ["cco@assetco.com", "compliance-tech@assetco.com"],
    "escalationTimestamp": "ISO-8601",
    "requiredAction": "human-review-before-agent-resume"
  }
}
```

---

### 2.3 Publication Gate Transition — Audit Record Schema

Every step in the publication workflow is recorded as an immutable Chronicle event. The full chain from generation to downstream access is reconstructable from these events:

```json
{
  "eventId": "uuid-v4",
  "timestamp": "ISO-8601",
  "category": "publication-gate-transition",
  "severity": "INFO",
  "researchItemId": "RN-2026-0342",

  "transition": {
    "fromState": "pre-publication",
    "toState": "under-review",
    "transitionType": "research-manager-review-initiated",
    "actor": "human:priya.sharma@assetco.com",
    "actorRole": "ResearchManager"
  },

  "researchItem": {
    "itemType": "earnings-analysis",
    "security": "AAPL",
    "generatingAgent": "market-analyst",
    "generationTimestamp": "ISO-8601",
    "prePublicationPath": "research/pre-publication/analysis/AAPL/2026-Q1-earnings.json",
    "documentHash": "sha256-hash"
    // Hash of the research content at generation time — detects any modification
    // during pre-publication period (immutability verification)
  }
}
```

The publication chain events: `pre-publication` → `under-review` → `ic-presented` → `cco-approved` → `published`. Each transition records the human actor, role, and timestamp. The time delta between `pre-publication` and `published` is the pre-publication holding period — a key Reg FD audit metric.

---

### 2.4 Fair Value Audit Record Schema

fair-value-modeler outputs generate an extended audit record satisfying ASC 820 documentation requirements:

```json
{
  "eventId": "uuid-v4",
  "timestamp": "ISO-8601",
  "category": "fair-value-estimate",
  "severity": "INFO",

  "asset": {
    "securityId": "internal-id",
    "isin": "ISIN-if-applicable",
    "assetClass": "private-credit",
    "assetDescription": "Senior secured term loan — Borrower XYZ",
    "fvHierarchyLevel": 3
  },

  "valuation": {
    "valuationDate": "2026-03-31",
    "fairValueEstimate": 94.5,
    // Price per $100 face
    "fairValueRange": { "low": 91.0, "mid": 94.5, "high": 97.5 },
    "currency": "USD",
    "valuationTechnique": "market-approach",
    "techniqueRationale": "Sufficient comparable transaction data available in leveraged loan market",

    "significantUnobservableInputs": [
      {
        "input": "credit-spread",
        "value": 425,
        "unit": "bps",
        "rangeUsed": { "low": 375, "high": 475 },
        "source": "comparable-transactions-database"
      },
      {
        "input": "recovery-rate",
        "value": 0.72,
        "rangeUsed": { "low": 0.65, "high": 0.80 },
        "source": "historical-leveraged-loan-recoveries"
      }
    ],

    "sensitivityAnalysis": {
      "creditSpreadPlus10pct": { "fairValue": 91.2, "change": -3.3 },
      "creditSpreadMinus10pct": { "fairValue": 97.8, "change": 3.3 },
      "recoveryRatePlus10pct": { "fairValue": 95.9, "change": 1.4 }
    }
  },

  "validation": {
    "humanValidationRequired": true,
    "validationStatus": "pending",
    "navWriteBlocked": true
    // SOE deny on NAV/accounting writes remains active until
    // human validation is recorded in a separate Chronicle event
  }
}
```

---

### 2.5 Retention Schedule

| Audit Category | Retention Period | Regulatory Basis |
|---|---|---|
| `research-generation`, `sentiment-signal` | 5 years | SEC Rule 204-2 (investment adviser books and records) |
| `publication-gate-transition` | 5 years | SEC Rule 204-2 |
| `esg-scoring`, `esg-data-quality-alert` | 7 years | SFDR Art.4 PAI disclosure retention; ESMA guidelines on sustainability disclosures |
| `fair-value-estimate`, `fair-value-deviation-alert` | 10 years | ASC 820 / IFRS 13 fair value documentation; typical external audit retention expectation |
| `chinese-wall-violation-attempt` | 10 years | MAR Art.7/8 insider dealing investigation support; Reg FD enforcement record |
| `pre-publication-leakage-attempt` | 10 years | Same — potential securities law violation record |
| `agent-suspension` | 10 years | EU AI Act Art.12 traceability; internal investigation record |
| `model-version-change` | Duration of model deployment + 5 years | EU AI Act Art.12 (model version traceability for audit of historical outputs) |

All audit records are stored in Chronicle's append-only event store (S3 with Object Lock in COMPLIANCE mode — no delete or overwrite permitted, including by Sentinel-Ops SOE agents themselves).

---

### 2.6 Compliance Reporting Outputs

Chronicle generates the following scheduled reports for ResearchNexus:

| Report | Frequency | Audience | Content |
|---|---|---|---|
| Chinese Wall Integrity Report | Weekly | CCO, Compliance Technology | Count of violation attempts (should be 0); any CRITICAL events; agent suspension events |
| Publication Gate Activity Report | Monthly | Head of Research, CCO | Research items in each workflow state; average pre-publication holding period; items published; downstream access log |
| SFDR Data Quality Report | Quarterly | CCO, Head of ESG | PAI indicator coverage by fund; data freshness; estimated vs. reported data ratio; provider availability events |
| Fair Value Model Validation Summary | Quarterly | Model Risk, CFO, External Auditors | Level 3 universe; valuation technique distribution; deviation alerts; human validation completion status |
| EU AI Act Traceability Ledger | On demand | Regulatory Affairs, External Regulators | Full input-to-output chain for any specified research item; model versions; human review events |

---

*This document is part of the AssetCo AI Platform documentation suite. Risk and audit models should be reviewed by Internal Audit and External Auditors before reliance for regulatory purposes.*
