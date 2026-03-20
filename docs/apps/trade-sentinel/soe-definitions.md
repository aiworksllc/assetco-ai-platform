# TradeSentinel — SOE Definitions

**Application:** TradeSentinel
**Document:** soe-definitions.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** Compliance Technology, Security Architecture, Platform Engineering

---

## Overview

This document contains the fully annotated SOE (Safe Operating Envelope) definitions for all 3 TradeSentinel agents. Each definition is enforced at runtime by the Sentinel-Ops gate (`soe-gate.js`) for every tool call made by the agent. Deterministic rules (glob/regex matches) are evaluated in <1ms. Ambiguous cases are escalated to Sentinel AI for classification.

**Key principle:** `deny` rules always take precedence over `allow` rules. If a path matches both an allow and a deny, the call is blocked.

---

## 1. order-router SOE Definition

```json
{
  "$schema": "https://sentinel-ops.yadriworks.ai/soe-schema/v1",
  "agent": "order-router",
  "application": "trade-sentinel",
  "version": "1.2.0",
  "description": "Smart order routing agent. Routes trade lists from AlphaEngine to execution venues via FlexTrade EMS. Pre-trade decision-maker with write access to order staging only.",
  "euAiActClass": "HIGH_RISK",

  "identity": {
    "role": "ExecutionTrader",
    "allowedPersonas": ["order-router"],
    "authorityLevel": "order-routing-only",
    "environmentScope": ["production", "uat"],
    "comment": "order-router operates only in production and UAT. It may never execute in development or sandbox environments connected to live venues."
  },

  "dataAccess": {
    "readAllow": [
      "trading/orders/incoming/**",
      "trading/orders/staged/**",
      "trading/mandates/**",
      "trading/restricted-securities/**",
      "market-data/live/**",
      "market-data/quotes/**",
      "market-data/order-book/**",
      "venue-data/fee-schedules/**",
      "venue-data/connectivity-status/**",
      "venue-data/historical-fill-stats/**",
      "positions/current/**",
      "risk-compass/exposure-limits/**",
      "research-nexus/published/reports/**",
      "research-nexus/published/esg-scores/published/**"
    ],
    "readDeny": [
      "research-nexus/pre-publication/**",
      "research-nexus/draft/**",
      "research-nexus/analyst-workspace/**",
      "research-nexus/pending-approval/**",
      "research-nexus/staging/**",
      "client-data/pii/**",
      "client-data/kyc/**",
      "client-data/contact/**",
      "deal-room/**",
      "m-and-a/**",
      "corporate-actions/unpublished/**",
      "alpha-engine/internal-signals/**",
      "alpha-engine/model-weights/**",
      "trading/orders/active/**",
      "trading/orders/cancelled/**",
      "compliance/reports/**",
      "audit/**"
    ],
    "readDenyComment": {
      "research-nexus/pre-publication/**": "CHINESE WALL: Reg FD and MAR Art.10 prohibition. Pre-publication research is potential MNPI. Deny is deterministic — path match blocks the call regardless of AI rationale.",
      "research-nexus/draft/**": "CHINESE WALL: Analyst drafts are MNPI. Any read attempt generates a chinese-wall-violation-attempt audit event.",
      "client-data/pii/**": "GDPR Art.5: data minimisation. order-router requires no client PII to perform venue selection.",
      "deal-room/**": "MAR Art.11: deal-contingent orders must not be influenced by M&A MNPI held by deal team.",
      "trading/orders/active/**": "Separation of duties: order-router only stages new orders. It does not read the active execution book to prevent self-reinforcing order behaviour."
    },
    "writeAllow": [
      "trading/orders/staged/**"
    ],
    "writeDeny": [
      "trading/orders/active/**",
      "trading/orders/executed/**",
      "trading/orders/cancelled/**",
      "positions/**",
      "client-data/**",
      "compliance/**",
      "audit/**",
      "research-nexus/**",
      "risk-compass/**",
      "alpha-engine/**"
    ],
    "writeDenyComment": "order-router's only write authority is the order staging directory. Staging → active promotion is performed by FlexTrade EMS after SOE-enforced pre-trade checks pass. order-router cannot directly manipulate live or executed orders."
  },

  "toolActions": {
    "bash": {
      "allow": [
        "flexTrade submit-order --staged-id *",
        "flexTrade cancel-staged --staged-id *",
        "bloomberg aim-read --trade-list *",
        "bloomberg bpipe-quote --instrument *",
        "bloomberg bpipe-depth --instrument * --venue *",
        "riskcompass check-exposure --instrument * --quantity *",
        "nbbo-validator validate --instrument * --price *"
      ],
      "deny": [
        "flexTrade modify-active *",
        "flexTrade cancel-active *",
        "flexTrade submit-order --bypass-soe *",
        "exchange-direct-access *",
        "rm *",
        "curl * research-nexus *",
        "curl * client-data *",
        "psql *",
        "DROP *",
        "DELETE *"
      ],
      "denyComment": {
        "exchange-direct-access *": "All exchange access must route through FlexTrade EMS. Direct exchange access bypasses pre-trade risk controls.",
        "flexTrade modify-active *": "Separation of duties: order-router stages orders; it cannot modify active orders.",
        "flexTrade submit-order --bypass-soe *": "SOE bypass flag explicitly denied. Any attempt to skip the SOE gate generates a critical violation event."
      }
    },
    "edit": {
      "allowPaths": [
        "trading/orders/staged/**"
      ],
      "denyPaths": [
        "**"
      ],
      "denyPathsComment": "Edit tool is effectively deny-all except for the staged orders path. The allowPaths list takes precedence for matched paths only."
    },
    "mcp_tool": {
      "allow": [
        "context_read",
        "context_write",
        "context_update_task",
        "jira_get_issue",
        "jira_add_comment"
      ],
      "deny": [
        "jira_create_*",
        "slack_post_message",
        "context_write_shared"
      ]
    }
  },

  "riskBudget": {
    "dailyLimit": 1000,
    "comment": "1000 risk units/day. order-router is a high-volume agent — typical trading day consumes 400-600 units across 200-400 orders. Budget sized to allow full trading day with headroom for anomalous conditions.",
    "perActionCost": {
      "order_staged": 1,
      "order_submitted_under_100k": 2,
      "order_submitted_100k_to_1m": 5,
      "order_submitted_over_1m": 10,
      "nbbo_violation_attempt": 50,
      "mandate_check_fail": 30,
      "chinese_wall_violation_attempt": 500
    },
    "freezeOnBreach": true,
    "escalateAt": 800,
    "escalationComment": "At 800/1000 risk units, Arbiter notifies Head of Trading and Compliance. At ceiling, order-router is frozen — no further orders can be staged until human review."
  },

  "humanOversight": {
    "required": true,
    "euAiActArticle": "Art.14",
    "gates": [
      {
        "trigger": "order_notional_eur > 500000",
        "action": "REQUIRE_HUMAN_APPROVAL",
        "approvalChannel": "bloomberg-aim-approval-workflow",
        "comment": "Orders above €500K require trader sign-off in Bloomberg AIM before FlexTrade submission. SOE checks for human-approved flag in order context."
      },
      {
        "trigger": "instrument_on_restricted_list",
        "action": "BLOCK_AND_ESCALATE",
        "comment": "Restricted securities never proceed. Block is deterministic."
      }
    ]
  }
}
```

---

## 2. execution-monitor SOE Definition

```json
{
  "$schema": "https://sentinel-ops.yadriworks.ai/soe-schema/v1",
  "agent": "execution-monitor",
  "application": "trade-sentinel",
  "version": "1.1.0",
  "description": "Real-time execution quality monitor. Tracks open orders against VWAP, arrival, and IS benchmarks. Detects MAR Art.12 abuse patterns. Alert-only — cannot modify orders.",
  "euAiActClass": "HIGH_RISK",

  "identity": {
    "role": "ExecutionSurveillance",
    "allowedPersonas": ["execution-monitor"],
    "authorityLevel": "alert-only",
    "environmentScope": ["production", "uat"],
    "comment": "Alert-only authority level. Any attempt to invoke execution-modifying tools is blocked at the SOE gate regardless of AI reasoning."
  },

  "dataAccess": {
    "readAllow": [
      "trading/orders/active/**",
      "trading/orders/staged/**",
      "trading/orders/executed/**",
      "trading/orders/incoming/**",
      "trading/fills/**",
      "trading/execution-data/**",
      "market-data/live/**",
      "market-data/quotes/**",
      "market-data/order-book/**",
      "market-data/historical/**",
      "venue-data/historical-fill-stats/**",
      "compliance-shield/str-templates/**",
      "trading/benchmarks/**"
    ],
    "readDeny": [
      "research-nexus/pre-publication/**",
      "research-nexus/draft/**",
      "research-nexus/analyst-workspace/**",
      "research-nexus/pending-approval/**",
      "research-nexus/staging/**",
      "client-data/pii/**",
      "client-data/kyc/**",
      "client-data/contact/**",
      "alpha-engine/internal-signals/**",
      "alpha-engine/model-weights/**",
      "deal-room/**",
      "compliance/reports/**",
      "audit/**"
    ],
    "readDenyComment": {
      "research-nexus/pre-publication/**": "CHINESE WALL: execution-monitor has no legitimate reason to access pre-publication research. Any access attempt is a chinese wall violation.",
      "client-data/pii/**": "Execution quality surveillance requires no client personal data. Order identifiers are sufficient.",
      "alpha-engine/internal-signals/**": "execution-monitor must not have visibility into future trade intentions — this would constitute front-running risk."
    },
    "writeAllow": [
      "trading/alerts/**",
      "trading/monitoring/**",
      "compliance-shield/str-drafts/**"
    ],
    "writeDeny": [
      "trading/orders/**",
      "trading/fills/**",
      "positions/**",
      "client-data/**",
      "compliance/reports/**",
      "audit/**",
      "research-nexus/**",
      "alpha-engine/**",
      "risk-compass/**"
    ],
    "writeDenyComment": "execution-monitor writes only to alert and monitoring directories, and to the ComplianceShield STR draft intake. It has zero write access to the order management path. This is the primary separation-of-duties control: surveillance cannot modify what it surveils."
  },

  "toolActions": {
    "bash": {
      "allow": [
        "alert-service post --channel compliance-desk --severity *",
        "alert-service post --channel trading-desk --severity *",
        "compliance-shield create-str-draft --pattern * --orders *",
        "compliance-shield create-escalation --type market-abuse --details *",
        "benchmark-calculator vwap --instrument * --from * --to *",
        "benchmark-calculator arrival-price --instrument * --timestamp *",
        "benchmark-calculator implementation-shortfall --order-id *",
        "anomaly-detector run --pattern * --orders *"
      ],
      "deny": [
        "flexTrade *",
        "bloomberg aim-submit *",
        "bloomberg aim-modify *",
        "bloomberg aim-cancel *",
        "exchange-direct-access *",
        "order-router trigger *",
        "rm *",
        "curl * research-nexus *",
        "psql *",
        "DROP *",
        "DELETE *"
      ],
      "denyComment": {
        "flexTrade *": "Blanket deny on all FlexTrade commands. execution-monitor has zero order execution authority.",
        "bloomberg aim-submit *": "Deny on all Bloomberg AIM submission commands. surveillance role only.",
        "order-router trigger *": "execution-monitor cannot trigger order-router actions. Agents cannot directly invoke each other — all coordination is via the shared context and event bus."
      }
    },
    "edit": {
      "allowPaths": [
        "trading/alerts/**",
        "trading/monitoring/**",
        "compliance-shield/str-drafts/**"
      ],
      "denyPaths": [
        "trading/orders/**",
        "trading/fills/**",
        "positions/**",
        "**/*.order",
        "**/*.execution"
      ]
    },
    "mcp_tool": {
      "allow": [
        "context_read",
        "context_write",
        "context_update_task",
        "slack_post_message",
        "jira_create_task",
        "jira_add_comment"
      ],
      "deny": [
        "context_write_shared"
      ],
      "allowComment": "execution-monitor is permitted to post to Slack for compliance desk alerts and create Jira tasks for MAR escalations. This is the primary communication channel for STR-candidate findings."
    }
  },

  "riskBudget": {
    "dailyLimit": 500,
    "comment": "500 risk units/day. Monitoring agent with lower budget than order-router. Alert generation is low-cost; anomaly pattern triggers consume more.",
    "perActionCost": {
      "alert_low": 1,
      "alert_medium": 3,
      "alert_high": 10,
      "str_draft_created": 20,
      "escalation_created": 25,
      "chinese_wall_violation_attempt": 500
    },
    "freezeOnBreach": false,
    "escalateAt": 400,
    "freezeOnBreachComment": "execution-monitor is NOT frozen on budget breach. Stopping surveillance during an active trading day due to budget ceiling would be worse than the risk of over-alerting. At ceiling, Arbiter notifies the Head of Trading and Risk team, and escalates the next 10 alerts for human review."
  },

  "humanOversight": {
    "required": true,
    "euAiActArticle": "Art.14",
    "gates": [
      {
        "trigger": "str_candidate_detected",
        "action": "REQUIRE_HUMAN_REVIEW",
        "reviewChannel": "compliance-shield-str-workflow",
        "sla": "15 minutes",
        "comment": "STR candidates must reach a compliance officer within 15 minutes for MAR Art.16 filing obligations."
      },
      {
        "trigger": "order_cancel_requested AND order_notional_eur > 100000",
        "action": "BLOCK — execution-monitor cannot cancel orders",
        "comment": "execution-monitor never has cancel authority, but this gate ensures any bug or injection attempt is explicitly documented."
      }
    ]
  }
}
```

---

## 3. tca-analyzer SOE Definition

```json
{
  "$schema": "https://sentinel-ops.yadriworks.ai/soe-schema/v1",
  "agent": "tca-analyzer",
  "application": "trade-sentinel",
  "version": "1.0.0",
  "description": "Post-trade transaction cost analysis agent. Strictly read-only against all trading systems. Computes execution quality metrics and generates MiFID II RTS 28 quarterly reports. Cannot read live orders or modify any records.",
  "euAiActClass": "HIGH_RISK",

  "identity": {
    "role": "ComplianceAnalyst",
    "allowedPersonas": ["tca-analyzer"],
    "authorityLevel": "read-only-post-trade",
    "environmentScope": ["production", "uat"],
    "comment": "tca-analyzer is the most restricted agent in TradeSentinel. Its authority level is read-only-post-trade — it can only read completed execution records and write to its designated report output path."
  },

  "dataAccess": {
    "readAllow": [
      "trading/orders/executed/**",
      "trading/orders/cancelled/**",
      "trading/fills/historical/**",
      "trading/execution-data/historical/**",
      "trading/benchmarks/**",
      "venue-data/fee-schedules/**",
      "venue-data/historical-fill-stats/**",
      "market-data/historical/**",
      "compliance/rts28-templates/**",
      "compliance/rts27-venue-data/**",
      "compliance/reports/tca/**"
    ],
    "readDeny": [
      "trading/orders/active/**",
      "trading/orders/staged/**",
      "trading/orders/incoming/**",
      "trading/fills/live/**",
      "market-data/live/**",
      "research-nexus/**",
      "client-data/**",
      "positions/**",
      "alpha-engine/**",
      "risk-compass/**",
      "deal-room/**",
      "audit/**"
    ],
    "readDenyComment": {
      "trading/orders/active/**": "SEPARATION OF DUTIES: tca-analyzer is post-trade only. Access to live orders would allow it to influence in-flight execution, violating the read-only mandate.",
      "trading/orders/staged/**": "tca-analyzer cannot see staged orders — it operates only on completed executions.",
      "market-data/live/**": "tca-analyzer uses only historical market data for benchmark reconstruction. Real-time data access is not required and is denied to reduce attack surface.",
      "research-nexus/**": "CHINESE WALL: All ResearchNexus paths denied, including published. tca-analyzer performs purely quantitative post-trade analysis with no need for research context.",
      "client-data/**": "TCA reports aggregate execution quality at the order and venue level. No client PII required.",
      "positions/**": "tca-analyzer is post-trade and read-only; it does not need live position data."
    },
    "writeAllow": [
      "compliance/reports/tca/**"
    ],
    "writeDeny": [
      "trading/**",
      "positions/**",
      "client-data/**",
      "alpha-engine/**",
      "risk-compass/**",
      "research-nexus/**",
      "audit/**",
      "compliance/reports/str/**",
      "compliance/reports/breach/**",
      "compliance/reports/position/**"
    ],
    "writeDenyComment": "tca-analyzer has exactly one write-permitted path: compliance/reports/tca/**. Every other path in the system is on the writeDeny list. This is the tightest write constraint of any TradeSentinel agent and enforces the separation-of-duties principle at the filesystem level."
  },

  "toolActions": {
    "bash": {
      "allow": [
        "tca-engine compute --order-id *",
        "tca-engine compute-batch --date-range *",
        "benchmark-calculator vwap --instrument * --historical *",
        "benchmark-calculator arrival-price --instrument * --historical *",
        "benchmark-calculator implementation-shortfall --historical *",
        "rts28-reporter generate --quarter * --asset-class *",
        "rts27-consumer fetch --venue * --period *",
        "report-publisher stage --report-path compliance/reports/tca/*"
      ],
      "deny": [
        "flexTrade *",
        "bloomberg aim-submit *",
        "bloomberg aim-modify *",
        "bloomberg aim-cancel *",
        "order-router *",
        "execution-monitor *",
        "exchange-direct-access *",
        "alert-service *",
        "compliance-shield create-str-draft *",
        "compliance-shield create-escalation *",
        "rm *",
        "curl *",
        "psql *",
        "DROP *",
        "DELETE *",
        "UPDATE *",
        "INSERT *"
      ],
      "denyComment": {
        "flexTrade *": "Blanket deny. tca-analyzer has no execution authority of any kind.",
        "alert-service *": "tca-analyzer does not generate real-time alerts. Execution quality findings are published to reports only.",
        "curl *": "All outbound HTTP calls denied. tca-analyzer reads from internal data stores only via approved tca-engine and benchmark-calculator tools.",
        "INSERT * / UPDATE * / DELETE *": "All database mutation statements explicitly denied. tca-analyzer is read-only at the data layer as well as the filesystem layer."
      }
    },
    "edit": {
      "allowPaths": [
        "compliance/reports/tca/**"
      ],
      "denyPaths": [
        "trading/**",
        "positions/**",
        "client-data/**",
        "audit/**",
        "compliance/reports/str/**",
        "compliance/reports/breach/**"
      ]
    },
    "mcp_tool": {
      "allow": [
        "context_read",
        "context_write",
        "context_update_task"
      ],
      "deny": [
        "slack_post_message",
        "jira_create_*",
        "jira_update_issue",
        "context_write_shared"
      ],
      "denyComment": "tca-analyzer produces batch reports. It does not post real-time messages to Slack or create Jira issues. All outputs are written to the report directory for human review."
    }
  },

  "riskBudget": {
    "dailyLimit": 100,
    "comment": "100 risk units/day. tca-analyzer is a batch analysis agent that runs outside market hours. Very low risk budget is appropriate — it only reads historical data and writes reports. If budget is reached, something unusual is happening and it warrants investigation.",
    "perActionCost": {
      "report_generated": 5,
      "batch_compute_run": 10,
      "chinese_wall_violation_attempt": 500,
      "separation_of_duties_violation_attempt": 500
    },
    "freezeOnBreach": true,
    "escalateAt": 70,
    "freezeOnBreachComment": "tca-analyzer is frozen on breach. A post-trade analysis agent consuming >100 risk units/day is anomalous and warrants human review before it continues."
  },

  "humanOversight": {
    "required": true,
    "euAiActArticle": "Art.14",
    "gates": [
      {
        "trigger": "rts28_report_generated",
        "action": "REQUIRE_HUMAN_REVIEW_BEFORE_PUBLICATION",
        "reviewChannel": "compliance-officer-review-queue",
        "comment": "RTS 28 reports are regulatory filings. A compliance officer must review and approve before the report is promoted from staging to the published compliance directory and submitted to the regulator."
      }
    ]
  }
}
```

---

## 4. Chinese Wall SOE Cross-Reference

The following table documents every ResearchNexus path pattern and its status across all 3 TradeSentinel agents.

| Path Pattern | order-router | execution-monitor | tca-analyzer | Regulatory Basis |
|---|---|---|---|---|
| `research-nexus/published/reports/**` | ALLOW | DENY | DENY | Post-publication; no MNPI risk |
| `research-nexus/published/esg-scores/published/**` | ALLOW | DENY | DENY | Post-publication; mandate pre-trade check |
| `research-nexus/pre-publication/**` | **DENY** | **DENY** | **DENY** | MAR Art.10, Reg FD |
| `research-nexus/draft/**` | **DENY** | **DENY** | **DENY** | MAR Art.10, Reg FD |
| `research-nexus/analyst-workspace/**` | **DENY** | **DENY** | **DENY** | MAR Art.10, Reg FD |
| `research-nexus/pending-approval/**` | **DENY** | **DENY** | **DENY** | MAR Art.10, Reg FD |
| `research-nexus/staging/**` | **DENY** | **DENY** | **DENY** | MAR Art.10, Reg FD |

Any attempt to access a DENY path generates a `chinese-wall-violation-attempt` event in the Chronicle audit trail and triggers a Beacon anomaly alert. The cost of 500 risk units for this event class ensures that a single chinese wall violation attempt is sufficient to freeze the agent and escalate to the compliance team.

---

*This document is part of the AssetCo AI Platform documentation suite. SOE definitions are the authoritative source of truth for agent permissions. Any change to a production SOE definition requires a change control review by the Compliance Technology and Security Architecture teams.*
