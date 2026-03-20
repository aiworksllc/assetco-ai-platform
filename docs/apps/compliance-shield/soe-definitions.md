# ComplianceShield — SOE Definitions

**Application:** ComplianceShield
**SOE Version:** 1.0
**Last reviewed:** CCO David Okonkwo
**Enforcement mode:** Full Enforce (shadow mode prohibited — compliance surveillance must be live)

---

## Design Principles

ComplianceShield SOE definitions encode two non-negotiable constraints:

1. **Surveillance mandate:** The firm's compliance program requires that ComplianceShield agents can see everything relevant to regulatory compliance. Read scope is deliberately broad. Any restriction that creates a surveillance gap is a regulatory liability.

2. **Write separation:** ComplianceShield agents can never modify the data they observe. This is not an operational policy — it is a legal and ethical requirement. An agent that can both observe and modify trading data creates the conditions for evidence tampering. SOE enforces this at the gate level, not through policy documents.

All four SOE definitions below follow the same pattern: broad read, minimal write, strictly scoped tool actions.

---

## Agent: trade-surveiller

```json
{
  "agent": "trade-surveiller",
  "application": "compliance-shield",
  "version": "1.0",
  "description": "Real-time trade surveillance. Broadest read scope in the firm. Zero write to trading systems.",
  "enforcement": {
    "mode": "full",
    "failBehavior": "DENY",
    "auditAll": true
  },
  "identity": {
    "role": "ComplianceSurveillance",
    "allowedPersonas": ["trade-surveiller"],
    "authorityLevel": "surveillance-read-only",
    "environmentScope": ["production"],
    "note": "production-only — surveillance of a non-production environment has no regulatory value"
  },
  "dataAccess": {
    "readAllow": [
      "trading/**",
      "orders/**",
      "executions/**",
      "positions/**",
      "risk-compass/alerts/**",
      "research-nexus/publications/metadata/**",
      "ops-fabric/settlement/**",
      "alpha-engine/orders/**",
      "alpha-engine/signals/metadata/**",
      "trade-sentinel/blotter/**",
      "compliance/surveillance/**"
    ],
    "readDeny": [
      "**/client-pii/**",
      "**/ssn/**",
      "**/passport/**",
      "**/personal-address/**",
      "deal-room/**",
      "**/mnpi/**",
      "**/advisory-mandates/**",
      "advisor-lens/client-profiles/full/**",
      "note: client account identifiers (LEI, account number) are permitted for wash trade detection; biographical PII is not"
    ],
    "writeAllow": [
      "compliance/surveillance/alerts/**",
      "compliance/surveillance/str-candidates/**",
      "compliance/surveillance/pattern-logs/**"
    ],
    "writeDeny": [
      "trading/**",
      "orders/**",
      "executions/**",
      "positions/**",
      "alpha-engine/**",
      "trade-sentinel/**",
      "ops-fabric/**",
      "risk-compass/**",
      "**"
    ],
    "writeDenyNote": "writeDeny /** is a catch-all backstop. If a path is not in writeAllow, it is denied. Explicit enumeration of known systems is belt-and-suspenders."
  },
  "toolActions": {
    "bash": {
      "allow": [
        "node compliance/surveillance/alert-generator *",
        "node compliance/surveillance/str-writer *",
        "node compliance/surveillance/pattern-detector *"
      ],
      "deny": [
        "curl * trade-sentinel *",
        "curl * alpha-engine *",
        "curl * ops-fabric * --method POST *",
        "curl * ops-fabric * --method PUT *",
        "curl * ops-fabric * --method DELETE *",
        "* cancel-order *",
        "* modify-order *",
        "* book-trade *",
        "rm *",
        "DELETE *",
        "DROP *"
      ]
    },
    "edit": {
      "allowPaths": [
        "compliance/surveillance/**"
      ],
      "denyPaths": [
        "trading/**",
        "orders/**",
        "executions/**",
        "positions/**",
        "alpha-engine/**",
        "trade-sentinel/**",
        "ops-fabric/**"
      ]
    },
    "mcp": {
      "allowTools": [
        "context_write",
        "slack_post_message"
      ],
      "denyTools": [
        "jira_update_issue",
        "context_update_task"
      ]
    }
  },
  "riskBudget": {
    "sessionLimit": 500,
    "decayRate": 0.05,
    "highRiskThreshold": 300,
    "note": "Trade surveillance runs continuously during market hours. Higher session limit than most agents. Decay rate ensures accumulated risk from broad reads does not permanently tighten the envelope."
  }
}
```

---

## Agent: position-reporter

```json
{
  "agent": "position-reporter",
  "application": "compliance-shield",
  "version": "1.0",
  "description": "Generates regulatory position reports. Reads positions, writes reports. No modification of source data.",
  "enforcement": {
    "mode": "full",
    "failBehavior": "DENY",
    "auditAll": true
  },
  "identity": {
    "role": "ComplianceReporting",
    "allowedPersonas": ["position-reporter"],
    "authorityLevel": "reporting-read-only",
    "environmentScope": ["production"]
  },
  "dataAccess": {
    "readAllow": [
      "positions/**",
      "ops-fabric/positions/**",
      "ops-fabric/settlement/confirmed/**",
      "trade-sentinel/executions/**",
      "risk-compass/netting-sets/**",
      "risk-compass/counterparty/**",
      "fund-registry/**",
      "entity-registry/**",
      "compliance/reports/**",
      "compliance/surveillance/summaries/**"
    ],
    "readDeny": [
      "**/client-pii/**",
      "**/personal-address/**",
      "**/ssn/**",
      "deal-room/**",
      "**/mnpi/**",
      "alpha-engine/strategies/**",
      "note: position-reporter needs to know what positions exist and their attributes, not the strategies that generated them"
    ],
    "writeAllow": [
      "compliance/reports/positions/**",
      "compliance/reports/transactions/**",
      "compliance/reports/13f/**",
      "compliance/reports/form-pf/**",
      "compliance/reports/focus/**"
    ],
    "writeDeny": [
      "positions/**",
      "ops-fabric/**",
      "trade-sentinel/**",
      "alpha-engine/**",
      "risk-compass/**",
      "compliance/filings/**",
      "**"
    ]
  },
  "toolActions": {
    "bash": {
      "allow": [
        "node compliance/reporters/emir-tr-generator *",
        "node compliance/reporters/mifir-rts25-generator *",
        "node compliance/reporters/cftc-large-trader *",
        "node compliance/reporters/sec-13f-generator *",
        "node compliance/reporters/finra-focus-generator *"
      ],
      "deny": [
        "* modify-position *",
        "* book-trade *",
        "* update-settlement *",
        "curl * --method POST * positions *",
        "curl * --method PUT * positions *",
        "rm *"
      ]
    },
    "edit": {
      "allowPaths": [
        "compliance/reports/**"
      ],
      "denyPaths": [
        "positions/**",
        "ops-fabric/**",
        "trade-sentinel/**",
        "compliance/filings/**"
      ]
    }
  },
  "riskBudget": {
    "sessionLimit": 200,
    "decayRate": 0.1,
    "highRiskThreshold": 150,
    "note": "position-reporter runs on a scheduled basis (daily, T+1). Lower session limit appropriate for batch report generation pattern."
  }
}
```

---

## Agent: breach-detector

```json
{
  "agent": "breach-detector",
  "application": "compliance-shield",
  "version": "1.0",
  "description": "Monitors SOE logs, risk breaches, and information barrier violations. Escalates to humans. Cannot remediate.",
  "enforcement": {
    "mode": "full",
    "failBehavior": "DENY",
    "auditAll": true
  },
  "identity": {
    "role": "ComplianceMonitoring",
    "allowedPersonas": ["breach-detector"],
    "authorityLevel": "monitor-and-escalate",
    "environmentScope": ["production"],
    "note": "monitor-and-escalate authority level is lower than enforcement. This agent can see and alert; it cannot act."
  },
  "dataAccess": {
    "readAllow": [
      "sentinel-ops/audit-logs/**",
      "sentinel-ops/soe-violations/**",
      "sentinel-ops/deny-events/**",
      "risk-compass/alerts/**",
      "risk-compass/limit-breaches/**",
      "ops-fabric/access-logs/**",
      "information-barrier/crossing-attempts/**",
      "information-barrier/logs/**",
      "compliance/surveillance/alerts/**",
      "compliance/alerts/**",
      "compliance/escalations/**"
    ],
    "readDeny": [
      "**/client-pii/**",
      "deal-room/**",
      "**/mnpi/content/**",
      "note: breach-detector may read THAT an MNPI barrier was crossed, but not WHAT the MNPI content was. The log entry suffices for the alert; the content itself would create new information barrier exposure."
    ],
    "writeAllow": [
      "compliance/alerts/**",
      "compliance/escalations/**"
    ],
    "writeDeny": [
      "sentinel-ops/soe-definitions/**",
      "sentinel-ops/meta-soe/**",
      "risk-compass/**",
      "information-barrier/**",
      "ops-fabric/**",
      "trading/**",
      "positions/**",
      "**"
    ],
    "writeDenyNote": "breach-detector cannot modify SOE definitions, risk limits, information barriers, or any operational system. It observes and alerts only."
  },
  "toolActions": {
    "bash": {
      "allow": [
        "node compliance/breach-detector/alert-writer *",
        "node compliance/breach-detector/escalation-generator *",
        "node compliance/breach-detector/severity-classifier *"
      ],
      "deny": [
        "* modify-soe *",
        "* update-risk-limit *",
        "* terminate-agent *",
        "* block-agent *",
        "* update-information-barrier *",
        "* modify-position *",
        "curl * --method POST * soe-definitions *",
        "curl * --method PUT * soe-definitions *",
        "rm *"
      ]
    },
    "edit": {
      "allowPaths": [
        "compliance/alerts/**",
        "compliance/escalations/**"
      ],
      "denyPaths": [
        "sentinel-ops/**",
        "risk-compass/**",
        "information-barrier/**",
        "ops-fabric/**",
        "trading/**"
      ]
    },
    "mcp": {
      "allowTools": [
        "slack_post_message",
        "context_write"
      ],
      "denyTools": [
        "context_update_task",
        "jira_update_issue",
        "note: breach-detector can post alerts to Slack but cannot modify task state or Jira — those are human-controlled"
      ]
    }
  },
  "riskBudget": {
    "sessionLimit": 300,
    "decayRate": 0.08,
    "highRiskThreshold": 200
  }
}
```

---

## Agent: regulatory-filer

```json
{
  "agent": "regulatory-filer",
  "application": "compliance-shield",
  "version": "1.0",
  "description": "Formats regulatory submissions for human sign-off. Write access confined to compliance/filings/** only. Cannot submit — humans submit.",
  "enforcement": {
    "mode": "full",
    "failBehavior": "DENY",
    "auditAll": true
  },
  "identity": {
    "role": "RegulatoryFiling",
    "allowedPersonas": ["regulatory-filer"],
    "authorityLevel": "filing-preparation",
    "environmentScope": ["production"]
  },
  "dataAccess": {
    "readAllow": [
      "compliance/reports/**",
      "compliance/surveillance/summaries/**",
      "compliance/alerts/summaries/**",
      "entity-registry/**",
      "fund-registry/**",
      "compliance/filings/**"
    ],
    "readDeny": [
      "**/client-pii/**",
      "**/ssn/**",
      "**/personal-address/**",
      "trading/**",
      "positions/**",
      "ops-fabric/**",
      "alpha-engine/**",
      "deal-room/**",
      "**/mnpi/**"
    ],
    "writeAllow": [
      "compliance/filings/**"
    ],
    "writeDeny": [
      "compliance/reports/**",
      "trading/**",
      "positions/**",
      "ops-fabric/**",
      "alpha-engine/**",
      "trade-sentinel/**",
      "risk-compass/**",
      "**"
    ],
    "writeDenyNote": "compliance/filings/** is the entire write surface. The agent cannot modify source reports it reads from, cannot touch trading or position data, and cannot write anywhere else in the compliance tree except filings."
  },
  "toolActions": {
    "bash": {
      "allow": [
        "node compliance/filers/emir-tr-formatter *",
        "node compliance/filers/mifir-rts25-formatter *",
        "node compliance/filers/form-pf-formatter *",
        "node compliance/filers/sec-13f-formatter *",
        "node compliance/filers/finra-focus-formatter *",
        "node compliance/filers/validation-runner *",
        "node compliance/filers/status-updater * DRAFT *",
        "node compliance/filers/status-updater * PENDING_REVIEW *"
      ],
      "deny": [
        "* submit-to-esma *",
        "* submit-to-dtcc *",
        "* submit-to-sec *",
        "* submit-to-finra *",
        "* submit-to-cftc *",
        "curl * regulatory-portal *",
        "curl * esma.europa.eu *",
        "curl * sec.gov * --method POST *",
        "curl * finra.org * --method POST *",
        "node compliance/filers/status-updater * SUBMITTED *",
        "node compliance/filers/status-updater * APPROVED *",
        "note: SUBMITTED and APPROVED status transitions are human-only. The agent can set DRAFT and PENDING_REVIEW only."
      ]
    },
    "edit": {
      "allowPaths": [
        "compliance/filings/**"
      ],
      "denyPaths": [
        "compliance/reports/**",
        "trading/**",
        "positions/**",
        "ops-fabric/**",
        "alpha-engine/**"
      ]
    }
  },
  "riskBudget": {
    "sessionLimit": 150,
    "decayRate": 0.1,
    "highRiskThreshold": 100,
    "note": "regulatory-filer has the most constrained risk budget — it operates on a scheduled filing cycle, not continuously. Low session limit is appropriate."
  }
}
```
