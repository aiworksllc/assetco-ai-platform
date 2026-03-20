# AssetCo AI Platform — SEC / FINRA Compliance Mapping

**Document:** SEC Advisers Act, Regulation NMS, FINRA Rules Cross-Reference
**Regulations:** Investment Advisers Act of 1940; Regulation NMS (17 CFR 242); Regulation FD (17 CFR 243); FINRA Rulebook; SR 11-7; Sarbanes-Oxley Act 2002
**Organization:** AssetCo ($85B AUM global asset manager)
**Scope:** All 7 AI applications, 25 agents, governed by Sentinel-Ops SOE
**Maintainer:** Compliance & Legal, AI Governance Office
**Last Updated:** 2026-03-20

---

## Part I — Master Compliance Table

| Provision | Source | Requirement | App | Agent | SOE Control | Evidence |
|---|---|---|---|---|---|---|
| **§206 Fiduciary Duty** | Advisers Act §206(1)-(4) | Investment adviser must act in client's best interest; duty of loyalty and care; disclose all material conflicts; no fraud or deception | AlphaEngine | portfolio-optimizer, allocation-advisor | Human-in-the-loop gate: allocation proposals above €5M or >3% portfolio drift require portfolio manager sign-off; SOE blocks trade list write to TradeSentinel until approval token present; every allocation decision logged with fiduciary rationale | `alpha-engine.soe.json` → `humanApprovalGates`; Chronicle: `{decision, rationaleType: "fiduciary", approver, approvalTimestamp}` |
| §206 Fiduciary | Advisers Act §206 | Fiduciary duty in client-facing recommendations | AdvisorLens | suitability-checker, proposal-generator | All client proposals require human advisor approval before delivery; GDPR Art.22 gate independently enforces human review for material allocation changes; SOE blocks delivery path write without approval token | `advisor-lens.soe.json` → `humanApprovalGates: [{trigger: "allClientProposals", approver: "relationship-manager"}]` |
| §206 Fiduciary | Advisers Act §206(3) | Principal trade restriction — cannot trade as principal against client account without consent | TradeSentinel | order-router | SOE deny pattern blocks principal-trade commands; any order marked `--trade-type PRINCIPAL` requires escalation and explicit compliance officer approval | `trade-sentinel.soe.json` → `toolActions.bash.deny: ["execute-order --trade-type PRINCIPAL"]`; escalation logged in Chronicle |
| **Rule 204-2 — Books and Records** | 17 CFR 275.204-2 | Retain records of investment advice, orders, and client communications for 5 years; most recent 2 years easily accessible | AlphaEngine | all agents | Chronicle append-only audit trail; S3 lifecycle: 2yr hot storage (immediate retrieval) + 8yr cold (Glacier, 24hr retrieval) = 10yr total; exceeds 5-year requirement | S3 bucket: `assetco-chronicle-alpha-engine`; lifecycle policy: `Transition to Glacier after 730 days, Delete after 3650 days` |
| Rule 204-2 | 17 CFR 275.204-2 | Retain records of investment advice | AdvisorLens | all agents | Every recommendation and client proposal logged with: client profile snapshot at decision time, suitability determination, recommendation text, model version, human approval record; 5-year minimum (10-year actual) | Chronicle records for `advisor-lens` agents; retrievable by client ID and date range |
| Rule 204-2 | 17 CFR 275.204-2 | 5-year retention for all records relating to business as investment adviser | RiskCompass | all agents | Risk calculations (VaR, stress tests) logged with full input snapshots; methodology documentation versioned; retained 10 years | Chronicle VaR records; model documentation in `docs/apps/risk-compass/` |
| **Rule 206(4)-2 — Custody Rule** | 17 CFR 275.206(4)-2 | Safeguards for client assets; client notification; independent verification (surprise exam or qualified custodian) | OpsFabric | settlement-processor, nav-calculator | SOE rate-limits `settlement-processor` to prevent duplicate instruction submission; `nav-calculator` cannot publish NAV to client systems without dual-approval gate; automated custody transfers above $50K require human confirmation | `ops-fabric.soe.json` → `rateLimits.settlementProcessor` + `humanApprovalGates: [{trigger: "navPublication", gate: "dual-approval"}]` |
| Custody Rule | 17 CFR 275.206(4)-2 | Reconciliation of custodian records | OpsFabric | reconciler | `reconciler` generates daily reconciliation report comparing internal records against custodian statements; discrepancies above materiality threshold trigger immediate escalation; SOE restricts reconciler to read-only (cannot modify source records) | Daily reconciliation report in `reports/reconciliation/`; discrepancy log in Chronicle |
| **Rule 206(4)-7 — Compliance Program** | 17 CFR 275.206(4)-7 | Written compliance policies and procedures; annual review; designated CCO | All apps | — | SOE definition files (`*.soe.json`) constitute the formal, machine-enforceable compliance controls under Rule 206(4)-7; human-readable policy documentation cross-references each SOE control; annual review documented | `soe-definitions/*.soe.json` version history in git; annual review log in ComplianceShield |
| Rule 206(4)-7 | 17 CFR 275.206(4)-7 | Compliance program must address conflicts of interest, portfolio management, trading | ComplianceShield | trade-surveiller, breach-detector | ComplianceShield surveils all trading activity for mandate violations and conflicts; breach-detector identifies Rule 206(4)-7 control failures; all findings logged append-only | ComplianceShield breach report; SOE escalation log |
| **Reg NMS Rule 611 — Order Protection** | 17 CFR 242.611 | Trade-through prohibition: must execute at national best bid/offer (NBBO) or better; route to protected quote | TradeSentinel | order-router | SOE pre-trade validation requires NBBO check before order submission; orders routed away from NBBO must include intermarket sweep order (ISO) flag and documented exception; SOE blocks orders that would trade through without ISO designation | `trade-sentinel.soe.json` → pre-trade: `{nbboCheck: required, tradeThrough: "deny-unless-ISO"}`; NBBO validation in deterministic pre-filter |
| Reg NMS Rule 610 | 17 CFR 242.610 | Access fees capped at $0.003 per share for protected quotations | TradeSentinel | order-router | Fee schedule validation in SOE deterministic pre-filter; venues with fees above Rule 610 cap are blocked from routing; fee schedule updated quarterly | `trade-sentinel.soe.json` → `venueFeeCap: 0.003`; quarterly fee schedule review |
| Reg NMS Rule 612 | 17 CFR 242.612 | Sub-penny rule: minimum pricing increment of $0.01 for shares above $1.00 | TradeSentinel | order-router | Order price format validation in SOE pre-filter; prices with more than 2 decimal places for eligible securities are rejected before AI evaluation | SOE regex: `priceValidation: "^\\d+\\.\\d{1,2}$"` for non-exempt securities |
| **Regulation FD** | 17 CFR 243.100-103 | Simultaneous public disclosure of material non-public information; selective disclosure prohibited | ResearchNexus | all agents | Chinese wall: ResearchNexus cannot write to channels accessible by AlphaEngine or TradeSentinel before publication gate; `market-analyst` and `fair-value-modeler` output staged — not accessible to trading apps until human analyst promotion to `published/` | `research-nexus.soe.json` → `dataAccess.writeDeny: ["alpha-engine/**", "trade-sentinel/**", "advisor-lens/**"]`; staging directory isolated |
| Reg FD | 17 CFR 243 | AI-generated research cannot be selectively routed to clients by tier | ResearchNexus | market-analyst, fair-value-modeler | SOE publication gate enforces simultaneous access: once promoted to `published/`, research is accessible to all apps simultaneously; tiered early access for preferred clients is architecturally impossible under SOE rules | Publication gate: single atomic promotion to `research-nexus/published/`; timestamp logged in Chronicle |
| Reg FD | 17 CFR 243 | Information barrier between MNPI-tagged data and trading systems | AlphaEngine | portfolio-optimizer | AlphaEngine `readDeny` covers `mnpi/**` and `research-nexus/staging/**`; T+1 delay enforced for MNPI-flagged research via SOE session context check | `alpha-engine.soe.json` → `dataAccess.readDeny: ["mnpi/**", "research-nexus/staging/**", "research-nexus/draft/**"]` |
| **FINRA Rule 3110 — Supervision** | FINRA Rule 3110 | Supervisory system for all business activities; review of correspondence and communications | ComplianceShield | trade-surveiller | `trade-surveiller` provides real-time and end-of-day surveillance covering all AlphaEngine and TradeSentinel activity; surveillance findings escalated to compliance officers; SOE audit trail satisfies supervisory record requirement | FINRA Rule 3110 supervision report; surveillance coverage metrics |
| FINRA Rule 3110 | FINRA Rule 3110 | Supervisory control testing; annual report to senior management | ComplianceShield | breach-detector | Annual supervisory control test report generated by `breach-detector` + Chronicle analytics; maps each supervisory control to SOE enforcement mechanism; presented to CCO and senior management | Annual supervisory control test report in `reports/finra/supervisory-controls-{YYYY}.pdf` |
| **FINRA Rule 2111 — Suitability** | FINRA Rule 2111 | Recommendations must be suitable based on reasonable basis, customer-specific, and quantitative suitability | AdvisorLens | suitability-checker | `suitability-checker` enforces all three prongs: reasonable basis (instrument risk analysis), customer-specific (client profile match), quantitative (excessive trading detection for fee accounts); mismatch blocks proposal | `advisor-lens.soe.json` → suitability validation schema; three-prong check logged in Chronicle |
| FINRA Rule 2111 | FINRA Rule 2111 | Customer-specific suitability: match to customer profile | AdvisorLens | proposal-generator | SOE requires suitability check completion (logged checksum) before `proposal-generator` can write to any output path; proposals without completed suitability check are blocked | `advisor-lens.soe.json` → pre-condition: `{suitabilityCheckComplete: true}` before proposal write allowed |
| **Form ADV Part 2B** | Advisers Act Rule 204-3 | Disclose supervised persons who provide investment advice; AI system disclosures | All apps | — | AI disclosure narrative in Form ADV Part 2B drafted by ComplianceShield `regulatory-filer`; includes: AI systems used, model types, limitations, oversight framework, SOE description; updated annually | `reports/form-adv/part-2b-ai-disclosure-{YYYY}.md`; ComplianceShield generates annually |
| **Form PF** | Dodd-Frank §404 | Quarterly/annual filing for private fund advisers >$150M AUM; hedge funds, PE funds, liquidity funds | AlphaEngine | portfolio-optimizer | AlphaEngine provides portfolio data feeds to Form PF calculation engine; SOE restricts AlphaEngine write access to Form PF data staging; data validated before ComplianceShield submission | `alpha-engine.soe.json` → `dataAccess.writeAllow: ["reporting/form-pf/staging/**"]` |
| Form PF | Dodd-Frank §404 | Quarterly Form PF filing (large hedge fund advisers): within 60 days of quarter end | ComplianceShield | regulatory-filer | `regulatory-filer` assembles Form PF XML from RiskCompass and AlphaEngine data feeds; validation against DTCC filing schema before submission; SOE blocks filing path write until validation passes | Quarterly Form PF in `reports/form-pf/Q{N}-{YYYY}.xml`; DTCC submission receipt logged |
| **SR 11-7 — Model Risk Management** | OCC SR 11-7 (2011) | Model inventory; independent validation before deployment and on material change; ongoing monitoring; documentation | AlphaEngine | portfolio-optimizer, rebalancer | AlphaEngine models in ComplianceShield model registry; SOE blocks deployment of model versions not registered in registry; independent validation required before registry entry; Arbiter monitors ongoing performance | ComplianceShield model registry; SOE deployment gate: `{modelVersion: registered, validationStatus: "APPROVED"}` |
| SR 11-7 | OCC SR 11-7 | Validation must include: conceptual soundness, data quality, backtesting, sensitivity analysis | RiskCompass | var-calculator | VaR model validation package: conceptual soundness doc, backtesting results (250-day), sensitivity analysis, stress test coverage; validation performed by independent risk team; results in ComplianceShield registry | Model validation report: `docs/apps/risk-compass/model-validation-{YYYY}.md` |
| SR 11-7 | OCC SR 11-7 | Ongoing monitoring: performance monitoring, outcome analysis | TradeSentinel | tca-analyzer, execution-monitor | `tca-analyzer` generates monthly execution quality reports comparing performance against baseline; anomalous performance triggers `execution-monitor` alert and SR 11-7 escalation review | Monthly TCA report; SR 11-7 ongoing monitoring log in Chronicle |
| SR 11-7 | OCC SR 11-7 | Challenger models for high-risk models | AlphaEngine | portfolio-optimizer | AlphaEngine maintains shadow challenger model running in parallel; quarterly performance comparison between production and challenger; challenger promotion requires independent validation and compliance sign-off | Challenger model comparison report in `reports/model-governance/challenger-{YYYY-QN}.md` |
| **SOX Section 302** | Sarbanes-Oxley §302 | CEO/CFO certify accuracy of financial statements; internal controls must be auditable; AI-generated inputs in scope | ComplianceShield | regulatory-filer | ComplianceShield `regulatory-filer` generates SOX-compliant audit package for all financial statements with AI-generated inputs; Chronicle audit trail provides complete evidence of control operation; SOE immutability guarantees audit trail integrity | SOX 302 certification package: `reports/sox/302-cert-{YYYY}.pdf`; maps each AI input to Chronicle evidence |
| SOX Section 302 | Sarbanes-Oxley §302 | NAV calculations subject to SOX internal controls | OpsFabric | nav-calculator | `nav-calculator` subject to dual-approval internal control; control operation logged in Chronicle; SOX testing performed quarterly by internal audit using Chronicle query | SOX control test evidence: Chronicle query for `nav-calculator` dual-approval events |
| **SOX Section 404** | Sarbanes-Oxley §404 | Annual assessment of internal controls over financial reporting; management assessment + external auditor attestation | ComplianceShield | breach-detector | `breach-detector` performs continuous control testing against SOX control objectives; annual SOX 404 report assembled from year's Chronicle evidence; all material weakness findings escalated immediately | Annual SOX 404 evidence package in `reports/sox/404-{YYYY}/` |
| SOX Section 404 | Sarbanes-Oxley §404 | AI models used in financial reporting are in-scope as automated controls | RiskCompass | var-calculator, exposure-monitor | RiskCompass models documented as automated controls in SOX IT general controls (ITGC) inventory; SOE controls (version management, access controls, audit trail) constitute ITGC controls for SOX 404 purposes | ITGC control mapping: `docs/sox/itgc-ai-controls-mapping.md` |

---

## Part II — Model Registry Requirements (SR 11-7 + EU AI Act Art.9)

All models deployed across AlphaEngine, TradeSentinel, and RiskCompass must be registered in ComplianceShield's model registry before SOE permits deployment. Registry fields required per SR 11-7:

| Field | Requirement | Example |
|---|---|---|
| Model ID | Unique identifier | `ALPHA-OPT-2.3.1` |
| Model Type | Optimization / Classification / Regression / Time-series | `Quadratic optimization (Black-Litterman)` |
| Risk Tier | Tier 1 (material) / Tier 2 / Tier 3 | `Tier 1 — material business line` |
| Intended Use | Specific use case and scope | `Portfolio construction for long-only equity mandates, AUM < $10B` |
| Input Data Sources | List all data sources | `Bloomberg prices, AlphaEngine factor signals, client mandate JSON` |
| Validation Status | PENDING / APPROVED / EXPIRED | `APPROVED — validated 2026-01-15, expires 2027-01-15` |
| Challenger Model | ID of challenger model (required for Tier 1) | `ALPHA-OPT-CHALLENGER-2.3.1` |
| Last Validation Date | Date of most recent independent validation | `2026-01-15` |
| Backtesting Results | Backtesting period and pass/fail | `250 days (2025-Q1 to 2025-Q4): 4 exceptions (PASS, < Basel red zone threshold of 10)` |

SOE deployment gate check:
```
soe-gate.js → pre-deployment: {
  modelId: must exist in ComplianceShield registry,
  validationStatus: must be "APPROVED",
  validationExpiry: must be future date
}
→ DENY deployment if any check fails
```

---

## Part III — Record Retention Summary

| Requirement | Regulation | Retention Period | Storage Tier | AssetCo Actual |
|---|---|---|---|---|
| Investment advisory records | Rule 204-2 | 5 years (2yr accessible) | Hot 2yr, warm 3yr | 10yr (hot 2yr, Glacier 8yr) |
| Transaction records | Reg NMS, MiFIR Art.25 | 5 years | Hot 2yr, warm 3yr | 10yr |
| Supervisory records | FINRA Rule 4511 | 6 years | Hot 2yr, warm 4yr | 10yr |
| Form PF filings | Dodd-Frank | Not specified (7yr recommended) | Filing archive | 10yr |
| SOX audit evidence | SOX §802 | 7 years (criminal penalties for destruction) | Immutable — append-only S3 | Permanent — Chronicle is append-only, no deletion |
| AI system records | EU AI Act Art.12 | Lifetime of system | Active system lifetime | Chronicle records never deleted while model is active |

---

*This document is reviewed annually and upon any material change to the applications or applicable regulations. All regulatory references are to rules as in effect 2026-03-20. For ERISA-specific obligations (§404 prudent expert, §406 prohibited transactions), see the separate ERISA compliance mapping maintained by the ERISA counsel team.*
