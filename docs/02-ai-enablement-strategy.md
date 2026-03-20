# AssetCo — AI Enablement Strategy

**Document Version:** 1.0
**Classification:** Internal
**Owner:** James Chen, CTO
**Last Updated:** March 2026

---

## Strategic Vision

James Chen joined AssetCo in 2024 with a clear thesis from his Two Sigma tenure: alpha decay is accelerating, and the firms that survive the next decade are those that treat AI as an operating model transformation, not a feature addition. AI cannot be a collection of point solutions bolted onto legacy infrastructure. It must be embedded across the entire investment value chain — governed, auditable, and defensible at every step.

AssetCo's AI Enablement initiative, $14M over 18 months, is organized around four outcomes:

| Outcome | Target | Governance Dependency |
|---------|--------|-----------------------|
| Alpha augmentation through quantitative signal enhancement | 30–50bps improvement in net alpha per strategy | AlphaEngine and ResearchNexus operate within SOE-enforced information barriers — research signals cannot leak to trading until published |
| Compliance processing efficiency | 60% reduction in manual compliance processing time | ComplianceShield runs in read-only surveillance mode; SOE toolAction constraints prevent autonomous regulatory filings without human sign-off |
| Operational automation readiness | T+1 settlement capability across all eligible instruments | OpsFabric agents operate within bounded write authority — settlement instructions require SOE-gated authorization before submission to custodians |
| Regulatory examination readiness | Zero AI-related regulatory findings in the first three years | Chronicle audit trail provides immutable, SOE-scoped evidence for every AI action — sufficient for SEC, FCA, MAS, and BaFin examination |

The governance backbone that makes each of these outcomes achievable at scale — across seven applications, 25 agents, four jurisdictions, and five business lines — is Sentinel-Ops SOE. Without machine-enforceable boundaries, the scale of AI deployment required to hit these targets would itself become the firm's largest regulatory risk.

---

## AI Opportunity Map

AI opportunities are prioritized along two dimensions: business impact (alpha generation, cost reduction, risk mitigation, client experience) and regulatory risk (consequence of an AI failure or boundary violation in that domain).

| Opportunity | Business Impact | Regulatory Risk | Priority | Application | Agents |
|---|---|---|---|---|---|
| Portfolio optimization | High — quantitative signal augmentation; 30–50bps alpha potential; factor-aligned rebalancing | High — fiduciary duty; SR 11-7 model risk; MiFID II explainability | P0 | AlphaEngine | portfolio-optimizer, rebalancer, allocation-advisor, factor-analyst |
| Trade execution | High — TCA improvement; best execution compliance; market impact reduction | High — MiFID II best execution; Reg NMS; MAR (market abuse) | P0 | TradeSentinel | order-router, execution-monitor, tca-analyzer |
| Risk analytics | High — intraday exposure monitoring; cross-fund concentration; real-time limit enforcement | High — Basel III; AIFMD leverage limits; SR 11-7; UCITS concentration rules | P0 | RiskCompass | var-calculator, stress-tester, exposure-monitor, limit-enforcer |
| Compliance automation | High — reduce 2,400 manual compliance document reviews/year; pre-trade rule checks | Significant — reporting accuracy; multi-jurisdictional rule enforcement | P1 | ComplianceShield | trade-surveiller, position-reporter, breach-detector, regulatory-filer |
| Client advisory | Medium — suitability assessment, personalized reporting, ESG attribution | High — SEC Reg BI; MiFID II suitability; DOL fiduciary; GDPR (EU clients) | P1 | AdvisorLens | suitability-checker, proposal-generator, client-reporter |
| Research augmentation | Medium — analyst productivity; earnings transcript NLP; ESG scoring automation | Significant — Regulation FD; information barriers; MAR (pre-publication research) | P2 | ResearchNexus | market-analyst, esg-scorer, sentiment-analyzer, fair-value-modeler |
| Operations automation | Medium — T+1 settlement; reconciliation exception management; NAV validation | Limited — settlement; fair value; ASC 820 documentation | P2 | OpsFabric | settlement-processor, reconciler, nav-calculator |

**Priority rationale:** P0 applications operate in real-time on investment decisions and trade execution — the financial and regulatory consequences of an AI boundary violation are immediate and severe. P1 applications are high-value but operate post-decision or in advisory mode, where human review remains in the loop. P2 applications operate in research and operational contexts where the blast radius of a failure is contained.

---

## Agent Taxonomy

All 25 agents deployed at AssetCo are classified below by application, authority level, EU AI Act risk classification, and human oversight requirement. Every agent operates within a Sentinel-Ops SOE definition that encodes these attributes as machine-enforceable constraints.

### Authority Level Definitions

| Level | Description | Examples |
|-------|-------------|---------|
| **read-only** | Agent may only read data; no write, edit, or execute actions | ResearchNexus agents, ComplianceShield surveillance agents |
| **write-limited** | Agent may write to specific, bounded paths; no unrestricted writes | OpsFabric settlement-processor (write to settlement/instructions/\*\*) |
| **advisory** | Agent generates proposals or recommendations; human must approve before any action | AlphaEngine allocation-advisor, AdvisorLens proposal-generator |
| **execute-gated** | Agent may execute actions (trades, filings) but only after SOE pre-check passes | TradeSentinel order-router, ComplianceShield regulatory-filer |
| **full-autonomy** | Agent operates end-to-end within tight SOE bounds; human review is async only | OpsFabric reconciler (for minor breaks below materiality threshold) |

### Human Oversight Requirement Definitions

| Level | Description |
|-------|-------------|
| **dual-approval** | Two named humans (e.g., PM + Compliance) must approve before agent output is actioned |
| **sync-approval** | One human must approve in real time before agent output is actioned |
| **async-review** | Agent may proceed; human reviews action log within defined SLA (typically same-day) |
| **none** | Agent operates autonomously within SOE; Chronicle logs all actions for periodic review |

### Full Agent Taxonomy

| Application | Agent | Role | Authority Level | EU AI Act Class | Human Oversight |
|---|---|---|---|---|---|
| **AlphaEngine** | portfolio-optimizer | Generates optimized model portfolios from alpha signals and mandate constraints | advisory | HIGH RISK | sync-approval (PM must approve model portfolio before order generation) |
| **AlphaEngine** | rebalancer | Executes approved model portfolio changes; generates delta trade lists | execute-gated | HIGH RISK | async-review (trades flow to Bloomberg AIM for trader review) |
| **AlphaEngine** | allocation-advisor | Recommends tactical asset allocation shifts across business lines | advisory | HIGH RISK | dual-approval (PM + IC representative) |
| **AlphaEngine** | factor-analyst | Analyzes factor exposures, identifies drift from mandate targets | read-only | HIGH RISK | async-review |
| **TradeSentinel** | order-router | Routes approved orders to execution venues via FlexTrade EMS | execute-gated | HIGH RISK | sync-approval (trader approval required before live order submission) |
| **TradeSentinel** | execution-monitor | Monitors live order execution quality against VWAP / arrival price benchmarks | read-only | HIGH RISK | async-review |
| **TradeSentinel** | tca-analyzer | Post-trade transaction cost analysis; MiFID II best execution documentation | read-only | HIGH RISK | async-review |
| **RiskCompass** | var-calculator | Computes intraday VaR (historical and parametric) across all positions | read-only | HIGH RISK | async-review |
| **RiskCompass** | stress-tester | Runs macro scenario analysis (rates shocks, credit spread widening, liquidity stress) | read-only | HIGH RISK | async-review |
| **RiskCompass** | exposure-monitor | Real-time cross-fund concentration monitoring; AIFMD leverage tracking | read-only | HIGH RISK | sync-approval (for limit-breach escalations) |
| **RiskCompass** | limit-enforcer | Flags orders that would breach pre-defined risk limits; blocks via Bloomberg AIM | execute-gated | HIGH RISK | dual-approval (CRO + PM to override any limit block) |
| **ComplianceShield** | trade-surveiller | Monitors all executed trades for pattern anomalies, information barrier violations, MAR signals | read-only | SIGNIFICANT | async-review |
| **ComplianceShield** | position-reporter | Aggregates positions for regulatory reporting (Form PF, EMIR, MiFIR, SFDR) | read-only | SIGNIFICANT | sync-approval (CCO sign-off before regulatory submission) |
| **ComplianceShield** | breach-detector | Real-time detection of pre- and post-trade compliance rule violations | read-only | SIGNIFICANT | sync-approval (for escalated breaches) |
| **ComplianceShield** | regulatory-filer | Populates and submits regulatory report templates (EMIR trade reports, MiFIR transaction reports) | execute-gated | SIGNIFICANT | dual-approval (CCO + jurisdiction-specific compliance officer) |
| **AdvisorLens** | suitability-checker | Validates proposed portfolio changes and client recommendations against IPS and suitability rules | advisory | HIGH RISK | sync-approval (RM must confirm suitability assessment before client communication) |
| **AdvisorLens** | proposal-generator | Drafts investment proposal documents, portfolio commentary, and mandate change recommendations | advisory | HIGH RISK | sync-approval (PM reviews and approves draft before client delivery) |
| **AdvisorLens** | client-reporter | Generates quarterly performance attribution reports, KIID/PRIIP disclosures, and ESG attribution | write-limited | HIGH RISK | async-review (compliance review within 24h of generation) |
| **ResearchNexus** | market-analyst | Ingests earnings transcripts, SEC filings, macro data; generates structured research summaries | read-only | SIGNIFICANT | async-review |
| **ResearchNexus** | esg-scorer | Scores portfolio holdings on ESG metrics using MSCI, Sustainalytics, and proprietary signals | read-only | SIGNIFICANT | async-review (SFDR disclosure review by Compliance) |
| **ResearchNexus** | sentiment-analyzer | Applies NLP to news, social media, and sell-side research for sentiment signals | read-only | SIGNIFICANT | async-review |
| **ResearchNexus** | fair-value-modeler | Generates fair value estimates for illiquid securities using DCF and comparable transaction models | advisory | SIGNIFICANT | sync-approval (Valuation Committee for Level 2/3 securities) |
| **OpsFabric** | settlement-processor | Generates and submits settlement instructions to custodians (BNY Mellon, State Street) | write-limited | LIMITED | async-review (for standard settlements; sync-approval for fails above materiality threshold) |
| **OpsFabric** | reconciler | Detects and classifies reconciliation breaks; routes to resolution queues | write-limited | LIMITED | none (for minor breaks; sync-approval for breaks above $500K) |
| **OpsFabric** | nav-calculator | Validates NAV inputs, flags stale prices, identifies Level 2/3 securities for fair value treatment | advisory | LIMITED | sync-approval (Fund Accountant sign-off on daily NAV) |

**Total:** 25 agents across 7 applications.

---

## Governance Model

### Three-Layer Bounded Authority at AssetCo

Sentinel-Ops enforces a three-layer bounded authority model. Each layer can only act within the bounds defined by the layer above it.

```
Layer 1: COMPLIANCE OPS — AssetCo Humans
  Owners: CCO David Okonkwo, CRO Sarah Nakamura, CTO James Chen
  Authority: Define meta-SOE (immutable). Set the boundaries within which the
             SOE management layer operates. Approve policy changes. Review
             escalations. Cannot be overridden by any AI agent.

Layer 2: SOE MANAGEMENT — Sentinel-Ops Agents
  Agents: Sentinel (gate), Arbiter (risk scoring), Chronicle (audit),
          Beacon (anomaly detection), Counsel (policy design)
  Authority: Enforce SOE for all 25 AssetCo application agents. Score risk
             trajectories. Log all decisions immutably. Detect anomalies.
             Cannot modify their own meta-SOE. Cannot approve own escalations.

Layer 3: APPLICATION AGENTS — 25 AssetCo Agents
  Agents: All agents across AlphaEngine, TradeSentinel, RiskCompass,
          ComplianceShield, AdvisorLens, ResearchNexus, OpsFabric
  Authority: Operate within SOE boundaries. Every tool call evaluated by
             Sentinel pre-filter. No agent can exceed its SOE definition.
```

### AssetCo-Specific Governance Approvals

| Decision | Owner | Process |
|----------|-------|---------|
| New AI application deployment | Investment Committee + CTO | IC approves business case; CTO approves technical architecture; Model Risk Committee validates per SR 11-7 |
| SOE definition creation or modification | CCO David Okonkwo | SOE definitions are drafted by CTO team, reviewed by Compliance for regulatory mapping, signed off by CCO per jurisdiction |
| Model risk validation of AI models | CRO Sarah Nakamura (Model Risk Committee) | All AI/ML models in scope for investment decisions undergo SR 11-7 validation: documentation, independent validation, back-testing, performance monitoring |
| Information barrier waiver | CCO | Any waiver of information barrier read/write rules in an SOE definition requires written CCO approval and is logged in the Chronicle audit trail |
| EU AI Act high-risk system registration | Head of EMEA Robert Lindqvist + CCO | Applications classified HIGH RISK under EU AI Act Annex III require conformity assessment and registration in the EU AI Act database before deployment to EU operations |
| Live enforcement mode graduation | CCO + CTO | Each application graduates from audit-phase (shadow → warn → soft enforce) to full enforce only after CCO sign-off confirming regulatory defensibility |

---

## Data Classification and Access Model

### Four-Tier Classification

| Tier | Definition | Examples | SOE Enforcement Mechanism |
|------|-----------|---------|--------------------------|
| **PUBLIC** | Released to public domain; no confidentiality restrictions | Bloomberg market prices, SEC filings, published research, fund fact sheets | No `readDeny` required; all agents may read |
| **INTERNAL** | AssetCo-internal only; not for external distribution | Internal strategy presentations, model portfolio targets, meeting minutes, published research signals | SOE `dataAccess.readAllow` must explicitly include the agent; external output via `toolActions.writeAllow` restricted to internal destinations |
| **CONFIDENTIAL** | Client data, financial data; strict need-to-know within AssetCo | Portfolio holdings, client PII, trade records, P&L attribution, prime broker feeds | SOE `dataAccess.readAllow` must name the specific path; `readDeny: ["**"]` as default with explicit allow overrides |
| **RESTRICTED** | MNPI, pre-publication research, deal pipeline data, regulatory investigation materials | Private equity deal room data, pre-publication research drafts, restricted list, regulatory exam correspondence | Requires human-approval gate; SOE `dataAccess.readDeny: ["restricted/**"]` for all agents not on named allow list; Chronicle logs every access attempt |

### Information Barrier Enforcement via SOE

| Barrier | Enforced By | SOE Pattern |
|---------|-------------|-------------|
| Research (pre-publication) vs. Trading | ResearchNexus SOE `readAllow` restricted to `research/published/**`; TradeSentinel SOE `readDeny: ["research/unpublished/**", "research/drafts/**"]` | Prevents AI-assisted front-running of proprietary research |
| Private Markets vs. Public Markets | Private Markets agents `readDeny: ["equities/**", "fixed-income/**"]`; Public Markets agents `readDeny: ["private-markets/deals/**", "private-markets/pipeline/**"]` | Enforces MNPI barrier at the tool-call level |
| Compliance Surveillance vs. All Business Lines | ComplianceShield `toolActions` permits only `read` and `report`; all `write`, `edit`, `bash` side-effect actions denied | Ensures surveillance integrity without creating conflict of interest |

---

## AI Risk Framework

Sentinel-Ops capabilities are mapped to AssetCo's specific AI risk categories below.

| AI Risk | Description at AssetCo | Sentinel-Ops Mitigation |
|---------|------------------------|------------------------|
| Model drift | Quantitative models degrade as market regimes change; alpha signals lose predictive power | Arbiter continuous risk scoring tracks trajectory of each agent's decision patterns; flags when behavior deviates from baseline; triggers SR 11-7 performance review |
| Data poisoning | Adversarial manipulation of alternative data feeds or internal signals used by AlphaEngine or ResearchNexus | SOE `dataAccess.readAllow` restricts each agent to approved, vetted data sources; changes to allowed data sources require SOE modification with CCO approval |
| Hallucination in research | LLM-generated research summaries or fair value commentary contain fabricated data points | Chronicle audit trail captures every ResearchNexus and AdvisorLens output; human review gate (async-review or sync-approval) ensures a licensed analyst reviews before any output is actioned; SOE `toolActions` blocks direct write to client-facing systems without approval |
| Front-running risk | AI agent with access to both unpublished research and trading systems could route orders ahead of research publication | Information barrier SOE enforcement (see above); ResearchNexus `readDeny` on all trading paths; TradeSentinel `readDeny` on all unpublished research paths |
| Concentration risk | AlphaEngine optimizer converges to concentrated positions, breaching mandate or regulatory limits | AlphaEngine SOE `toolActions.bash.deny` blocks any order submission that exceeds concentration thresholds defined in mandate parameters; RiskCompass limit-enforcer operates as a secondary gate |
| Regulatory breach | ComplianceShield generates an incorrect regulatory filing or misclassifies a breach | regulatory-filer operates execute-gated with dual-approval (CCO + jurisdiction compliance officer); breach-detector is read-only surveillance — it cannot suppress or modify alerts; all filings logged immutably in Chronicle |
| Suitability violation | AdvisorLens generates a recommendation inconsistent with client IPS or risk tolerance | suitability-checker runs as a mandatory gate before proposal-generator outputs; SOE enforces that proposals cannot be delivered to client systems without suitability-checker approval and RM sync-approval |
| MNPI leakage | Private Markets agents transfer deal data to public markets agents via shared tool calls | Hard SOE `readDeny` on cross-barrier paths; Beacon cross-agent anomaly detection flags any unusual access patterns across the Private Markets / Public Markets boundary; Chronicle logs all cross-application data requests |
| Operational error at scale | OpsFabric submits incorrect settlement instructions at volume under T+1 pressure | settlement-processor operates write-limited with path restriction (`settlement/instructions/pending/**` only); submitted instructions enter a pending queue reviewed by Operations before custodian submission; materiality threshold triggers sync-approval |

---

## Success Metrics

The AI Enablement program is measured on both business outcomes and governance quality. Sentinel-Ops provides the instrumentation for governance metrics through the Chronicle audit trail and Arbiter risk scoring.

### Business Outcome KPIs

| Metric | Target | Measurement Method | Review Cadence |
|--------|--------|--------------------|----------------|
| Incremental alpha from AI signals | +30–50bps net of costs per strategy | Brinson-Hood-Beebower attribution; AI signal contribution isolated in performance system | Quarterly |
| Compliance processing time reduction | 60% reduction vs. 2024 baseline | Hours to review 100 regulatory documents: baseline 420 hours/quarter target 168 hours/quarter | Quarterly |
| T+1 settlement fail rate | Below 0.5% of total trade count | Eagle PACE settlement exception reports | Monthly |
| NAV calculation error rate | Zero material NAV errors (>$1,000 per fund) | Eagle PACE NAV reconciliation vs. fund administrator | Daily |
| Client reporting SLA compliance | 100% of quarterly reports delivered within agreed SLA | Report delivery timestamp vs. contractual deadline | Quarterly |
| Analyst productivity (ResearchNexus) | 40% reduction in time to produce initial research summary | Internal time-tracking; survey data | Semi-annually |

### Governance Quality KPIs

| Metric | Target | Source | Review Cadence |
|--------|--------|---------|----|
| SOE violation rate (false negatives — AI actions that should have been blocked but were allowed) | <0.1% of total tool calls | Chronicle audit trail; Arbiter risk scoring | Monthly |
| SOE false positive rate (legitimate actions blocked by SOE) | <2% of total tool calls | Chronicle audit trail; agent team feedback | Monthly |
| Mean time to detect SOE breach | <15 minutes for HIGH RISK agents | Beacon anomaly detection alert latency | Monthly |
| Regulatory examination readiness score | Green (pass) on internal mock examination across all four jurisdictions | Mock exam conducted by external counsel; Chronicle evidence package | Annually (per jurisdiction) |
| Human oversight SLA compliance | 100% of sync-approval actions reviewed within agreed SLA; 95% of async-review actions reviewed within 24h | Chronicle logs; approval workflow system | Monthly |
| Model risk review currency | 100% of AI models with valid SR 11-7 validation documentation (no expired validations) | Model registry | Quarterly |
| Time-to-deployment for new AI capabilities | <90 days from IC approval to full enforce mode (including SOE definition, audit-phase graduation) | Deployment tracking; Chronicle enforcement mode timestamps | Per deployment |
| Information barrier violation incidents | Zero confirmed violations | Chronicle cross-barrier access logs; Beacon anomaly alerts | Monthly |

---

## Audit-Phase Protocol

No AI application is deployed directly into full enforcement mode. AssetCo requires all applications to graduate through four audit phases, aligned with the firm's change management and SR 11-7 model validation requirements.

| Phase | Description | Exit Criteria | Owner |
|-------|-------------|---------------|-------|
| **Shadow** | SOE runs in parallel; every tool call is logged but no action is blocked | Two weeks of clean shadow logs; false positive rate analyzed | CTO + CRO |
| **Warn** | SOE blocks are surfaced as warnings to the application team; tool calls still proceed | Warning rate <5% of tool calls; all HIGH severity warnings reviewed | CTO + CCO |
| **Soft Enforce** | SOE blocks are enforced; escalation path is fast (5-minute SLA for Sentinel escalations) | Block rate stable; no legitimate use cases blocked; CCO satisfied with rule coverage | CCO + CTO |
| **Full Enforce** | Production SOE enforcement; full Chronicle audit trail; Arbiter risk scoring active | CCO sign-off; IC notification; external counsel confirmation for HIGH RISK applications | CCO |

---

## Document References

| Document | Description |
|----------|-------------|
| [00-company-narrative.md](./00-company-narrative.md) | AssetCo company history, business lines, technology landscape, governance obligations |
| [01-operating-model.md](./01-operating-model.md) | Investment value chain, data architecture, information barriers, cross-application data flows |
| [03-soe-governance.md](./03-soe-governance.md) | SOE definition schema, per-application SOE specifications, information barrier enforcement detail |
| [04-compliance-mapping.md](./04-compliance-mapping.md) | SEC, MiFID II, AIFMD, EU AI Act, MAS TRM requirements mapped to Sentinel-Ops controls |
| [05-implementation-roadmap.md](./05-implementation-roadmap.md) | Phased deployment plan, wave-based rollout, audit-phase graduation milestones |

---

*AssetCo Investment Management is a fictional company created for demonstration purposes. All AUM figures, personnel, and regulatory references are illustrative. This documentation series showcases Sentinel-Ops SOE governance in a realistic asset management context.*

*Document owner: James Chen, CTO. For questions, contact the AI Enablement program office.*
