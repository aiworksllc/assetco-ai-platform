# AlphaEngine — SOE Definitions

**Application:** AlphaEngine
**Document:** apps/alpha-engine/soe-definitions.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** CTO, CCO, Head of Quant Research, Model Risk, Sentinel-Ops Platform Team

---

## 1. Overview

This document contains the annotated Safe Operating Envelope (SOE) definitions for all four AlphaEngine agents. Each SOE definition is the machine-enforceable governance contract for that agent — what it can read, what it can write, what tool actions it can execute, and what risk budget it operates within.

All four SOE definitions are enforced by the Sentinel-Ops gate. Every tool call made by an AlphaEngine agent is evaluated against the relevant SOE definition before execution. Violations are blocked and logged. Ambiguous cases are escalated to Sentinel AI reasoning (2–5s) before a decision is made. The gate fails closed — if the SOE cannot evaluate, the tool call is blocked.

**Key enforcement principles for AlphaEngine:**
- Chinese wall (ResearchNexus pre-publication) is enforced as a readDeny pattern — structurally impossible to bypass
- IPS concentration limits enforced as fiduciary constraints within toolActions deny patterns
- allocation-advisor is write-isolated to proposals directory — human approval required before any allocation becomes active
- factor-analyst has zero write access to production systems
- All four agents are classified HIGH_RISK — every decision is logged to the immutable Chronicle audit trail

---

## 2. SOE Definition: portfolio-optimizer

```json
{
  "agentId": "alpha-engine/portfolio-optimizer",
  "version": "1.2.0",
  "application": "AlphaEngine",
  "classification": "HIGH_RISK",
  "regulatoryFrameworks": ["SEC_ADVISERS_ACT", "MIFID_II_ART25", "SFDR_ART8_9", "ERISA", "SR_11_7"],
  "euAiActCategory": "ANNEX_III_HIGH_RISK",

  // Identity boundary — portfolio-optimizer acts as a quantitative optimization
  // service, not as a portfolio manager. It has no authority to make binding
  // investment decisions; it produces candidate portfolios for PM review.
  "identity": {
    "role": "PortfolioOptimizationService",
    "authorityLevel": "propose-only",
    "environmentScope": ["production", "model-validation"],
    "fiduciaryNote": "Agent operates under SEC Advisers Act fiduciary obligation. All outputs are candidate portfolios subject to PM oversight. Agent does not have independent investment discretion."
  },

  "dataAccess": {
    // Read access: published signals and reference data only
    "readAllow": [
      "research-nexus/published/signals/**",       // Published alpha signals (post-publication gate)
      "research-nexus/published/esg/**",           // Published ESG scores and PAI metrics
      "research-nexus/published/factor-data/**",   // Published factor libraries
      "data/factors/**",                           // Internal risk factor covariance matrices
      "data/benchmarks/**",                        // Benchmark index compositions
      "data/securities/**",                        // Security master, fundamental data
      "data/market/transaction-costs/**",          // Transaction cost estimates
      "mandates/ips/**",                           // Investment Policy Statements (READ ONLY — cannot modify)
      "mandates/erisa/**",                         // ERISA-specific mandate constraints
      "portfolios/live/**",                        // Current live position data
      "portfolios/factor-reports/**"               // Factor constraint recommendations from factor-analyst
    ],

    // CHINESE WALL: pre-publication research access is structurally denied
    // This is not a policy reminder — it is a hard SOE block enforced deterministically
    "readDeny": [
      "research-nexus/pre-publication/**",         // CHINESE WALL: pre-pub research denied (SEC Reg FD)
      "research-nexus/staging/**",                 // All staging paths denied — published only
      "clients/pii/**",                            // Individual client PII (GDPR, data minimization)
      "clients/identifiable/**",                   // Any client-identifiable data
      "trading/orders/**",                         // Execution data — information barrier
      "trading/execution/**",                      // Execution data — information barrier
      "deal-room/**",                              // Private markets deal data (MNPI wall)
      "compliance/investigations/**"               // Compliance investigation files (privileged)
    ],

    // Write access: optimized and model portfolio directories only
    // Cannot write to execution systems, compliance, client records, or mandate documents
    "writeAllow": [
      "portfolios/model/**",                       // Model portfolio outputs (strategy-level)
      "portfolios/optimized/**"                    // Mandate-specific optimized target portfolios
    ],

    // FIDUCIARY WRITE ISOLATION: optimizer cannot touch execution, compliance, or client systems
    "writeDeny": [
      "trading/**",                                // No execution authority
      "compliance/**",                             // Compliance records are append-only by Chronicle
      "clients/**",                                // No client record modification
      "mandates/**",                               // IPS documents are read-only to optimizer
      "research-nexus/**"                          // Cannot write back to research (information barrier)
    ]
  },

  "toolActions": {
    "compute": {
      // Allow: optimization algorithms, factor model computation
      "allow": [
        "optimization.run *",                      // Quadratic program solver invocation
        "factor.compute *",                        // Factor exposure computation
        "scenario.stress *",                       // Stress test simulation
        "backtest.run *"                           // Backtesting (model validation use)
      ],
      "deny": [
        "order.submit *",                          // No direct order submission
        "order.modify *",                          // No order management
        "position.override *"                      // Cannot manually override positions
      ]
    },
    "bash": {
      "allow": [
        "python optimizer/run.py *",              // Optimization script execution
        "python factor/compute.py *",             // Factor computation script
        "python backtest/run.py *"                // Backtesting script
      ],
      "deny": [
        "curl *trading*",                         // No direct API calls to trading systems
        "curl *oms*",                             // No OMS API calls
        "psql *client*",                          // No client database access
        "rm -rf *",                               // No destructive operations
        "aws s3 cp *compliance*"                  // No compliance data writes
      ]
    },
    "edit": {
      "allowPaths": [
        "portfolios/model/**",
        "portfolios/optimized/**"
      ],
      "denyPaths": [
        "trading/**",
        "compliance/**",
        "clients/**",
        "mandates/**"
      ]
    }
  },

  // FIDUCIARY CONSTRAINTS: enforced as hard SOE denies
  // These constraints enforce the IPS and SEC fiduciary duty at the infrastructure layer.
  // The optimizer cannot output an allocation that violates these — it is blocked before write.
  "fiduciaryConstraints": {
    "concentrationLimits": {
      "enforcement": "hard-deny",
      "singleNameMaxWeight": "mandate-ips-defined",    // Per-mandate; read from mandates/ips/**
      "sectorMaxWeight": "mandate-ips-defined",
      "countryMaxWeight": "mandate-ips-defined",
      "assetClassEligibility": "mandate-ips-defined"
    },
    "esgConstraints": {
      "enforcement": "hard-deny",
      "sfdrArticle8MinScore": 50,                      // Minimum portfolio ESG score for Art.8 funds
      "sfdrArticle9MinScore": 70,                      // Minimum portfolio ESG score for Art.9 funds
      "paiExclusions": "research-nexus/published/esg/pai-exclusions.json"
    },
    "trackingErrorBounds": {
      "enforcement": "hard-deny",
      "maxActiveRisk": "mandate-ips-defined"           // Tracking error ceiling per mandate
    }
  },

  "riskBudget": {
    "dailyLimit": 500,
    "perCallCost": {
      "full-optimization": 10,
      "incremental-rebalance": 3,
      "factor-compute": 1
    },
    "breachAction": "block-and-escalate",
    "resetCadence": "daily-00:00-UTC"
  },

  "auditRequirements": {
    "logLevel": "FULL",                              // Every optimization logged with inputs + outputs
    "retentionYears": 7,                             // SEC Rule 204-2 retention requirement
    "immutable": true,                               // Append-only — cannot be modified by any agent
    "requiredFields": [
      "mandateId", "optimizationRunId", "timestamp",
      "activeConstraints", "bindingConstraints",
      "objectiveFunctionValue", "factorContributions",
      "ipsVersion", "agentVersion"
    ]
  }
}
```

---

## 3. SOE Definition: rebalancer

```json
{
  "agentId": "alpha-engine/rebalancer",
  "version": "1.1.0",
  "application": "AlphaEngine",
  "classification": "HIGH_RISK",
  "regulatoryFrameworks": ["SEC_ADVISERS_ACT", "ERISA", "MIFID_II_ART27"],

  "identity": {
    "role": "RebalancingService",
    "authorityLevel": "trade-list-generation-only",
    "fiduciaryNote": "Rebalancer generates trade lists for TradeSentinel execution. It has no execution authority. Trade lists are subject to PM review before execution is triggered."
  },

  "dataAccess": {
    "readAllow": [
      "portfolios/live/**",                        // Current live positions (drift computation)
      "portfolios/optimized/**",                   // Target portfolios from portfolio-optimizer
      "portfolios/tax-lots/**",                    // Tax lot records for tax-aware mandates
      "data/market/transaction-costs/**",          // Transaction cost estimates
      "mandates/ips/**",                           // IPS constraints (read for drift threshold)
      "mandates/erisa/**"                          // ERISA mandate parameters
    ],
    "readDeny": [
      "research-nexus/pre-publication/**",         // CHINESE WALL
      "research-nexus/staging/**",
      "clients/pii/**",
      "trading/orders/**",
      "trading/execution/**",
      "deal-room/**"
    ],
    "writeAllow": [
      "portfolios/rebalance/**",                   // Rebalancing event records
      "trading/trade-lists/**"                     // Delta trade lists for TradeSentinel
    ],
    "writeDeny": [
      "trading/orders/**",                         // Cannot submit orders directly
      "trading/execution/**",                      // No execution system access
      "portfolios/live/**",                        // Cannot modify position of record
      "portfolios/optimized/**",                   // Cannot modify target portfolios
      "compliance/**",
      "clients/**",
      "mandates/**"
    ]
  },

  "toolActions": {
    "bash": {
      "allow": [
        "python rebalancer/compute-drift.py *",
        "python rebalancer/generate-trade-list.py *"
      ],
      "deny": [
        "curl *oms*",
        "curl *execution*",
        "fix.session.submit *",                    // No FIX protocol order submission
        "rm -rf *"
      ]
    },
    "edit": {
      "allowPaths": [
        "portfolios/rebalance/**",
        "trading/trade-lists/**"
      ],
      "denyPaths": [
        "trading/orders/**",
        "portfolios/live/**",
        "portfolios/optimized/**",
        "compliance/**",
        "clients/**"
      ]
    }
  },

  "riskBudget": {
    "dailyLimit": 300,
    "perCallCost": {
      "drift-check": 1,
      "trade-list-generation": 5
    },
    "breachAction": "block-and-escalate",
    "resetCadence": "daily-00:00-UTC"
  },

  "auditRequirements": {
    "logLevel": "FULL",
    "retentionYears": 7,
    "immutable": true,
    "requiredFields": [
      "mandateId", "rebalanceRunId", "timestamp",
      "driftMeasurement", "driftThreshold", "triggerReason",
      "tradeListId", "estimatedTransactionCost"
    ]
  }
}
```

---

## 4. SOE Definition: allocation-advisor

```json
{
  "agentId": "alpha-engine/allocation-advisor",
  "version": "1.0.0",
  "application": "AlphaEngine",
  "classification": "HIGH_RISK",
  "regulatoryFrameworks": ["SEC_ADVISERS_ACT", "MIFID_II_ART25", "ERISA", "EU_AI_ACT_ART14"],

  "identity": {
    "role": "AllocationAdvisoryService",
    "authorityLevel": "propose-only-human-approval-required",
    "fiduciaryNote": "EU AI Act Art.14 compliance: ALL allocation proposals require human approval. Agent cannot initiate, trigger, or escalate any allocation without a logged human approval event. Proposals are written to the proposals directory and cannot be self-promoted to active allocations."
  },

  "dataAccess": {
    "readAllow": [
      "data/macro/**",                             // Macro regime indicators
      "data/valuations/**",                        // Asset class valuation metrics
      "clients/risk-profiles/anonymized/**",       // Anonymized risk profiles only (GDPR compliance)
      "mandates/ips/**",
      "mandates/erisa/**",
      "portfolios/model/**",                       // Current model portfolio allocations
      "research-nexus/published/signals/**"        // Published macro and asset class signals only
    ],
    "readDeny": [
      "research-nexus/pre-publication/**",         // CHINESE WALL
      "clients/pii/**",                            // Individual client PII — hard deny
      "clients/identifiable/**",                   // Any identifiable client data
      "trading/orders/**",
      "trading/execution/**",
      "deal-room/**"
    ],

    // STRICT WRITE ISOLATION: allocation-advisor writes ONLY to proposals directory
    // This is the structural enforcement of EU AI Act Art.14 human oversight requirement
    "writeAllow": [
      "portfolios/proposals/**"                    // Proposals only — pending human approval
    ],
    "writeDeny": [
      "portfolios/model/**",                       // Cannot override model portfolios
      "portfolios/optimized/**",                   // Cannot create active allocations
      "portfolios/live/**",                        // Cannot modify live positions
      "trading/**",                                // No execution path
      "compliance/**",
      "clients/**",
      "mandates/**"
    ]
  },

  "toolActions": {
    "bash": {
      "allow": [
        "python advisor/generate-proposal.py *",
        "python advisor/erisa-rationale.py *"
      ],
      "deny": [
        "python optimizer/run.py *",               // Cannot directly invoke optimizer
        "python rebalancer/*.py *",                // Cannot trigger rebalancing
        "curl *oms*",
        "curl *execution*"
      ]
    },
    "edit": {
      "allowPaths": [
        "portfolios/proposals/**"
      ],
      "denyPaths": [
        "portfolios/model/**",
        "portfolios/optimized/**",
        "portfolios/live/**",
        "trading/**",
        "compliance/**",
        "clients/**",
        "mandates/**"
      ]
    }
  },

  // Human approval gate enforcement
  // SOE validates that a proposal is not promoted to active allocation without
  // a human approval event (approverIdentity + approvalTimestamp) in the audit trail
  "humanApprovalGate": {
    "required": true,
    "approvalEventType": "ALLOCATION_PROPOSAL_APPROVED",
    "approvalFields": ["approverIdentity", "approvalTimestamp", "proposalId"],
    "enforcedBy": "SOE_PRE_FILTER",
    "bypassAllowed": false
  },

  "riskBudget": {
    "dailyLimit": 200,
    "perCallCost": {
      "proposal-generation": 10,
      "erisa-rationale": 5
    },
    "breachAction": "block-and-escalate",
    "resetCadence": "daily-00:00-UTC"
  },

  "auditRequirements": {
    "logLevel": "FULL",
    "retentionYears": 7,
    "immutable": true,
    "requiredFields": [
      "proposalId", "timestamp", "mandateId",
      "macroRegime", "assetClassWeights",
      "humanApprovalRequired", "humanApprovalEvent",
      "ipsConstraintsActive", "eriisaRationaleIncluded"
    ]
  }
}
```

---

## 5. SOE Definition: factor-analyst

```json
{
  "agentId": "alpha-engine/factor-analyst",
  "version": "1.1.0",
  "application": "AlphaEngine",
  "classification": "HIGH_RISK",
  "regulatoryFrameworks": ["SEC_ADVISERS_ACT", "SR_11_7"],

  "identity": {
    "role": "FactorAnalysisService",
    "authorityLevel": "read-only-analysis",
    "fiduciaryNote": "Factor-analyst is a read-only analytical service. It has zero write access to production portfolio, trading, or client systems. Its outputs (factor reports, attribution) are advisory inputs to portfolio-optimizer. It cannot trigger rebalancing or modify any portfolio."
  },

  "dataAccess": {
    "readAllow": [
      "portfolios/live/**",                        // Live positions for factor exposure computation
      "portfolios/model/**",                       // Model portfolios for factor attribution
      "portfolios/optimized/**",                   // Target portfolios for attribution analysis
      "data/factors/**",                           // Factor loading matrices
      "data/benchmarks/**",                        // Benchmark compositions
      "data/securities/**",                        // Security master, fundamentals
      "research-nexus/published/factor-data/**",   // Published factor signals
      "mandates/ips/**"                            // IPS factor targets (read only)
    ],
    "readDeny": [
      "research-nexus/pre-publication/**",         // CHINESE WALL
      "clients/pii/**",
      "trading/orders/**",
      "trading/execution/**",
      "deal-room/**"
    ],

    // READ-ONLY: factor-analyst writes ONLY to analytical output directories
    // Cannot write to any production portfolio, trading, or client system
    "writeAllow": [
      "portfolios/factor-reports/**",              // Factor exposure reports
      "portfolios/attribution/**"                  // Return attribution summaries
    ],

    // HARD WRITE DENY: covers all production systems
    "writeDeny": [
      "portfolios/live/**",                        // Cannot modify live positions
      "portfolios/model/**",                       // Cannot modify model portfolios
      "portfolios/optimized/**",                   // Cannot modify target portfolios
      "portfolios/rebalance/**",                   // Cannot trigger rebalancing
      "trading/**",                                // No execution access
      "compliance/**",
      "clients/**",
      "mandates/**",
      "research-nexus/**"                          // Cannot write to research systems
    ]
  },

  "toolActions": {
    "bash": {
      "allow": [
        "python factor/compute-exposures.py *",
        "python factor/attribution.py *",
        "python factor/report.py *"
      ],
      "deny": [
        "python optimizer/run.py *",               // Cannot invoke optimizer directly
        "python rebalancer/*.py *",                // Cannot trigger rebalancing
        "curl *oms*",
        "curl *trading*",
        "rm -rf *"
      ]
    },
    "edit": {
      "allowPaths": [
        "portfolios/factor-reports/**",
        "portfolios/attribution/**"
      ],
      // COMPREHENSIVE WRITE DENY: belt-and-suspenders enforcement of read-only role
      "denyPaths": [
        "portfolios/live/**",
        "portfolios/model/**",
        "portfolios/optimized/**",
        "portfolios/rebalance/**",
        "trading/**",
        "compliance/**",
        "clients/**",
        "mandates/**",
        "research-nexus/**"
      ]
    }
  },

  "riskBudget": {
    "dailyLimit": 400,
    "perCallCost": {
      "factor-exposure-compute": 1,
      "attribution-run": 2,
      "full-portfolio-report": 3
    },
    "breachAction": "block-and-escalate",
    "resetCadence": "daily-00:00-UTC"
  },

  "auditRequirements": {
    "logLevel": "STANDARD",
    "retentionYears": 7,
    "immutable": true,
    "requiredFields": [
      "portfolioId", "reportId", "timestamp",
      "factorExposures", "benchmarkRelativeExposures",
      "attributionSummary"
    ]
  }
}
```
