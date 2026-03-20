# AdvisorLens — SOE Definitions

**Application:** AdvisorLens
**Document:** soe-definitions.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** Platform Engineering, Compliance Technology, AI Safety

---

## 1. Overview

This document contains the annotated Safe Operating Envelope (SOE) definitions for all three AdvisorLens agents. These definitions are loaded by the Sentinel-Ops gate at agent startup and enforced deterministically at every tool call.

AdvisorLens carries the most restrictive SOE configuration in the AssetCo AI Platform because it operates in the highest-risk regulatory environment: client-facing outputs with fiduciary and GDPR obligations. Key design decisions:

- All three agents are **read-only with respect to client records** — no agent can write to the CRM or modify a portfolio position
- **proposal-generator is draft-only** — its writeAllow is scoped to `advisory/proposals/draft/**`; the delivered path is explicitly denied to enforce the human approval gate
- **Art.52 content guardrail** is an active SOE enforcement mechanism, not a post-hoc audit check — it runs on every write to client-facing output paths
- **Pre-publication research is denied across all three agents** — MNPI isolation is enforced at the infrastructure level, not by convention

---

## 2. suitability-checker SOE Definition

```json
{
  "agentId": "suitability-checker",
  "application": "advisor-lens",
  "version": "1.0",
  "description": "Validates proposed investments against client suitability profile. MiFID II Art.25 compliance gate.",
  "euAiActRiskLevel": "HIGH",

  "identity": {
    "role": "SuitabilityAnalyst",
    "allowedPersonas": ["suitability-checker"],
    "authorityLevel": "read-evaluate-write-results",
    "environmentScope": ["production", "uat"],
    "clientFacing": false
  },

  "dataAccess": {
    "readAllow": [
      "crm/clients/**/risk-profile/**",
      "crm/clients/**/investment-objectives/**",
      "crm/clients/**/restriction-lists/**",
      "crm/clients/**/kyc-summary/**",
      "products/catalog/**",
      "products/risk-ratings/**",
      "regulatory/prohibited-securities/**",
      "regulatory/erisa-restrictions/**",
      "regulatory/mifid-product-classifications/**"
    ],
    "readDeny": [
      "crm/clients/**/ssn",
      "crm/clients/**/tax-id",
      "crm/clients/**/bank-accounts/**",
      "crm/clients/**/payment-details/**",
      "crm/clients/**/trading-history/**",
      "research/pre-publication/**",
      "research/drafts/**",
      "research/embargoed/**",
      "trading/**",
      "orders/**",
      "advisory/proposals/**"
    ],
    "writeAllow": [
      "advisory/suitability-results/**"
    ],
    "writeDeny": [
      "crm/**",
      "clients/**",
      "portfolios/**",
      "orders/**",
      "trading/**",
      "advisory/proposals/**",
      "advisory/reports/**"
    ]
  },

  "toolActions": {
    "bash": {
      "allow": [],
      "deny": ["*"]
    },
    "mcp__crm__*": {
      "allow": [
        "mcp__crm__get_client_profile",
        "mcp__crm__get_risk_tolerance",
        "mcp__crm__get_investment_objectives",
        "mcp__crm__get_restriction_list",
        "mcp__crm__get_kyc_summary"
      ],
      "deny": [
        "mcp__crm__update_*",
        "mcp__crm__create_*",
        "mcp__crm__delete_*",
        "mcp__crm__send_*"
      ]
    },
    "mcp__advisory__*": {
      "allow": [
        "mcp__advisory__write_suitability_result"
      ],
      "deny": [
        "mcp__advisory__send_to_client",
        "mcp__advisory__deliver_proposal",
        "mcp__advisory__email_*"
      ]
    },
    "email": {
      "allow": [],
      "deny": ["*"]
    },
    "slack_post_message": {
      "allow": [],
      "deny": ["*"]
    }
  },

  "contentGuardrails": {
    "outputToClientPaths": [],
    "art52DisclosureRequired": false,
    "piiScrubbing": {
      "enabled": true,
      "scrubFields": ["ssn", "taxId", "bankAccount", "paymentDetails"]
    }
  },

  "riskBudget": {
    "dailyLimit": 500,
    "perActionCost": {
      "suitabilityCheck": 5,
      "highRiskProductCheck": 15,
      "eriasProhibitedTransactionCheck": 20
    },
    "resetSchedule": "00:00 UTC",
    "onBudgetExhausted": "block-and-alert"
  },

  "rateLimiting": {
    "requestsPerMinute": 60,
    "requestsPerHour": 500,
    "backend": "HotCache"
  }
}
```

**Annotation Notes:**
- `readDeny` on SSN, tax-id, bank-accounts, and payment-details is absolute — these fields are not required for suitability assessment and their exposure would constitute GDPR data minimisation violation
- `readDeny` on `trading/**` and `advisory/proposals/**` prevents any feedback loop where prior recommendations could bias the suitability check
- `writeDeny` on `crm/**` is the technical guarantee that suitability-checker is read-only with respect to client data — no KYC record can be altered
- `deny: ["*"]` on email and slack prevents any client communication path whatsoever

---

## 3. proposal-generator SOE Definition

```json
{
  "agentId": "proposal-generator",
  "application": "advisor-lens",
  "version": "1.0",
  "description": "Generates draft investment proposals with mandatory disclosures. All proposals routed to human advisor approval queue — never delivered directly to clients.",
  "euAiActRiskLevel": "HIGH",

  "identity": {
    "role": "ProposalDraftingAgent",
    "allowedPersonas": ["proposal-generator"],
    "authorityLevel": "draft-only",
    "environmentScope": ["production", "uat"],
    "clientFacing": false
  },

  "dataAccess": {
    "readAllow": [
      "advisory/suitability-results/**",
      "research/published/**",
      "research/published-notes/**",
      "market-data/**",
      "alpha-engine/model-portfolios/**",
      "alpha-engine/rebalancing-signals/**",
      "products/fund-data/**",
      "products/fee-schedules/**",
      "products/sfdr-classifications/**",
      "products/cost-disclosure/**"
    ],
    "readDeny": [
      "crm/clients/**/ssn",
      "crm/clients/**/tax-id",
      "crm/clients/**/bank-accounts/**",
      "crm/clients/**/payment-details/**",
      "research/pre-publication/**",
      "research/drafts/**",
      "research/embargoed/**",
      "trading/**",
      "orders/**",
      "advisory/proposals/delivered/**"
    ],
    "writeAllow": [
      "advisory/proposals/draft/**"
    ],
    "writeDeny": [
      "advisory/proposals/delivered/**",
      "advisory/proposals/sent/**",
      "advisory/proposals/approved/**",
      "crm/**",
      "portfolios/**",
      "orders/**",
      "trading/**",
      "advisory/reports/**"
    ]
  },

  "toolActions": {
    "bash": {
      "allow": [],
      "deny": ["*"]
    },
    "mcp__document__*": {
      "allow": [
        "mcp__document__generate_pdf",
        "mcp__document__write_draft",
        "mcp__document__apply_template"
      ],
      "deny": [
        "mcp__document__send_*",
        "mcp__document__email_*",
        "mcp__document__deliver_*"
      ]
    },
    "mcp__advisory__*": {
      "allow": [
        "mcp__advisory__write_proposal_draft",
        "mcp__advisory__notify_advisor_review_queue"
      ],
      "deny": [
        "mcp__advisory__send_to_client",
        "mcp__advisory__deliver_proposal",
        "mcp__advisory__mark_approved",
        "mcp__advisory__email_*"
      ]
    },
    "email": {
      "allow": [],
      "deny": ["*"]
    },
    "slack_post_message": {
      "allow": [],
      "deny": ["*"]
    }
  },

  "contentGuardrails": {
    "outputToClientPaths": [],
    "draftOutputPaths": ["advisory/proposals/draft/**"],
    "art52DisclosureRequired": true,
    "art52DisclosureText": "This proposal was generated with AI assistance. Your advisor has reviewed and approved this recommendation before it was presented to you.",
    "art52EnforcementMode": "block-on-missing",
    "requiredDisclosures": [
      "art52-ai-disclosure",
      "mifid2-cost-and-charges",
      "risk-warnings",
      "conflicts-of-interest"
    ],
    "gdprArt22FlagCheck": {
      "enabled": true,
      "onOptOut": "tag-requires-deliberative-review"
    }
  },

  "riskBudget": {
    "dailyLimit": 200,
    "perActionCost": {
      "proposalDraft": 10,
      "complexProductProposal": 25,
      "eriasClientProposal": 30,
      "gdprArt22OptOutProposal": 20
    },
    "resetSchedule": "00:00 UTC",
    "onBudgetExhausted": "block-and-alert"
  },

  "rateLimiting": {
    "requestsPerMinute": 10,
    "requestsPerHour": 100,
    "backend": "HotCache"
  }
}
```

**Annotation Notes:**
- `writeDeny` on `advisory/proposals/delivered/**`, `advisory/proposals/sent/**`, and `advisory/proposals/approved/**` is the technical enforcement of the human advisor approval gate — these three deny rules collectively ensure no proposal can be placed into any state that indicates client delivery without a human action
- `art52EnforcementMode: "block-on-missing"` means the SOE content guardrail blocks the write to `advisory/proposals/draft/**` if the Art.52 disclosure text is absent — the draft never exists if the disclosure is missing
- Low `dailyLimit: 200` reflects the high regulatory sensitivity of each proposal; budget exhaustion triggers an alert to the Head of Client Services, not a silent failure
- `deny: ["*"]` on email and slack is absolute — proposal-generator has no communication channel

---

## 4. client-reporter SOE Definition

```json
{
  "agentId": "client-reporter",
  "application": "advisor-lens",
  "version": "1.0",
  "description": "Generates periodic client performance reports and regulatory disclosures. Mandatory Art.52 AI disclosure enforced on every output.",
  "euAiActRiskLevel": "HIGH",

  "identity": {
    "role": "ClientReportingAgent",
    "allowedPersonas": ["client-reporter"],
    "authorityLevel": "read-report-only",
    "environmentScope": ["production", "uat"],
    "clientFacing": false
  },

  "dataAccess": {
    "readAllow": [
      "portfolios/{clientId}/**",
      "performance/{clientId}/**",
      "attribution/{clientId}/**",
      "products/fee-schedules/**",
      "products/sfdr-classifications/**",
      "products/pai-indicators/**",
      "research/published/**",
      "market-data/benchmarks/**",
      "regulatory/mifid2-cost-disclosure-templates/**",
      "regulatory/sfdr-disclosure-templates/**"
    ],
    "readDeny": [
      "portfolios/{otherClientId}/**",
      "performance/{otherClientId}/**",
      "crm/clients/**/ssn",
      "crm/clients/**/tax-id",
      "crm/clients/**/bank-accounts/**",
      "trading/executions/**",
      "orders/order-routing/**",
      "research/pre-publication/**",
      "research/drafts/**",
      "research/embargoed/**"
    ],
    "writeAllow": [
      "advisory/reports/{clientId}/**"
    ],
    "writeDeny": [
      "advisory/reports/{otherClientId}/**",
      "crm/**",
      "portfolios/**",
      "orders/**",
      "trading/**",
      "advisory/proposals/**"
    ]
  },

  "toolActions": {
    "bash": {
      "allow": [],
      "deny": ["*"]
    },
    "mcp__document__*": {
      "allow": [
        "mcp__document__generate_pdf",
        "mcp__document__write_report",
        "mcp__document__apply_regulatory_template"
      ],
      "deny": [
        "mcp__document__send_*",
        "mcp__document__email_*",
        "mcp__document__deliver_*"
      ]
    },
    "mcp__advisory__*": {
      "allow": [
        "mcp__advisory__write_report",
        "mcp__advisory__notify_advisor_report_ready"
      ],
      "deny": [
        "mcp__advisory__send_to_client",
        "mcp__advisory__email_*"
      ]
    },
    "email": {
      "allow": [],
      "deny": ["*"]
    },
    "slack_post_message": {
      "allow": [],
      "deny": ["*"]
    }
  },

  "contentGuardrails": {
    "outputToClientPaths": [],
    "reportOutputPaths": ["advisory/reports/{clientId}/**"],
    "art52DisclosureRequired": true,
    "art52DisclosureText": "This report was generated with AI assistance and reviewed by your advisor.",
    "art52EnforcementMode": "block-on-missing",
    "requiredDisclosures": [
      "art52-ai-disclosure",
      "gdpr-processing-disclosure"
    ],
    "clientIsolation": {
      "enabled": true,
      "enforcement": "task-scoped",
      "onCrossClientAttempt": "block-and-critical-alert"
    }
  },

  "riskBudget": {
    "dailyLimit": 300,
    "perActionCost": {
      "quarterlyReport": 10,
      "annualReview": 15,
      "sfrReport": 15,
      "onDemandSummary": 5
    },
    "resetSchedule": "00:00 UTC",
    "onBudgetExhausted": "block-and-alert"
  },

  "rateLimiting": {
    "requestsPerMinute": 20,
    "requestsPerHour": 200,
    "backend": "HotCache"
  }
}
```

**Annotation Notes:**
- `readDeny` on `portfolios/{otherClientId}/**` and `writeDeny` on `advisory/reports/{otherClientId}/**` represent strict client isolation — these patterns are resolved at runtime against the task's assigned client identifier; any access attempt for a different client ID is blocked with a CRITICAL severity event
- `clientIsolation.onCrossClientAttempt: "block-and-critical-alert"` is the highest-severity SOE response for this agent — GDPR Art.5(1)(f) integrity and confidentiality principle requires this to be treated as a potential data breach event
- `readDeny` on `trading/executions/**` and `orders/order-routing/**` means client-reporter works with attributed performance data only, not with order-level execution details that could expose market timing or front-running signals
- Art.52 enforcement is identical to proposal-generator: `block-on-missing` — no report write succeeds without the disclosure

---

*This document is part of the AssetCo AI Platform documentation suite. SOE definitions are authoritative — changes require sign-off from CCO, DPO, and Platform Security.*
