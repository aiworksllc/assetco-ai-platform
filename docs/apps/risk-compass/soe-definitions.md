# RiskCompass — SOE Definitions

**Document:** apps/risk-compass/soe-definitions.md
**Application:** RiskCompass — Real-Time Risk Analytics
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** Sarah Nakamura, CRO / James Chen, CTO
**Classification:** Internal — Confidential

---

## 1. Design Principles for RiskCompass SOEs

RiskCompass SOE definitions encode a single overarching principle: **maximum read, zero write**. The four agents collectively need the broadest data read access of any application in the platform — they must see all positions across all funds to compute firm-level aggregates — but must have absolutely no ability to modify any position, order, or record in any upstream system.

The second principle is **alert-only enforcement**. `limit-enforcer` is the most powerful agent in terms of authority to trigger actions, but that authority is strictly limited to notifications. Its toolActions SOE explicitly denies every trade, order, and position tool by name.

All four agents share the same base deny list for write and modification tools, which is expressed as a shared parent SOE (`riskcompass-base.soe.json`) from which each agent inherits.

---

## 2. Base SOE — riskcompass-base.soe.json

All four RiskCompass agents inherit from this base. It encodes the firm-wide write prohibition and the deny list of trade-adjacent tools.

```json
{
  "id": "riskcompass-base",
  "version": "1.0.0",
  "description": "Base SOE for all RiskCompass agents. Encodes the read-only, analytics-only constraint shared across the application.",
  "meta": {
    "application": "RiskCompass",
    "owner": "sarah.nakamura@assetco.com",
    "euAiActClass": "HIGH_RISK",
    "deploymentPhase": 1,
    "approvedBy": "Model Risk Committee",
    "approvalDate": "2026-01-15"
  },
  "dataAccess": {
    "writeAllow": [],
    "writeDeny": ["**"],
    "comment_writeAllow": "ZERO write access. All write attempts by any RiskCompass agent are denied at the SOE gate. This cannot be overridden by child SOE definitions."
  },
  "toolActions": {
    "deny": [
      "bloomberg_aim.place_order",
      "bloomberg_aim.cancel_order",
      "bloomberg_aim.modify_order",
      "bloomberg_aim.write_position",
      "aladdin.write_*",
      "aladdin.modify_*",
      "internal_api.post_trade",
      "internal_api.cancel_trade",
      "internal_api.modify_position",
      "alphaengine.submit_instruction",
      "tradesentinel.submit_order",
      "tradesentinel.cancel_order",
      "opsfabric.write_settlement",
      "bash",
      "edit",
      "write",
      "file_write",
      "db_write",
      "db_update",
      "db_delete"
    ],
    "comment_deny": "Absolute deny list. Any tool matching these patterns is blocked regardless of child SOE configuration. Includes all OMS, trade execution, position modification, and filesystem write tools."
  },
  "failMode": "CLOSED",
  "escalationTarget": "sarah.nakamura@assetco.com",
  "auditRetention": {
    "riskCalculations": "7_years",
    "routineMonitoring": "5_years",
    "comment": "7-year retention for regulatory-grade risk calculations per Basel III / AIFMD requirements. 5-year minimum for routine exposure checks per SEC Rule 204-2."
  }
}
```

---

## 3. SOE: var-calculator

```json
{
  "id": "riskcompass-var-calculator",
  "version": "1.0.0",
  "description": "SOE for var-calculator agent. Computes parametric, historical, and Monte Carlo VaR at fund, strategy, and firm level. Read access to all position data, market data, and risk factor libraries across all 5 business lines.",
  "inherits": "riskcompass-base",
  "identity": {
    "agentName": "var-calculator",
    "application": "RiskCompass",
    "role": "RiskAnalytics-VaR",
    "allowedPersonas": ["var-calculator"],
    "authorityLevel": "read-only-risk-analytics",
    "environmentScope": ["production", "uat"],
    "euAiActClass": "HIGH_RISK",
    "srr117ModelId": "MDL-VAR-001",
    "comment_identity": "var-calculator operates under a read-only risk analytics role. It has no authority to execute, modify, or instruct any operational system."
  },
  "dataAccess": {
    "readAllow": [
      "bloomberg-aim/positions/**",
      "bloomberg-aim/blotter/executed/**",
      "bloomberg-aim/instruments/**",
      "bloomberg-aim/sector-classifications/**",
      "bloomberg-aim/fx-rates/**",
      "bloomberg-aim/commodity-prices/**",
      "aladdin/risk-factors/**",
      "aladdin/covariance-matrices/**",
      "aladdin/factor-loadings/**",
      "aladdin/benchmark-compositions/**",
      "aladdin/var-model-inputs/**",
      "snowflake/historical-returns/**",
      "snowflake/var-backtesting-data/**",
      "snowflake/risk-scenarios/**",
      "alphaengine/model-portfolios/positions/**",
      "tradesentinel/executed-trades/**",
      "opsfabric/settled-positions/**",
      "riskcompass/limits-config/**",
      "riskcompass/var-model-config/**",
      "comment_readAllow": "Broadest read scope required for cross-fund VaR aggregation. All 5 business lines' positions are in scope. Market data (FX, commodity, benchmark) required for full repricing."
    ],
    "readDeny": [
      "clients/**",
      "advisorlens/**",
      "client-records/**",
      "client-pii/**",
      "research-nexus/staging/**",
      "research-nexus/pre-publication/**",
      "deal-room/**",
      "private-markets/deal-files/**",
      "private-markets/lp-records/**",
      "tradesentinel/order-routing/**",
      "tradesentinel/pending-orders/**",
      "bloomberg-aim/pending-orders/**",
      "**/.env",
      "**/credentials*",
      "**/secrets*",
      "comment_readDeny": "Client PII, pre-publication research (Reg FD protection), deal room data, and pending order routing details are denied. VaR only requires executed/settled positions, not order intentions."
    ],
    "writeAllow": [],
    "writeDeny": ["**"],
    "comment_write": "Inherited from riskcompass-base. Zero write access."
  },
  "toolActions": {
    "allow": [
      "bloomberg_aim.read_positions",
      "bloomberg_aim.read_instruments",
      "bloomberg_aim.read_market_data",
      "aladdin.read_risk_factors",
      "aladdin.read_covariance",
      "aladdin.read_benchmarks",
      "snowflake.query_historical_returns",
      "snowflake.query_backtesting",
      "snowflake.query_scenarios",
      "riskcompass.publish_var_report",
      "riskcompass.publish_alert",
      "chronicle.log_calculation",
      "chronicle.log_backtesting_exception",
      "dashboard.write_var_metrics",
      "notification.send_limit_approach_alert"
    ],
    "deny": ["inherited_from_riskcompass_base"],
    "bash": {
      "allow": [],
      "deny": ["*"],
      "comment_bash": "No bash execution. var-calculator is a pure analytics agent."
    },
    "edit": {
      "allowPaths": [],
      "denyPaths": ["**"],
      "comment_edit": "No file edit access."
    }
  },
  "riskBudget": {
    "dailyLimit": 200,
    "hourlyLimit": 25,
    "onDemandBurst": 10,
    "comment": "200/day accommodates hourly scheduled runs (8 market-hours × ~15 tool calls each) plus ~80 on-demand calls. Burst limit of 10 consecutive rapid calls prevents runaway computation loops."
  },
  "rateLimiting": {
    "backend": "HotCache",
    "windowSeconds": 3600,
    "maxCallsPerWindow": 25,
    "comment": "HotCache backend for shared rate limiting across instances. Prevents dual-instance race in VaR calculation scheduling."
  }
}
```

---

## 4. SOE: stress-tester

```json
{
  "id": "riskcompass-stress-tester",
  "version": "1.0.0",
  "description": "SOE for stress-tester agent. Runs predefined and custom stress scenarios (2008 GFC, rate shocks, credit spread widening, EM currency crisis). Reads macro factor data and positions. Does NOT have access to pre-publication research or trade order routing.",
  "inherits": "riskcompass-base",
  "identity": {
    "agentName": "stress-tester",
    "application": "RiskCompass",
    "role": "RiskAnalytics-Stress",
    "allowedPersonas": ["stress-tester"],
    "authorityLevel": "read-only-risk-analytics",
    "environmentScope": ["production", "uat"],
    "euAiActClass": "HIGH_RISK",
    "srr117ModelId": "MDL-STRESS-001",
    "comment_identity": "stress-tester has a narrower read scope than var-calculator. It needs positions and macro factor sensitivities but not the full granular market data feed required for VaR repricing."
  },
  "dataAccess": {
    "readAllow": [
      "bloomberg-aim/positions/**",
      "bloomberg-aim/instruments/**",
      "bloomberg-aim/factor-sensitivities/**",
      "bloomberg-aim/liquidity-profiles/**",
      "bloomberg-aim/bid-ask-spreads/**",
      "bloomberg-aim/adv-data/**",
      "aladdin/factor-loadings/**",
      "aladdin/stress-factor-mappings/**",
      "aladdin/duration-analytics/**",
      "aladdin/spread-dv01/**",
      "snowflake/historical-scenario-paths/**",
      "snowflake/macro-factor-returns/**",
      "snowflake/liquidity-historical/**",
      "alphaengine/model-portfolios/positions/**",
      "tradesentinel/executed-trades/**",
      "opsfabric/settled-positions/**",
      "riskcompass/stress-scenario-library/**",
      "riskcompass/scenario-parameters/**",
      "comment_readAllow": "Stress testing requires position data, macro factor sensitivities (DV01, beta, spread DV01, FX delta), historical scenario factor paths, and liquidity data for AIFMD liquidity stress tests."
    ],
    "readDeny": [
      "clients/**",
      "advisorlens/**",
      "client-pii/**",
      "research-nexus/**",
      "deal-room/**",
      "private-markets/deal-files/**",
      "tradesentinel/order-routing/**",
      "tradesentinel/pending-orders/**",
      "bloomberg-aim/pending-orders/**",
      "bloomberg-aim/order-management/**",
      "**/.env",
      "**/credentials*",
      "**/secrets*",
      "comment_readDeny": "Pre-publication research is denied (stronger deny than var-calculator — entire research-nexus path is denied, not just staging). Stress scenario design should not be influenced by unannounced research signals. Pending orders excluded — only executed positions in scope."
    ],
    "writeAllow": [],
    "writeDeny": ["**"],
    "comment_write": "Inherited from riskcompass-base. Zero write access."
  },
  "toolActions": {
    "allow": [
      "bloomberg_aim.read_positions",
      "bloomberg_aim.read_instruments",
      "bloomberg_aim.read_factor_sensitivities",
      "bloomberg_aim.read_liquidity_profiles",
      "aladdin.read_factor_loadings",
      "aladdin.read_stress_mappings",
      "snowflake.query_historical_scenarios",
      "snowflake.query_macro_factors",
      "snowflake.query_liquidity",
      "riskcompass.run_stress_scenario",
      "riskcompass.publish_stress_report",
      "riskcompass.publish_alert",
      "chronicle.log_stress_execution",
      "dashboard.write_stress_results",
      "notification.send_stress_alert"
    ],
    "deny": ["inherited_from_riskcompass_base"],
    "bash": {
      "allow": [],
      "deny": ["*"]
    },
    "edit": {
      "allowPaths": [],
      "denyPaths": ["**"]
    }
  },
  "riskBudget": {
    "dailyLimit": 100,
    "hourlyLimit": 20,
    "onDemandBurst": 5,
    "comment": "100/day reflects lower frequency of stress test execution relative to continuous VaR monitoring. Burst limit of 5 prevents rapid sequential scenario executions that could degrade system performance."
  },
  "rateLimiting": {
    "backend": "HotCache",
    "windowSeconds": 3600,
    "maxCallsPerWindow": 20
  }
}
```

---

## 5. SOE: exposure-monitor

```json
{
  "id": "riskcompass-exposure-monitor",
  "version": "1.0.0",
  "description": "SOE for exposure-monitor agent. BROADEST read access of any agent in the AssetCo AI Platform. Must aggregate positions cross-fund, cross-asset-class for firm-level exposure analysis. Zero write access. Does not need order routing, PII, or pre-publication research.",
  "inherits": "riskcompass-base",
  "identity": {
    "agentName": "exposure-monitor",
    "application": "RiskCompass",
    "role": "RiskAnalytics-Exposure",
    "allowedPersonas": ["exposure-monitor"],
    "authorityLevel": "read-only-cross-fund-aggregation",
    "environmentScope": ["production", "uat"],
    "euAiActClass": "HIGH_RISK",
    "comment_identity": "exposure-monitor holds the highest data access privilege in the platform by design. Its cross-fund mandate requires reading from all 5 business lines simultaneously. The broad read access is explicitly authorized by the CRO and documented in the conformity assessment."
  },
  "dataAccess": {
    "readAllow": [
      "bloomberg-aim/positions/**",
      "bloomberg-aim/blotter/executed/**",
      "bloomberg-aim/instruments/**",
      "bloomberg-aim/sector-classifications/**",
      "bloomberg-aim/geography-classifications/**",
      "bloomberg-aim/issuer-data/**",
      "bloomberg-aim/counterparty-data/**",
      "bloomberg-aim/fx-hedges/**",
      "bloomberg-aim/derivative-positions/**",
      "bloomberg-aim/credit-default-swaps/**",
      "aladdin/factor-loadings/**",
      "aladdin/issuer-crosswalk/**",
      "aladdin/sector-factor-mappings/**",
      "aladdin/counterparty-classifications/**",
      "snowflake/positions-historical/**",
      "snowflake/exposure-history/**",
      "alphaengine/model-portfolios/positions/**",
      "alphaengine/model-portfolios/sector-weights/**",
      "tradesentinel/executed-trades/**",
      "tradesentinel/blotter/**",
      "opsfabric/settled-positions/**",
      "opsfabric/custodian-reconciled-positions/**",
      "private-markets/positions/**",
      "private-markets/valuations/**",
      "multi-asset/positions/**",
      "fixed-income/positions/**",
      "equities/positions/**",
      "alternatives/positions/**",
      "riskcompass/limits-config/**",
      "riskcompass/exposure-limits/**",
      "riskcompass/concentration-limits/**",
      "comment_readAllow": "Explicit cross-fund read grant covering all 5 business lines (equities, fixed-income, alternatives, multi-asset, private-markets) and all 3 trading applications (alphaengine, tradesentinel, opsfabric). Issuer crosswalk data (Aladdin) required to aggregate positions in same issuer held under different identifiers (ISIN, CUSIP, SEDOL) across strategies."
    ],
    "readDeny": [
      "clients/**",
      "advisorlens/**",
      "client-pii/**",
      "client-records/**",
      "research-nexus/**",
      "deal-room/**",
      "private-markets/deal-files/**",
      "private-markets/lp-records/**",
      "private-markets/investment-committee/**",
      "tradesentinel/order-routing/**",
      "tradesentinel/venue-selection/**",
      "tradesentinel/pending-orders/**",
      "bloomberg-aim/pending-orders/**",
      "bloomberg-aim/order-management/**",
      "bloomberg-aim/tca-data/**",
      "**/.env",
      "**/credentials*",
      "**/secrets*",
      "comment_readDeny": "Denied: client PII (no client information needed for aggregate exposure), pre-publication research (entire research-nexus path), deal files (Private Markets deal structuring data not needed for position exposure), order routing details (TCA and venue selection data not needed — only executed positions matter for exposure calculation). The broad read grant above is scoped to position/valuation data only."
    ],
    "writeAllow": [],
    "writeDeny": ["**"],
    "comment_write": "Inherited from riskcompass-base. Zero write access. Despite having the broadest read access in the platform, exposure-monitor cannot write to any system."
  },
  "toolActions": {
    "allow": [
      "bloomberg_aim.read_positions",
      "bloomberg_aim.read_instruments",
      "bloomberg_aim.read_classifications",
      "bloomberg_aim.read_counterparties",
      "aladdin.read_factor_loadings",
      "aladdin.read_issuer_crosswalk",
      "aladdin.read_classifications",
      "snowflake.query_positions",
      "snowflake.query_exposure_history",
      "riskcompass.aggregate_exposure",
      "riskcompass.publish_exposure_report",
      "riskcompass.publish_concentration_alert",
      "riskcompass.publish_drift_alert",
      "chronicle.log_aggregation_run",
      "dashboard.write_exposure_metrics",
      "notification.send_concentration_alert",
      "limit_enforcer.feed_exposure_metrics"
    ],
    "deny": ["inherited_from_riskcompass_base"],
    "bash": {
      "allow": [],
      "deny": ["*"]
    },
    "edit": {
      "allowPaths": [],
      "denyPaths": ["**"]
    }
  },
  "riskBudget": {
    "dailyLimit": 500,
    "hourlyLimit": 60,
    "onDemandBurst": 20,
    "comment": "500/day is the highest riskBudget in RiskCompass reflecting continuous 5-minute polling across all position sources. 60/hour = 12 polls × 5 tool calls average per aggregation run. Burst of 20 allows catch-up after a brief interruption without throttling."
  },
  "rateLimiting": {
    "backend": "HotCache",
    "windowSeconds": 300,
    "maxCallsPerWindow": 5,
    "comment": "5-minute window matches polling frequency. HotCache prevents dual-instance double-counting in firm-wide exposure aggregation."
  }
}
```

---

## 6. SOE: limit-enforcer

```json
{
  "id": "riskcompass-limit-enforcer",
  "version": "1.0.0",
  "description": "SOE for limit-enforcer agent. Monitors against pre-set risk limits and triggers alerts/escalations on breach or near-breach. Can send notifications and feed ComplianceShield event queue. CANNOT take any trading or position action — alert-only authority.",
  "inherits": "riskcompass-base",
  "identity": {
    "agentName": "limit-enforcer",
    "application": "RiskCompass",
    "role": "RiskAnalytics-LimitEnforcement",
    "allowedPersonas": ["limit-enforcer"],
    "authorityLevel": "alert-only-no-trading-authority",
    "environmentScope": ["production", "uat"],
    "euAiActClass": "HIGH_RISK",
    "comment_identity": "limit-enforcer's authority is intentionally the most restricted in RiskCompass despite being the most action-oriented agent. It may alert humans; it may never act on their behalf."
  },
  "dataAccess": {
    "readAllow": [
      "riskcompass/limits-config/**",
      "riskcompass/var-outputs/**",
      "riskcompass/exposure-outputs/**",
      "riskcompass/leverage-metrics/**",
      "riskcompass/stress-outputs/**",
      "riskcompass/breach-history/**",
      "riskcompass/aifmd-leverage-limits/**",
      "bloomberg-aim/positions/summary/**",
      "aladdin/regulatory-limits/**",
      "compliance-shield/limit-config/**",
      "comment_readAllow": "limit-enforcer reads computed risk outputs from its sibling agents (var-calculator outputs, exposure-monitor outputs) rather than raw position data. It also reads the limits configuration store and ComplianceShield's regulatory limit definitions for AIFMD and Basel III thresholds."
    ],
    "readDeny": [
      "bloomberg-aim/positions/detail/**",
      "bloomberg-aim/blotter/**",
      "bloomberg-aim/order-management/**",
      "bloomberg-aim/pending-orders/**",
      "tradesentinel/**",
      "alphaengine/**",
      "opsfabric/**",
      "clients/**",
      "advisorlens/**",
      "client-pii/**",
      "research-nexus/**",
      "deal-room/**",
      "private-markets/**",
      "snowflake/**",
      "aladdin/risk-factors/**",
      "aladdin/covariance-matrices/**",
      "**/.env",
      "**/credentials*",
      "**/secrets*",
      "comment_readDeny": "limit-enforcer does NOT need raw position data, market data, factor data, or historical data — it consumes the pre-computed aggregates from var-calculator and exposure-monitor. Direct position data access is denied to enforce the principle that limit-enforcer is a consumer of risk outputs, not a risk calculator itself. This prevents it from independently recalculating limits in a way that could diverge from the authoritative var-calculator output."
    ],
    "writeAllow": [],
    "writeDeny": ["**"],
    "comment_write": "Inherited from riskcompass-base. Zero write access to any data store."
  },
  "toolActions": {
    "allow": [
      "riskcompass.read_var_outputs",
      "riskcompass.read_exposure_metrics",
      "riskcompass.read_leverage_metrics",
      "riskcompass.read_limits_config",
      "riskcompass.generate_breach_event",
      "riskcompass.generate_near_breach_alert",
      "riskcompass.log_limit_check",
      "notification.send_slack_alert",
      "notification.send_email_alert",
      "compliance_shield.publish_breach_event",
      "chronicle.log_limit_breach",
      "chronicle.log_near_breach",
      "chronicle.log_limit_check_result",
      "escalation.notify_cro",
      "escalation.notify_risk_manager",
      "escalation.notify_cco",
      "comment_allow": "limit-enforcer is permitted to use notification and escalation tools (Slack, email, escalation workflow). These are the only 'write-equivalent' tools it holds. It can publish a structured breach event to ComplianceShield's event queue (not to ComplianceShield's data store directly)."
    ],
    "deny": [
      "bloomberg_aim.*_order",
      "bloomberg_aim.*_position",
      "bloomberg_aim.cancel*",
      "bloomberg_aim.modify*",
      "bloomberg_aim.submit*",
      "tradesentinel.*",
      "alphaengine.submit*",
      "opsfabric.write*",
      "compliance_shield.write_record",
      "compliance_shield.modify_record",
      "compliance_shield.delete_record",
      "riskcompass.modify_limit",
      "riskcompass.override_limit",
      "riskcompass.suppress_alert",
      "riskcompass.delete_breach_event",
      "bash",
      "edit",
      "write",
      "comment_deny": "Explicit deny list beyond the inherited base. limit-enforcer CANNOT modify limits (read-only to limits config), CANNOT suppress or delete an alert once generated (append-only enforcement), CANNOT write to ComplianceShield's primary record store (only to the event queue), and CANNOT take any trading, order, or position action."
    ],
    "bash": {
      "allow": [],
      "deny": ["*"]
    },
    "edit": {
      "allowPaths": [],
      "denyPaths": ["**"]
    }
  },
  "riskBudget": {
    "dailyLimit": 300,
    "hourlyLimit": 35,
    "onDemandBurst": 15,
    "comment": "300/day covers 12 checks/hour × 8 market hours × ~3 tool calls per check = 288, plus buffer for breach escalation calls. Burst of 15 handles a cascade of limit approaches during market stress (multiple limits approaching simultaneously)."
  },
  "rateLimiting": {
    "backend": "HotCache",
    "windowSeconds": 300,
    "maxCallsPerWindow": 35,
    "comment": "Matches 5-minute monitoring frequency. HotCache prevents duplicate breach events if two instances detect the same breach simultaneously."
  },
  "alertDeduplication": {
    "enabled": true,
    "windowSeconds": 300,
    "comment": "Suppresses duplicate alerts for the same limit/fund combination within a 5-minute window. Prevents notification fatigue during persistent limit approaches without suppressing the underlying monitoring."
  }
}
```

---

## 7. SOE Inheritance Structure

```
riskcompass-base.soe.json
  │  writeAllow: []
  │  writeDeny: ["**"]
  │  toolActions.deny: [all trade tools, bash, edit, write]
  │
  ├── riskcompass-var-calculator.soe.json
  │     readAllow: [ALL positions + market data + risk factors]
  │     readDeny: [client PII, pre-pub research, deal room, pending orders]
  │     riskBudget: 200/day
  │
  ├── riskcompass-stress-tester.soe.json
  │     readAllow: [positions + factor sensitivities + historical scenarios]
  │     readDeny: [ALL of research-nexus, client PII, deal room, pending orders]
  │     riskBudget: 100/day
  │
  ├── riskcompass-exposure-monitor.soe.json
  │     readAllow: [BROADEST — all 5 business lines, all asset classes, all trading apps]
  │     readDeny: [client PII, ALL of research-nexus, deal files, LP records, order routing]
  │     riskBudget: 500/day
  │
  └── riskcompass-limit-enforcer.soe.json
        readAllow: [risk outputs from sibling agents + limits config only]
        readDeny: [raw positions, market data, ALL trading apps, ALL of research-nexus]
        toolActions.allow: [notification tools, escalation tools, compliance event queue]
        toolActions.deny: [+limit modification, +alert suppression, +compliance record write]
        riskBudget: 300/day
```

---

*Document owner: Sarah Nakamura, CRO. Changes to SOE definitions require CRO + CTO approval and Model Risk Committee review. SOE definitions are version-controlled and any change triggers a new conformity assessment review.*
