# AssetCo AI Platform — EU AI Act Compliance Mapping

**Document:** EU AI Act Cross-Reference
**Regulation:** Regulation (EU) 2024/1689 (EU AI Act, effective August 2024; HIGH RISK obligations apply from August 2026)
**Organization:** AssetCo ($85B AUM global asset manager)
**Scope:** All 7 AI applications, 25 agents, governed by Sentinel-Ops SOE
**Maintainer:** AI Governance Office / Compliance & Legal
**Last Updated:** 2026-03-20

---

## Part I — Risk Classification (Art.6 + Annex III)

HIGH RISK classification under Annex III applies where AI systems are used in financial services to make or influence decisions that affect individuals' access to financial products or the management of their assets.

| Application | Classification | Annex III Basis | Rationale |
|---|---|---|---|
| AlphaEngine | **HIGH RISK** | Category 5(b) — Financial services (credit, insurance, asset management) | Determines capital allocation across client portfolios; allocation decisions directly affect client financial outcomes; fiduciary obligations attach |
| TradeSentinel | **HIGH RISK** | Category 5(b) | Executes trades autonomously on behalf of clients; real-time execution decisions with irreversible financial consequences; market abuse risk |
| RiskCompass | **HIGH RISK** | Category 5(b) | Computes binding risk limits enforced across all funds; limit breach escalations constrain trading activity; material influence on investment outcomes |
| AdvisorLens | **HIGH RISK** | Category 5(b) + Art.52 | Generates client-facing investment recommendations with fiduciary implications; interacts with natural persons in advisory capacity (dual classification) |
| ComplianceShield | **SIGNIFICANT** | Not Annex III HIGH RISK | Performs surveillance and regulatory filing with mandatory human review before material actions; does not directly affect client capital |
| ResearchNexus | **SIGNIFICANT** | Not Annex III HIGH RISK | Human analyst publication gate prevents direct AI-to-trading pipeline; ESG scoring outputs are inputs to human decisions, not autonomous decisions |
| OpsFabric | **LIMITED** | Not Annex III HIGH RISK | Operational automation with deterministic settlement rules; investment decisions not in scope; NAV publication subject to dual-approval human gate |

---

## Part II — Article-by-Article Mapping

### Master Compliance Table

| Article | Requirement | App | Agent | SOE Control | Evidence |
|---|---|---|---|---|---|
| **Art.9 — Risk Management System** | Continuous risk management throughout AI system lifecycle; identify, analyze, estimate, and mitigate foreseeable risks | AlphaEngine | portfolio-optimizer, rebalancer | Arbiter async risk scoring; risk budget enforced in SOE definition; fail-closed gate blocks execution when risk budget exhausted | `alpha-engine.soe.json` → `riskBudget` section; Arbiter event log in Chronicle |
| Art.9 | Risk management system | TradeSentinel | order-router | Pre-trade risk gate in SOE deterministic pre-filter; execution blocked for orders exceeding notional or concentration limits | `trade-sentinel.soe.json` → `toolActions.bash.deny` patterns for oversized orders |
| Art.9 | Risk management system | RiskCompass | limit-enforcer | RiskCompass itself IS the risk management system; alert-only enforcement ensures human decision on limit breaches; SOE prevents autonomous limit override | `risk-compass.soe.json` → write access blocked to trading systems |
| Art.9 | Risk management system | AdvisorLens | suitability-checker | Risk budget for client-impact actions; GDPR Art.22 gate triggers human review for material allocation changes (>2% or >€10K impact) | `advisor-lens.soe.json` → `humanApprovalGates` |
| **Art.10 — Data Governance** | Training data must be relevant, representative, free of errors; data governance and management practices | AlphaEngine | all agents | `dataAccess.readDeny` blocks access to unvalidated data sources; data classification enforced (PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED); pre-publication research paths deny-listed | `alpha-engine.soe.json` → `dataAccess.readDeny: ["research/staging/**", "research/pre-publication/**"]` |
| Art.10 | Data governance | TradeSentinel | order-router, tca-analyzer | SOE data classification tiers enforced; CONFIDENTIAL market data paths (MNPI-flagged) require elevated access; deny rules prevent access to pre-publication research | `trade-sentinel.soe.json` → `dataAccess.readDeny: ["research/**", "mnpi/**"]` |
| Art.10 | Data governance | AdvisorLens | suitability-checker, proposal-generator | Client data classified RESTRICTED; read-only access enforced; no agent can write to client record systems; data minimization enforced via readAllow glob patterns | `advisor-lens.soe.json` → `dataAccess.readAllow: ["clients/profiles/**", "clients/portfolios/**"]`; writeDeny covers all client record paths |
| Art.10 | Data governance | ResearchNexus | esg-scorer | ESG data sources whitelisted via readAllow; access to non-approved sustainability data blocked; PAI data provenance tracked per SFDR RTS | `research-nexus.soe.json` → `dataAccess.readAllow: ["data/esg-approved/**", "data/taxonomy/**"]` |
| **Art.11 — Technical Documentation** | Technical documentation before market placement; updated continuously; available to national competent authorities | AlphaEngine | — | `alpha-engine.soe.json` constitutes machine-readable technical documentation; product spec `docs/apps/alpha-engine/` covers model description, intended purpose, limitations, accuracy metrics | `docs/apps/alpha-engine/` + `soe-definitions/alpha-engine.soe.json` |
| Art.11 | Technical documentation | TradeSentinel | — | SOE definition + execution policy document + MiFID II best execution policy constitute technical documentation package | `soe-definitions/trade-sentinel.soe.json` + `docs/apps/trade-sentinel/` |
| Art.11 | Technical documentation | RiskCompass | — | Risk model documentation (model card), validation reports, SOE definition | `docs/apps/risk-compass/` + model validation artifacts |
| Art.11 | Technical documentation | AdvisorLens | — | Suitability framework documentation, GDPR Art.22 implementation, Art.52 disclosure text | `docs/apps/advisor-lens/` |
| **Art.12 — Record-Keeping** | Automatic logging of events for lifetime of system; logs accessible to competent authorities | AlphaEngine | all agents | Chronicle append-only audit trail; every tool call logged with decision (ALLOW/DENY/ESCALATE), inputs, agent identity, timestamp, session ID; S3 lifecycle: active 2yr (hot) + 8yr (cold glacier) = 10yr | Chronicle `events.jsonl`; S3 bucket `assetco-chronicle-alpha-engine` with 10-yr lifecycle policy |
| Art.12 | Record-keeping | TradeSentinel | all agents | Chronicle logs every order-routing decision with venue selection rationale, pre-trade risk check result, execution outcome; retention 10 years | Chronicle `events.jsonl`; MiFIR Art.25 reports cross-referenced |
| Art.12 | Record-keeping | RiskCompass | all agents | VaR calculations, stress test inputs/outputs, limit breach events all logged with full methodology snapshot; retention 10 years | Chronicle `events.jsonl`; SR 11-7 model performance log |
| Art.12 | Record-keeping | AdvisorLens | all agents | Every recommendation logged with suitability check result, client profile snapshot at time of recommendation, human approval record, Art.52 disclosure status; retention 10 years | Chronicle `events.jsonl`; GDPR Art.22 human review log |
| **Art.13 — Transparency** | Sufficient information for deployers to interpret output; capabilities and limitations; degree of accuracy | AlphaEngine | portfolio-optimizer, factor-analyst | Every allocation decision logged with factor contribution breakdown (value, momentum, quality, size), constraint set active at decision time, model version; explanation endpoint required | Chronicle decision record schema: `{decision, factors[], constraints[], modelVersion, riskScore}` |
| Art.13 | Transparency | TradeSentinel | order-router | Venue selection rationale logged before order submission (SOE gate requirement); rationale covers: best execution policy match, venue liquidity score, fee comparison, time-of-day adjustment | SOE pre-gate check: `bash` command for order submission requires venue rationale JSON argument |
| Art.13 | Transparency | RiskCompass | var-calculator, stress-tester | VaR methodology documented per calculation (parametric/historical/Monte Carlo); scenario assumptions for stress tests captured in audit log | Chronicle: `{varMethodology, confidenceLevel, holdingPeriod, scenarioId, inputs}` |
| Art.13 | Transparency | AdvisorLens | proposal-generator, suitability-checker | Suitability check result includes: client risk profile tier, instrument risk class, match/mismatch determination, overriding factors if any; proposal includes AI disclosure under Art.52 | Advisory output schema: `{suitabilityResult, clientRiskTier, instrumentRiskClass, aiDisclosurePresent: true}` |
| **Art.14 — Human Oversight** | Technical and organizational measures for human oversight; ability to intervene, interrupt, or override | AlphaEngine | portfolio-optimizer, allocation-advisor | Human-in-the-loop gate: allocation proposals above €5M or triggering >3% portfolio drift require portfolio manager sign-off before TradeSentinel receives trade list; SOE blocks trade list write until approval token present | `alpha-engine.soe.json` → `humanApprovalGates: [{trigger: "allocationSize > 5000000", approver: "portfolio-manager"}]` |
| Art.14 | Human oversight | TradeSentinel | order-router, execution-monitor | Orders above €500K require human confirmation; kill switch: compliance officer can inject SOE override to halt all order-router execution; `execution-monitor` escalate-only (cannot independently cancel above threshold) | SOE kill switch: `SENTINEL_KILL_SWITCH=true` env var halts all TradeSentinel tool calls |
| Art.14 | Human oversight | RiskCompass | limit-enforcer | `limit-enforcer` generates alerts and escalation events but cannot autonomously constrain portfolios; limit breach response requires human risk officer action | `risk-compass.soe.json` → `toolActions.edit.denyPaths: ["portfolios/**", "limits/**"]` |
| Art.14 | Human oversight | AdvisorLens | proposal-generator | All client-facing proposals require advisor review and explicit approval before delivery; SOE enforces: write to client-delivery path blocked until `approval_token` present in session context | `advisor-lens.soe.json` → `humanApprovalGates: [{trigger: "allClientProposals", approver: "relationship-manager"}]` |
| **Art.15 — Accuracy, Robustness, Cybersecurity** | Appropriate level of accuracy, robustness, and cybersecurity; resilience against errors and adversarial inputs | AlphaEngine | all agents | Arbiter cumulative risk scoring detects trajectory drift; Beacon cross-agent anomaly detection flags unusual allocation patterns; model validation per SR 11-7 before deployment and on material change | Arbiter risk score in every Chronicle record; Beacon anomaly alerts in `beacon-monitor.js` |
| Art.15 | Accuracy/robustness | TradeSentinel | all agents | Arbiter monitors execution quality trajectory; Beacon detects anomalous order patterns (potential manipulation); pre-trade validation rejects malformed or adversarially crafted order parameters | SOE deterministic pre-filter: regex validation of order parameters before any AI evaluation |
| Art.15 | Accuracy/robustness | RiskCompass | var-calculator | Backtesting results tracked; VaR model exceptions logged; Beacon alerts on unusual risk calculation patterns; model performance reviewed quarterly | SR 11-7 backtesting log; Basel III VaR exception tracking |
| Art.15 | Accuracy/robustness | AdvisorLens | suitability-checker | Suitability model accuracy tracked against advisor override rate; high override rate triggers model review; Beacon alerts on demographic skew in suitability outcomes (MAS FEAT fairness) | Override rate dashboard; Beacon fairness monitor |
| **Art.17 — Quality Management** | Quality management system covering: policies, procedures, controls, oversight, testing, monitoring | All HIGH RISK apps | — | SOE lifecycle: shadow → warn → soft enforce → full enforce graduation protocol; change management: SOE definition changes require peer review and compliance sign-off; all changes version-controlled | SOE deployment pipeline in CI/CD; `soe-definitions/` version history in git |
| Art.17 | Quality management | AlphaEngine | — | Shadow mode: new model version runs alongside production, decisions logged but not enforced; warn mode: human notified of would-be actions; soft enforce: human can override; full enforce: SOE gates active | `ALPHA_ENGINE_SOE_MODE=shadow|warn|soft|enforce` in deployment config |
| Art.17 | Quality management | TradeSentinel | — | Same lifecycle; FCA PS 19/1 annual self-assessment aligned with Art.17 quality management review | FCA algorithmic trading self-assessment checklist mapped to Art.17 requirements |
| **Art.52 — Transparency Obligations (AI Interaction)** | Inform natural persons they are interacting with an AI system; applies to AI systems interacting with persons | AdvisorLens | proposal-generator, client-reporter | SOE gate verifies every client-facing output contains mandatory AI disclosure string before write to delivery path; outputs without disclosure blocked; disclosure language: "This analysis was generated with AI assistance. Your advisor has reviewed this recommendation." | `advisor-lens.soe.json` → `outputValidation: {requiredString: "generated with AI assistance", denyIfAbsent: true}` |
| Art.52 | Transparency | ComplianceShield | regulatory-filer | Regulatory filings include AI system identifier and model version in filing metadata; ESMA/NCA can identify AI-generated components | Filing metadata schema: `{aiSystemId: "compliance-shield-v2.1", filingType, timestamp}` |
| **Art.72 — Post-Market Monitoring** | Post-market monitoring plan; serious incident reporting within 15 business days | AlphaEngine | — | Beacon cross-agent anomaly detection feeds post-market monitoring; Arbiter trajectory analysis identifies model performance degradation before it becomes a serious incident | Beacon alert → ComplianceShield `regulatory-filer` → ESMA/NCA incident report workflow |
| Art.72 | Post-market monitoring | TradeSentinel | — | Execution quality monitoring (TCA) tracks post-market performance; Beacon detects anomalous execution patterns; serious incident: execution failure affecting >€1M client orders | `tca-analyzer` monthly performance report + Beacon anomaly threshold |
| Art.72 | Post-market monitoring | RiskCompass | — | VaR model performance tracked; backtesting exception rate monitored; >4 exceptions in 250 trading days triggers SR 11-7 review and potential Art.72 notification | Basel III VaR exception log cross-referenced with Art.72 notification threshold |
| Art.72 | Post-market monitoring | AdvisorLens | — | Suitability outcome tracking; client complaint correlation with AI recommendations; Beacon demographic skew monitoring | Complaint-to-recommendation correlation report; MAS FEAT annual assessment |

---

## Part III — Conformity Assessment Status

| Application | Conformity Assessment Required | Assessment Type | Status |
|---|---|---|---|
| AlphaEngine | Yes — Art.43 | Internal assessment (no notified body required for financial services AI) | Documented in `docs/apps/alpha-engine/conformity-assessment.md` |
| TradeSentinel | Yes — Art.43 | Internal assessment | Documented in `docs/apps/trade-sentinel/conformity-assessment.md` |
| RiskCompass | Yes — Art.43 | Internal assessment | Documented in `docs/apps/risk-compass/conformity-assessment.md` |
| AdvisorLens | Yes — Art.43 + Art.52 | Internal assessment + Art.52 compliance audit | Documented in `docs/apps/advisor-lens/conformity-assessment.md` |
| ComplianceShield | No — SIGNIFICANT RISK | Voluntary transparency and governance measures | Art.52 metadata applied to regulatory filings |
| ResearchNexus | No — SIGNIFICANT RISK | Voluntary transparency and governance measures | ESG scoring methodology documented per SFDR RTS |
| OpsFabric | No — LIMITED RISK | No mandatory assessment | NAV dual-approval controls documented |

---

## Part IV — Data Classification Tiers

SOE enforces four data classification tiers enforced via `dataAccess` rules in each application's SOE definition:

| Tier | Label | Examples | SOE Enforcement |
|---|---|---|---|
| 1 | PUBLIC | Published research, public market data, regulatory filings (post-submission) | No restriction — readAllow by default for all agents |
| 2 | INTERNAL | Internal model portfolios, draft research, internal risk reports | readAllow explicit; writeDeny for non-owning apps |
| 3 | CONFIDENTIAL | Client portfolios, trade history, pre-publication research, MNPI-flagged data | readAllow named agents only; all writes require approval gate |
| 4 | RESTRICTED | Client PII, credentials, settlement bank details, regulatory investigation files | readDeny by default; human approval required for any access |

---

*EU AI Act obligations for HIGH RISK applications apply from August 2026. AssetCo is implementing controls in advance to ensure full compliance on the effective date. This document is reviewed quarterly against ESMA guidance and European AI Office technical standards as they are published.*
