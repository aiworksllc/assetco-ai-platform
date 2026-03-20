# AssetCo AI Platform — Application Portfolio Overview

**Document:** 04-app-portfolio-overview.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** CTO, CRO, CCO, Technology Leadership

---

## 1. Executive Summary

The AssetCo AI Platform comprises **7 AI-powered applications** deployed across the investment lifecycle — from research and portfolio construction through trade execution, risk monitoring, regulatory compliance, client advisory, and operations. All 7 applications operate under the governance of **Sentinel-Ops**, enforcing a Safe Operating Envelope (SOE) that provides deterministic, auditable compliance with EU AI Act requirements and applicable financial regulations.

**Platform totals:** 7 applications, 25 agents, 4 regulatory jurisdictions (EU, US, UK, global clearing)

---

## 2. Summary Comparison Table

| Application | Domain | Agents | EU AI Act Class | Risk Level | Primary Regulations |
|---|---|---|---|---|---|
| AlphaEngine | Portfolio Optimization | 4 | Annex III — High Risk | HIGH | SEC Advisers Act, MiFID II, SFDR, ERISA |
| TradeSentinel | Trade Execution | 3 | Annex III — High Risk | HIGH | MiFID II Art.27, Reg NMS, MAR |
| RiskCompass | Risk Analytics | 4 | Annex III — High Risk | HIGH | Basel III/IV, Dodd-Frank, AIFMD |
| ComplianceShield | Regulatory Reporting | 4 | Significant Risk | SIGNIFICANT | SOX, FINRA, EMIR, MiFIR, DORA |
| AdvisorLens | Client Advisory | 3 | Annex III — High Risk | HIGH | Fiduciary, MiFID II Art.25, GDPR Art.22 |
| ResearchNexus | Research & ESG | 4 | Significant Risk | SIGNIFICANT | SFDR, EU Taxonomy, Reg FD |
| OpsFabric | Operations | 3 | Limited Risk | LIMITED | T+1/T+2 CSDR, EMIR clearing |
| **TOTAL** | | **25** | | | |

---

## 3. Inter-Application Dependency Diagram

The following diagram illustrates primary data flows between applications. All flows are subject to SOE-enforced information barriers where applicable.

```
                         ┌─────────────────────────────────────┐
                         │          ResearchNexus              │
                         │   (Published research only — gated) │
                         └──────────────────┬──────────────────┘
                                            │ Published reports only
                                            │ (Chinese wall enforced)
                          ┌─────────────────▼──────────────────┐
                          │           AlphaEngine              │
                          │     Portfolio Optimization          │
                          └─────────────────┬──────────────────┘
                                            │ Trade lists
                          ┌─────────────────▼──────────────────┐
                          │          TradeSentinel             │
                          │         Trade Execution            │
                          └──────┬──────────────────┬──────────┘
                                 │ Executed trades  │
                    ┌────────────▼────────┐         │
                    │      OpsFabric      │         │
                    │     Operations      │         │
                    └────────────┬────────┘         │
                                 │                  │
                    ┌────────────▼──────────────────▼──────────┐
                    │           ComplianceShield               │
                    │        Regulatory Reporting              │
                    └────────────────────┬─────────────────────┘
                                         │
                    ┌────────────────────▼─────────────────────┐
                    │             RiskCompass                  │◄──── All apps (position reads)
                    │           Risk Analytics                 │
                    └──────────────────────────────────────────┘

                    ┌──────────────────────────────────────────┐
                    │             AdvisorLens                  │◄──── ResearchNexus (published)
                    │           Client Advisory                │◄──── Client portfolio data
                    └──────────────────────────────────────────┘
```

**Key information barriers enforced by SOE:**
- ResearchNexus CANNOT read trading positions or pending orders (Reg FD compliance)
- TradeSentinel CANNOT read pre-publication research (chinese wall)
- AlphaEngine CANNOT read from ResearchNexus pre-publication (chinese wall)
- RiskCompass has read access across all apps but ZERO write access

---

## 4. Application Detail: AlphaEngine

### 4.1 Purpose and Business Value

AlphaEngine automates portfolio construction and rebalancing for AssetCo's managed accounts. It translates investment strategy mandates into optimal asset allocations, identifies rebalancing opportunities against drift thresholds, and surfaces factor-based attribution to portfolio managers. By automating the mechanics of optimization, AlphaEngine enables portfolio managers to focus on strategy and client relationships rather than computational execution.

### 4.2 Agents

| Agent | Role |
|---|---|
| `portfolio-optimizer` | Constructs optimal allocations given strategy constraints and published factor signals |
| `rebalancer` | Monitors portfolio drift against benchmarks, generates rebalancing trade lists |
| `allocation-advisor` | Advises on concentration limits, liquidity constraints, and mandate compliance |
| `factor-analyst` | Computes factor exposures (value, momentum, quality, size) and attribution |

### 4.3 EU AI Act Classification

**HIGH RISK — Annex III, Category 5b (Critical Infrastructure / Financial Services)**

AlphaEngine makes allocation decisions that directly affect client capital deployment. Outputs are consumed by downstream trade execution systems and result in real transactions. The fiduciary obligation to act in the best interest of clients, combined with the materiality of allocation decisions, places this system firmly in the High Risk category. Full conformity assessment required before deployment.

### 4.4 Primary Regulatory Frameworks

| Framework | Requirement |
|---|---|
| SEC Advisers Act (§206) | Fiduciary duty — allocation decisions must be in client's best interest |
| MiFID II (Art.25) | Suitability assessment — allocations matched to client risk profile |
| SFDR (Art.8/9) | Sustainability-related disclosures for ESG-oriented mandates |
| ERISA (§404) | Prudent expert standard for pension and retirement accounts |

### 4.5 Key SOE Constraints

- **Concentration enforcement:** SOE denies allocation instructions that exceed per-issuer, per-sector, or per-asset-class concentration limits defined in mandate
- **Chinese wall — research:** Read access restricted to ResearchNexus published-research directory only; pre-publication paths are deny-listed
- **Write isolation:** Write access restricted to `model-portfolios/**` directory; cannot write to execution or client record systems
- **Fiduciary audit:** Every allocation decision logged with rationale, factor inputs, and constraint set to immutable audit trail

### 4.6 Cross-App Dependencies

- **Reads from:** ResearchNexus (`/published/**` only, post-publication gate)
- **Outputs to:** TradeSentinel (trade lists for execution)
- **Monitored by:** RiskCompass (post-allocation exposure checks)

---

## 5. Application Detail: TradeSentinel

### 5.1 Purpose and Business Value

TradeSentinel governs the execution of trade instructions generated by AlphaEngine and discretionary portfolio managers. It enforces best execution obligations, monitors execution quality in real time, and produces transaction cost analysis (TCA) to demonstrate compliance with MiFID II Article 27. TradeSentinel ensures that every trade executed on behalf of clients is routed to the venue most likely to achieve the best outcome across price, speed, likelihood of execution, and cost.

### 5.2 Agents

| Agent | Role |
|---|---|
| `order-router` | Selects execution venue based on best execution policy; routes orders |
| `execution-monitor` | Real-time monitoring of open orders; flags execution quality anomalies |
| `tca-analyzer` | Post-trade TCA; benchmarks execution vs. arrival price, VWAP, implementation shortfall |

### 5.3 EU AI Act Classification

**HIGH RISK — Annex III, Category 5b (Financial Services)**

TradeSentinel executes trades on behalf of clients with real financial consequences. Best execution failures can result in material client harm and significant regulatory liability. The system operates in real time with limited human intervention in the execution loop, meeting the High Risk threshold.

### 5.4 Primary Regulatory Frameworks

| Framework | Requirement |
|---|---|
| MiFID II (Art.27) | Best execution obligation — must take all sufficient steps to achieve best result |
| Reg NMS (Rule 611) | Order protection rule — must route to national best bid/offer |
| MAR (Regulation 596/2014) | Market Abuse Regulation — execution patterns must not constitute manipulation |

### 5.5 Key SOE Constraints

- **Best execution logging:** SOE requires venue selection rationale to be logged before order submission; orders without rationale are blocked
- **Chinese wall — research:** Cannot read from ResearchNexus pre-publication paths; any access to non-published research paths is denied and escalated
- **Separation of duties:** `tca-analyzer` is configured read-only; it cannot submit, modify, or cancel orders
- **Execution anomaly gate:** `execution-monitor` can flag and escalate but cannot independently cancel orders above a defined notional threshold without human approval

### 5.6 Cross-App Dependencies

- **Receives from:** AlphaEngine (trade lists)
- **Outputs to:** OpsFabric (executed trade records for settlement)
- **Monitored by:** RiskCompass (real-time exposure), ComplianceShield (surveillance)

---

## 6. Application Detail: RiskCompass

### 6.1 Purpose and Business Value

RiskCompass provides the firm's real-time and intraday risk analytics layer. It computes value-at-risk (VaR), conducts stress tests against historical and hypothetical scenarios, monitors exposure against regulatory and internal limits, and enforces limit breach escalation. By maintaining a continuous, consolidated view of risk across all funds and mandates, RiskCompass enables the risk function to act decisively before limit breaches become regulatory violations.

### 6.2 Agents

| Agent | Role |
|---|---|
| `var-calculator` | Parametric, historical, and Monte Carlo VaR across portfolios |
| `stress-tester` | Historical scenario replay (2008 GFC, 2020 COVID, custom scenarios) |
| `exposure-monitor` | Real-time exposure tracking across issuers, sectors, geographies, factors |
| `limit-enforcer` | Monitors internal and regulatory limits; triggers alerts on breach or near-breach |

### 6.3 EU AI Act Classification

**HIGH RISK — Annex III, Category 5b (Financial Services)**

RiskCompass monitors and can constrain portfolio activity across all funds. Limit enforcement actions influence trading decisions that affect client capital. The systemic nature of cross-fund exposure monitoring and the authority to trigger portfolio constraints satisfies the High Risk threshold.

### 6.4 Primary Regulatory Frameworks

| Framework | Requirement |
|---|---|
| Basel III/IV | Market risk capital — VaR models must meet backtesting and governance standards |
| Dodd-Frank (Title VII) | Swap dealer risk management requirements |
| AIFMD (Art.15) | Risk management independence — risk function separate from portfolio management |

### 6.5 Key SOE Constraints

- **Broadest read access:** RiskCompass has read access to position data across all trading applications for consolidated exposure computation
- **Zero write access:** Despite broad read access, RiskCompass has strictly zero write access; it cannot modify positions, submit orders, or alter records in any upstream system
- **Alert-only enforcement:** `limit-enforcer` can trigger escalation alerts and notifications but cannot independently execute trades or impose position limits without human confirmation
- **Audit immutability:** All risk calculations are logged with inputs, methodology, and timestamps to support model validation and regulatory review

### 6.6 Cross-App Dependencies

- **Reads from:** AlphaEngine, TradeSentinel, OpsFabric (all position and trade data)
- **Feeds:** ComplianceShield (limit breach events, risk metrics)

---

## 7. Application Detail: ComplianceShield

### 7.1 Purpose and Business Value

ComplianceShield automates the surveillance, detection, and regulatory reporting obligations that AssetCo faces across multiple jurisdictions. It monitors all trading activity for patterns indicative of market abuse, tracks position reporting thresholds, detects mandate and limit breaches, and files required regulatory reports (EMIR trade reports, MiFIR transaction reports, position reports). ComplianceShield reduces the manual burden on the compliance function while improving detection coverage and reporting accuracy.

### 7.2 Agents

| Agent | Role |
|---|---|
| `trade-surveiller` | Monitors all trading activity for MAR indicators (layering, spoofing, front-running patterns) |
| `position-reporter` | Tracks large position thresholds and prepares regulatory position disclosures |
| `breach-detector` | Detects mandate, limit, and policy breaches across all funds |
| `regulatory-filer` | Generates and submits required regulatory filings to relevant authorities |

### 7.3 EU AI Act Classification

**SIGNIFICANT RISK**

ComplianceShield performs automated monitoring and filing but does not make investment decisions or directly affect client capital. Its outputs are reviewed by the compliance function before material actions are taken. The surveillance function carries significance given regulatory consequences of missed detections, but the human review layer and reporting-only nature of filing agents position this below the High Risk threshold.

### 7.4 Primary Regulatory Frameworks

| Framework | Requirement |
|---|---|
| SOX (Section 302/906) | CEO/CFO certification of financial controls — automated controls must be auditable |
| FINRA Rule 3110 | Supervision obligations — surveillance system requirements |
| EMIR (Art.9) | Trade reporting to authorized trade repositories |
| MiFIR (Art.26) | Transaction reporting to national competent authorities |
| DORA (Art.17) | ICT-related incident reporting; operational resilience |

### 7.5 Key SOE Constraints

- **Surveillance mandate:** `trade-surveiller` has read access to ALL trading data across all applications — this is an intentional, audited exception to least-privilege, consistent with compliance surveillance mandates
- **Filing path restriction:** `regulatory-filer` write access is restricted to approved report staging directories; cannot write to trading systems or client records
- **Escalate, not remediate:** `breach-detector` can generate escalation events and notifications but cannot directly remediate breaches; remediation authority remains with human compliance officers
- **Append-only evidence:** All surveillance findings and breach records are append-only; no agent can modify a filed surveillance finding after creation

### 7.6 Cross-App Dependencies

- **Surveils:** All trading activity (TradeSentinel, AlphaEngine, OpsFabric)
- **Receives from:** RiskCompass (limit breach events)

---

## 8. Application Detail: AdvisorLens

### 8.1 Purpose and Business Value

AdvisorLens supports AssetCo's relationship managers and financial advisors in preparing client-facing investment proposals, suitability assessments, and portfolio reports. It automates the suitability checking workflow, generates personalised investment proposals aligned to client mandates and risk profiles, and produces client-ready portfolio reports. AdvisorLens enables advisors to serve more clients with higher-quality, more consistent analysis while meeting EU AI Act Article 52 transparency requirements.

### 8.2 Agents

| Agent | Role |
|---|---|
| `suitability-checker` | Validates proposed investments against client risk profile, investment objective, time horizon |
| `proposal-generator` | Generates personalised investment proposals with AI disclosure labeling |
| `client-reporter` | Produces periodic portfolio reports, performance attribution, and ESG summaries |

### 8.3 EU AI Act Classification

**HIGH RISK — Annex III, Category 5b + Art.52 Transparency Obligation**

AdvisorLens generates client-facing recommendations with fiduciary implications. Unsuitable recommendations can cause material financial harm to retail and professional clients. The system also falls under Article 52 transparency obligations as it interacts with natural persons in an advisory capacity. Dual classification: High Risk (Annex III) and Art.52 disclosure obligations.

### 8.4 Primary Regulatory Frameworks

| Framework | Requirement |
|---|---|
| Fiduciary Duty | Act in client's best interest; suitability assessments mandatory |
| MiFID II (Art.25) | Suitability and appropriateness assessment for investment advice |
| GDPR (Art.22) | Right not to be subject to solely automated decisions with legal effects |
| EU AI Act (Art.52) | Transparency — clients must be informed they are interacting with an AI system |

### 8.5 Key SOE Constraints

- **Art.52 enforcement:** SOE verifies every AdvisorLens output includes a required AI disclosure statement before delivery; outputs without the disclosure string are blocked and escalated
- **GDPR Art.22 gate:** Automated recommendations triggering material allocation changes require a human approval gate before delivery to client
- **Read-only client data:** All three agents have read-only access to client profiles, portfolios, and mandate documents; no agent can modify client records
- **Research restriction:** Access to ResearchNexus restricted to published research only; pre-publication paths are deny-listed

### 8.6 Cross-App Dependencies

- **Reads from:** ResearchNexus (published research), client portfolio data
- **Human approval gate:** Material proposals require advisor sign-off before client delivery

---

## 9. Application Detail: ResearchNexus

### 9.1 Purpose and Business Value

ResearchNexus augments AssetCo's research capability by automating market analysis, ESG scoring, sentiment analysis, and fair value modeling. It provides the research function with AI-assisted drafts and data synthesis, reducing time-to-publication for research notes and improving coverage breadth. ResearchNexus operates under strict information barriers to prevent research outputs from contaminating the trading function before official publication.

### 9.2 Agents

| Agent | Role |
|---|---|
| `market-analyst` | Automated market commentary, sector analysis, earnings preview and review |
| `esg-scorer` | ESG scoring against EU Taxonomy and SFDR classifications; principal adverse impact (PAI) metrics |
| `sentiment-analyzer` | News, social, and regulatory filing sentiment; alternative data synthesis |
| `fair-value-modeler` | DCF, comparable company, and sum-of-parts valuation modeling |

### 9.3 EU AI Act Classification

**SIGNIFICANT RISK**

ResearchNexus augments human researchers but does not make investment decisions directly. Research outputs are reviewed and approved by human analysts before publication. The publication gate and human review layer mean ResearchNexus does not independently cause client harm. However, ESG scoring outputs under SFDR carry regulatory significance and require appropriate governance.

### 9.4 Primary Regulatory Frameworks

| Framework | Requirement |
|---|---|
| SFDR (Arts. 4, 8, 9) | Principal Adverse Impact disclosures; product-level ESG classification |
| EU Taxonomy (Art.3) | Taxonomy alignment assessment for sustainable activities |
| Reg FD (SEC Rule 100) | Fair disclosure — material non-public information must not be selectively disclosed |

### 9.5 Key SOE Constraints

- **Chinese wall — no trading data:** ResearchNexus agents CANNOT read any trading positions, pending orders, or execution data from TradeSentinel or AlphaEngine; this is a hard deny to prevent conflicts of interest and Reg FD violations
- **Publication gate:** Research outputs are written to staging directories and are not accessible to trading applications until a human analyst approves publication and the file is promoted to the published directory
- **ESG special access:** `esg-scorer` has access to approved sustainability data sources and EU Taxonomy mappings that are not available to other ResearchNexus agents
- **No client data access:** ResearchNexus has no access to individual client portfolios or client-identifiable data

### 9.6 Cross-App Dependencies

- **Outputs to:** AlphaEngine and AdvisorLens (published research only, post-publication gate)
- **Isolated from:** TradeSentinel, OpsFabric (hard information barrier)

---

## 10. Application Detail: OpsFabric

### 10.1 Purpose and Business Value

OpsFabric automates the post-trade operational lifecycle — settlement instruction generation, trade reconciliation, and net asset value (NAV) calculation. By automating T+1/T+2 settlement workflows, OpsFabric reduces settlement fails, eliminates manual reconciliation effort, and ensures NAV calculations meet fund accounting standards. Operational accuracy and timeliness have direct regulatory and reputational consequences.

### 10.2 Agents

| Agent | Role |
|---|---|
| `settlement-processor` | Generates and dispatches settlement instructions within T+1/T+2 deadlines |
| `reconciler` | Reconciles internal records against custodian and prime broker statements |
| `nav-calculator` | Computes daily NAV for each fund; applies pricing hierarchy; flags stale prices |

### 10.3 EU AI Act Classification

**LIMITED RISK**

OpsFabric performs operational automation with well-defined, deterministic rules for settlement and reconciliation. It does not make investment decisions or client-facing recommendations. NAV calculation errors carry financial consequences but occur within a controlled operational process with dual-approval controls. Classified as Limited Risk with specific transparency obligations around NAV publication.

### 10.4 Primary Regulatory Frameworks

| Framework | Requirement |
|---|---|
| CSDR (Art.6/7) | T+2 settlement discipline; cash penalties for settlement fails |
| EMIR (Art.4) | Timely clearing of eligible OTC derivatives |

### 10.5 Key SOE Constraints

- **Settlement deadline tracking:** SOE monitors settlement instruction deadlines; `settlement-processor` is rate-limited to prevent duplicate instruction submission
- **NAV dual-approval:** `nav-calculator` can compute and stage NAV but cannot publish to client-accessible systems without a dual-approval signal; SOE enforces the dual-approval gate before write access to the NAV publication directory is permitted
- **Reconciler read access:** `reconciler` has the broadest operational data access across custodian, prime broker, and internal records but cannot modify source records in any upstream system
- **Write isolation:** Each agent's write access is restricted to its operational domain directory; cross-domain writes are denied

### 10.6 Cross-App Dependencies

- **Receives from:** TradeSentinel (executed trade records)
- **Feeds:** ComplianceShield (settlement records, operational events)

---

## 11. Agent Count Summary

| Application | Agents | Agent Names |
|---|---|---|
| AlphaEngine | 4 | portfolio-optimizer, rebalancer, allocation-advisor, factor-analyst |
| TradeSentinel | 3 | order-router, execution-monitor, tca-analyzer |
| RiskCompass | 4 | var-calculator, stress-tester, exposure-monitor, limit-enforcer |
| ComplianceShield | 4 | trade-surveiller, position-reporter, breach-detector, regulatory-filer |
| AdvisorLens | 3 | suitability-checker, proposal-generator, client-reporter |
| ResearchNexus | 4 | market-analyst, esg-scorer, sentiment-analyzer, fair-value-modeler |
| OpsFabric | 3 | settlement-processor, reconciler, nav-calculator |
| **Platform Total** | **25** | |

---

## 12. Cross-Cutting SOE Principles

The following SOE principles apply across all 7 applications:

| Principle | Implementation |
|---|---|
| Fail-closed | If Sentinel-Ops cannot evaluate a tool call, the call is blocked — safety over availability |
| Immutable audit | Every agent action across all 7 apps is logged to append-only Chronicle audit trail |
| Chinese wall enforcement | Information barriers between research and trading enforced deterministically, not by convention |
| Human approval gates | High-stakes actions (NAV publication, material client proposals) require human approval before execution |
| Least privilege | Each agent's data access is the minimum required for its function; cross-domain access requires explicit SOE justification |
| EU AI Act conformity | High Risk applications subject to full conformity assessment before deployment; Art.52 disclosures automated by SOE |
