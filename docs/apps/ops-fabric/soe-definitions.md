# OpsFabric — SOE Definitions

**Document:** apps/ops-fabric/soe-definitions.md
**Application:** OpsFabric — Post-Trade Operations Automation
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** Maria Torres, COO / Sentinel-Ops Team
**Classification:** Internal — Restricted

---

## 1. Overview

Each OpsFabric agent operates within a formally defined Safe Operating Envelope (SOE) enforced by Sentinel-Ops. The SOE specifies identity, data access, and allowed tool actions. No agent action is taken unless it passes the Sentinel-Ops gate.

OpsFabric has three agents. Their SOEs reflect the principle of least privilege: each agent can read what it needs for its specific function, write only to its designated output namespace, and execute only the tool calls required for its task.

The two most critical SOE constraints in OpsFabric are:
1. **reconciler writeDeny on source records** — enforced at SOE level, not application level
2. **nav-calculator writeDeny on published NAV** — the dual-approval gate is a SOE hard boundary

---

## 2. settlement-processor SOE

```json
{
  "agentId": "settlement-processor",
  "application": "ops-fabric",
  "version": "1.0",
  "description": "Generates and submits settlement instructions to custodians and CCPs. Monitors settlement fails and escalates per CSDR thresholds.",

  "identity": {
    "role": "SettlementOperations",
    "allowedPersonas": ["settlement-processor"],
    "authorityLevel": "settlement-instruction-only",
    "environmentScope": ["production"],
    "humanSupervisor": "maria.torres@assetco.com"
  },

  "dataAccess": {
    "readAllow": [
      "operations/trades/executed/**",
      "operations/settlement/ssi-database/**",
      "operations/settlement/ccp-membership/**",
      "operations/settlement/custodian-connectivity/**",
      "operations/settlement/status/**",
      "operations/corporate-actions/elections/**"
    ],
    "readDeny": [
      "**/client-pii/**",
      "**/client-accounts/**",
      "research/**",
      "risk-models/**",
      "alpha-engine/**",
      "operations/nav/**",
      "operations/reconciliation/**",
      "trading/**"
    ],
    "writeAllow": [
      "operations/settlement/instructions/**",
      "operations/settlement/status/**",
      "operations/settlement/fails/**",
      "operations/settlement/penalties/**"
    ],
    "writeDeny": [
      "operations/positions/**",
      "operations/nav/**",
      "operations/reconciliation/**",
      "trading/**",
      "eagle-pace/**",
      "custodian-records/**"
    ]
  },

  "toolActions": {
    "custodianApi": {
      "allow": [
        "bny-mellon/settlement/submit-instruction",
        "bny-mellon/settlement/query-status",
        "state-street/settlement/submit-instruction",
        "state-street/settlement/query-status",
        "dtcc/settlement/submit",
        "dtcc/settlement/query"
      ],
      "deny": [
        "bny-mellon/custody/amend-position",
        "bny-mellon/custody/delete-*",
        "state-street/custody/amend-position",
        "state-street/custody/**amend**",
        "**/account-management/**",
        "**/client-instruction/**"
      ]
    },
    "ccpApi": {
      "allow": [
        "lch/clearing/submit-novation",
        "lch/clearing/query-status",
        "cme/clearing/submit-novation",
        "cme/clearing/query-status"
      ],
      "deny": [
        "lch/clearing/cancel-*",
        "cme/clearing/cancel-*",
        "**/margin-call/**",
        "**/default-management/**"
      ]
    },
    "bash": {
      "allow": [
        "swift-message-validate *",
        "generate-mt54x --trade-id *",
        "query-ssi-database --counterparty *",
        "calculate-csdr-penalty --isin *"
      ],
      "deny": [
        "rm *",
        "DROP *",
        "**/delete/**",
        "amend-trade *",
        "cancel-trade *"
      ]
    }
  },

  "riskBudget": {
    "dailyLimit": 800,
    "rationale": "High-volume agent — 12,000+ instructions/day requires elevated budget. Each instruction generation is low-risk individually; budget reflects volume, not severity per action.",
    "resetSchedule": "daily-at-midnight-ET",
    "escalateAt": 700,
    "hardLimitAction": "DENY_AND_ESCALATE"
  },

  "settlementDeadlineMonitoring": {
    "enabled": true,
    "t1CutoffET": "21:00",
    "escalateMinutesBefore": 60,
    "escalationTarget": "operations-team-slack-channel"
  }
}
```

**Key design notes:**
- `custodianApi` allow list is endpoint-specific — position amendment endpoints are explicitly denied even though the custodian API is allowed for settlement endpoints
- `riskBudget.dailyLimit` of 800 is high by SOE standards, reflecting the agent's legitimate volume rather than elevated per-action risk
- `settlementDeadlineMonitoring` is an OpsFabric-specific SOE extension — Sentinel-Ops monitors clock proximity to T+1 cutoff and escalates when instructions are still pending within 60 minutes

---

## 3. reconciler SOE

```json
{
  "agentId": "reconciler",
  "application": "ops-fabric",
  "version": "1.0",
  "description": "Daily reconciliation of positions, cash, and corporate actions against custodian records. Classifies breaks by root cause and routes to resolution queues. READ-ONLY access to all source systems.",

  "identity": {
    "role": "ReconciliationAnalysis",
    "allowedPersonas": ["reconciler"],
    "authorityLevel": "read-only-analysis",
    "environmentScope": ["production"],
    "humanSupervisor": "maria.torres@assetco.com"
  },

  "dataAccess": {
    "readAllow": [
      "operations/positions/**",
      "eagle-pace/positions/**",
      "eagle-pace/cash/**",
      "eagle-pace/corporate-actions/**",
      "custodian-records/bny-mellon/positions/**",
      "custodian-records/bny-mellon/cash/**",
      "custodian-records/state-street/positions/**",
      "custodian-records/state-street/cash/**",
      "dtcc/settlement-data/**",
      "operations/corporate-actions/announcements/**",
      "operations/settlement/status/**"
    ],
    "readDeny": [
      "**/client-pii/**",
      "**/client-accounts/**",
      "trading/**",
      "alpha-engine/**",
      "research/**",
      "trading-strategy/**"
    ],
    "writeAllow": [
      "operations/reconciliation/breaks/**",
      "operations/reconciliation/reports/**",
      "operations/reconciliation/escalations/**"
    ],
    "writeDeny": [
      "operations/positions/**",
      "eagle-pace/**",
      "custodian-records/**",
      "operations/settlement/instructions/**",
      "operations/nav/**",
      "trading/**"
    ]
  },

  "toolActions": {
    "analysis": {
      "allow": [
        "classify-break --category *",
        "route-to-queue --break-id * --queue *",
        "generate-reconciliation-report --date *",
        "calculate-break-priority --value * --age *",
        "query-corporate-action --isin *"
      ],
      "deny": [
        "amend-position *",
        "delete-position *",
        "submit-custodian-instruction *",
        "modify-eagle-pace *",
        "correct-record *"
      ]
    },
    "bash": {
      "allow": [
        "compare-positions --internal * --custodian *",
        "identify-breaks --report-date *",
        "export-break-report --format *"
      ],
      "deny": [
        "rm *",
        "UPDATE *",
        "INSERT *",
        "DELETE *",
        "*amend*",
        "*modify*"
      ]
    }
  },

  "riskBudget": {
    "dailyLimit": 500,
    "rationale": "Read-only analytical agent with constrained write scope. Lower budget than settlement-processor reflects lower operational complexity and absence of external API calls.",
    "resetSchedule": "daily-at-midnight-ET",
    "escalateAt": 450,
    "hardLimitAction": "DENY_AND_ESCALATE"
  },

  "sourceRecordImmutability": {
    "enforced": true,
    "description": "reconciler has zero write access to any source system. This constraint exists because reconciliation is a verification function — any modification to the data being verified compromises the integrity of the reconciliation. Sentinel-Ops enforces this at the tool-call level.",
    "violationSeverity": "CRITICAL"
  }
}
```

**Key design notes:**
- `writeDeny` includes `eagle-pace/**` and `custodian-records/**` as top-level denials — any path under these namespaces is blocked regardless of sub-path specificity
- `sourceRecordImmutability` is an explicit SOE metadata field documenting the design intent; Sentinel-Ops uses this in AI reasoning for ambiguous cases
- Tool action deny list uses pattern matching on verb (`amend`, `modify`, `correct`) in addition to specific command names

---

## 4. nav-calculator SOE

```json
{
  "agentId": "nav-calculator",
  "application": "ops-fabric",
  "version": "1.0",
  "description": "Validates NAV pricing inputs, computes preliminary NAV for all funds, flags stale prices and Level 2/3 fair value instruments. Delivers preliminary NAV to human review queue. CANNOT publish NAV.",

  "identity": {
    "role": "NAVCalculation",
    "allowedPersonas": ["nav-calculator"],
    "authorityLevel": "preliminary-nav-only",
    "environmentScope": ["production"],
    "humanSupervisor": "maria.torres@assetco.com"
  },

  "dataAccess": {
    "readAllow": [
      "operations/positions/**",
      "eagle-pace/positions/**",
      "eagle-pace/fund-structure/**",
      "eagle-pace/fee-schedules/**",
      "eagle-pace/corporate-actions/**",
      "pricing/bloomberg/**",
      "pricing/ice-bondpoint/**",
      "pricing/bval/**",
      "pricing/evaluated/**",
      "operations/nav/preliminary/**",
      "operations/nav/pricing-exceptions/**"
    ],
    "readDeny": [
      "**/client-pii/**",
      "**/client-accounts/**",
      "trading/**",
      "operations/trades/**",
      "alpha-engine/**",
      "research/**",
      "operations/settlement/**"
    ],
    "writeAllow": [
      "operations/nav/preliminary/**"
    ],
    "writeDeny": [
      "operations/nav/published/**",
      "operations/positions/**",
      "eagle-pace/**",
      "pricing/**",
      "custodian-records/**",
      "trading/**",
      "operations/settlement/**",
      "operations/reconciliation/**"
    ]
  },

  "toolActions": {
    "computation": {
      "allow": [
        "calculate-nav --fund * --date *",
        "validate-pricing --isin * --source *",
        "flag-stale-price --isin * --age-hours *",
        "classify-fair-value-level --isin *",
        "apply-fee-accrual --fund * --date *",
        "apply-corporate-action --isin * --effective-date *",
        "generate-preliminary-nav-package --fund *",
        "submit-to-review-queue --fund * --nav-date *"
      ],
      "deny": [
        "publish-nav *",
        "approve-nav *",
        "distribute-nav *",
        "submit-nav-to-clients *",
        "override-pricing *",
        "delete-pricing-exception *",
        "modify-position *"
      ]
    },
    "bash": {
      "allow": [
        "fetch-pricing --source bloomberg --isin *",
        "fetch-pricing --source ice --isin *",
        "fetch-pricing --source bval --isin *",
        "compute-accrued-interest --isin * --settlement-date *"
      ],
      "deny": [
        "publish *",
        "distribute *",
        "rm *",
        "UPDATE *",
        "DELETE *"
      ]
    }
  },

  "riskBudget": {
    "dailyLimit": 300,
    "rationale": "Low-volume agent with bounded daily execution — one NAV calculation cycle per fund per day. Budget reflects computation complexity, not instruction volume.",
    "resetSchedule": "daily-at-midnight-ET",
    "escalateAt": 270,
    "hardLimitAction": "DENY_AND_ESCALATE"
  },

  "navPublicationGate": {
    "enabled": true,
    "description": "NAV publication requires dual human approval. nav-calculator cannot write to operations/nav/published/** under any circumstance. Any attempt to write to that path is logged as a CRITICAL SOE violation regardless of intent.",
    "requiredApprovals": [
      {"role": "FundAccountant", "minCount": 1},
      {"role": "OperationsManager", "minCount": 1}
    ],
    "approvalLogging": "Chronicle — append-only, with approver identity and timestamp",
    "violationSeverity": "CRITICAL",
    "violationEscalation": ["maria.torres@assetco.com", "security@assetco.com"]
  }
}
```

**Key design notes:**
- `writeAllow` contains a single entry: `operations/nav/preliminary/**`. This is intentional — the entire NAV publication path is under `writeDeny`
- `navPublicationGate` is an OpsFabric-specific SOE extension field that documents the dual-approval requirement. Sentinel-Ops uses this in AI reasoning for any ambiguous request involving NAV output
- Tool action deny list explicitly names `publish-nav`, `approve-nav`, `distribute-nav` to prevent prompt injection attacks attempting to alias publication actions as something else

---

*Document owner: Maria Torres, COO / Sentinel-Ops Team. SOE changes require joint approval from COO and CISO. Review cycle: Quarterly.*
