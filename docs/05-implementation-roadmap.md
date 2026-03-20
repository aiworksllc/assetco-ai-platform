# AssetCo AI Platform — Implementation Roadmap

**Document:** 05-implementation-roadmap.md
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** James Chen, CTO
**Audience:** CTO, CRO, CCO, COO, Technology Leadership, Program Governance Board

---

## 1. Executive Summary

This document defines the phased deployment plan for the AssetCo AI Platform — 7 applications, 25 agents, governed by Sentinel-Ops SOE — across a four-quarter rollout beginning Q1 2026. The ordering is not arbitrary: it is determined by application dependency chains, information barrier activation sequencing, regulatory conformity assessment timelines, and the principle that every application must graduate through four enforcement phases (shadow → warn → soft enforce → full enforce) before it is considered production-ready.

**Platform delivery target:** Full 25-agent platform operational by Q4 2026.

**Governance authority:** James Chen (program sponsor), Dr. Priya Sharma (quantitative model delivery), Sarah Nakamura (model risk sign-off), David Okonkwo (compliance and information barrier sign-off), Maria Torres (operational readiness sign-off).

---

## 2. Deployment Dependency Rationale

The specific application ordering is dictated by three structural constraints:

### 2.1 Data Flow Dependencies

Applications that consume outputs from other applications cannot be deployed before their upstream producers are stable and audited. The following dependency chain must be respected:

```
RiskCompass ──────────────────────────────────────────────────────────────►
(read-only analytics, no upstreams)

OpsFabric ────────────────────────────────────────────────────────────────►
(operational automation, bounded writes, no investment upstreams)

AlphaEngine ──► TradeSentinel ──► OpsFabric (operational feed)
(requires RiskCompass  (requires AlphaEngine    (already live)
 limit-checking live)   trade lists live)

ComplianceShield ──────────────────────────────────────────────────────────►
(requires TradeSentinel + OpsFabric data flowing; surveils all trading activity)

AdvisorLens ───────────────────────────────────────────────────────────────►
(requires published research + client data; no trading data access)

ResearchNexus ─────────────────────────────────────────────────────────────►
(deployed last: chinese wall complexity — must be isolated from all trading
 positions and orders that are live in TradeSentinel + AlphaEngine by this point)
```

### 2.2 Information Barrier Activation Sequence

The Research–Trading chinese wall cannot be activated until both sides of the barrier are deployed. Deploying ResearchNexus before AlphaEngine and TradeSentinel are live means the chinese wall enforcement rules would block access to paths that do not yet exist — masking configuration errors. The barrier must be tested under live conditions against real trading data flows.

### 2.3 Regulatory Conformity Assessment Lead Time

EU AI Act High Risk applications (AlphaEngine, TradeSentinel, RiskCompass, AdvisorLens) require completed conformity assessments before production deployment in EMEA jurisdictions. RiskCompass, as read-only analytics, has the narrowest blast radius and the most straightforward conformity pathway — making it the natural first candidate for High Risk deployment.

---

## 3. Phased Delivery Plan

### 3.1 Gantt-Style Timeline

```
Application         | Q1 2026 (Jan–Mar)  | Q2 2026 (Apr–Jun)  | Q3 2026 (Jul–Sep)  | Q4 2026 (Oct–Dec)
--------------------|--------------------|--------------------|--------------------|-----------------
Sentinel-Ops Infra  | [===== DEPLOY ====]|                    |                    |
RiskCompass         | [==SHADOW==][WARN] | [SOFT][====FULL====]|                    |
OpsFabric           | [==SHADOW==][WARN] | [SOFT][====FULL====]|                    |
AlphaEngine         |                    | [SHADOW][WARN][SOFT]| [======FULL=======]|
TradeSentinel       |                    |      [SHADOW][WARN] | [SOFT][====FULL====]|
ComplianceShield    |                    |                    | [SHADOW][WARN][SOFT]| [======FULL=======]
AdvisorLens         |                    |                    | [SHADOW][WARN][SOFT]| [======FULL=======]
ResearchNexus       |                    |                    |      [SHADOW][WARN] | [SOFT][====FULL====]
Info Barrier (full) |                    |                    |                    | [====ACTIVE========]
```

**Legend:** SHADOW = monitor-only, zero blocking | WARN = log violations, no blocking | SOFT = block with override | FULL = block unconditionally, escalate

---

## 4. Phase 1 — Foundation (Q1 2026)

### 4.1 Scope

**Applications:** RiskCompass, OpsFabric
**Platform:** Sentinel-Ops deployment, SOE schema definitions, Chronicle audit infrastructure, Arbiter risk scoring baseline, information barrier policy authoring (not yet activated)

### 4.2 Rationale

RiskCompass is read-only across all data sources and makes no investment decisions. Its EU AI Act conformity assessment is the most tractable of the High Risk applications. A failure in RiskCompass results in a missed risk signal, not an errant trade — the blast radius is bounded and recoverable. OpsFabric is classified Limited Risk and operates in a well-defined operational domain with deterministic settlement rules. Together, these two applications validate the Sentinel-Ops enforcement infrastructure under production load before any investment-decision-making agents go live.

### 4.3 Delivery Milestones

| Week | Milestone | Owner |
|------|-----------|-------|
| W1–W2 | Sentinel-Ops platform deployed to AWS (us-east-1, eu-west-1); Chronicle S3 and DynamoDB backends provisioned | James Chen / Infrastructure |
| W3–W4 | SOE definitions authored for all 25 agents (pre-production, not yet enforcing) | Dr. Priya Sharma / David Okonkwo |
| W5 | RiskCompass agents deployed in shadow mode; Chronicle audit trail active | Dr. Priya Sharma |
| W6 | OpsFabric agents deployed in shadow mode; settlement instruction SOE definitions validated against UAT | Maria Torres |
| W7–W8 | Arbiter risk scoring baseline calibrated against Q4 2025 historical tool call data; decay parameters set | Dr. Priya Sharma |
| W9–W10 | RiskCompass and OpsFabric elevated to warn mode; violation counts reviewed weekly | Sarah Nakamura |
| W11 | Phase 1 Go/No-Go review (see §4.4) | Program Governance Board |
| W12 | RiskCompass elevated to soft enforce; OpsFabric elevated to soft enforce | James Chen |

### 4.4 Go/No-Go Criteria — Phase 1

All of the following gates must be satisfied before proceeding to Phase 2:

| Gate | Metric | Threshold |
|------|--------|-----------|
| SOE pre-filter latency | p99 latency for deterministic pre-filter | < 2ms |
| Chronicle completeness | % of RiskCompass and OpsFabric tool calls with audit event | 100% — zero gaps |
| False positive rate | % of ALLOW decisions in warn mode that generate a violation log | < 0.5% |
| Arbiter baseline | Risk score calibration: % of sessions where cumulative score matches manual review | > 95% agreement |
| SR 11-7 model validation | RiskCompass VaR model validation completed by Sarah Nakamura's model risk team | Signed-off |
| EU AI Act conformity — RiskCompass | Conformity assessment documentation complete for EMEA deployment | David Okonkwo sign-off |
| NAV dual-approval gate | OpsFabric NAV publication gate tested end-to-end in UAT with dual-approval signal | Pass |
| Incident response drill | One simulated SOE violation (injected test) processed through full escalation workflow | < 15 min resolution |

**Failure consequence:** If any gate is not met by the end of W11, Phase 2 start date slides by one week per gate remediation cycle. Gate failures are documented in the program risk register.

### 4.5 Staffing

| Role | Owner | Allocation |
|------|-------|------------|
| Platform engineering — Sentinel-Ops deployment | James Chen's infrastructure team (3 engineers) | 100% |
| SOE definition authoring — risk analytics | Dr. Priya Sharma's quant team (2 analysts) | 50% |
| SOE definition authoring — operations | Maria Torres's operations team (1 analyst) | 30% |
| Compliance review — information barrier policy | David Okonkwo / EMEA compliance lead | 20% |
| Model risk validation — RiskCompass VaR | Sarah Nakamura's model risk team (2 validators) | 60% |

### 4.6 Audit-Phase Protocol: RiskCompass

| Phase | Duration | Blocking | Criteria to Advance |
|-------|----------|----------|---------------------|
| Shadow | Weeks 5–6 | None — monitor only | Zero Chronicle gaps; Arbiter baseline established |
| Warn | Weeks 7–10 | None — log violations | < 0.5% false positive rate; all P0 violations reviewed |
| Soft enforce | Weeks 11–12 | Block with human override available | < 5 overrides/week; no P0 violations in final week |
| Full enforce | Q2 onwards | Block unconditionally; escalate to Sentinel AI for ambiguous cases | SR 11-7 validation signed off; Go/No-Go passed |

### 4.7 Audit-Phase Protocol: OpsFabric

| Phase | Duration | Blocking | Criteria to Advance |
|-------|----------|----------|---------------------|
| Shadow | Weeks 6–7 | None — monitor only | Settlement instruction paths validated; NAV gate logic confirmed |
| Warn | Weeks 8–10 | None — log violations | Zero settlement deadline misses attributable to SOE; < 0.5% false positive rate |
| Soft enforce | Weeks 11–12 | Block with human override | NAV dual-approval gate functional; no P0 violations |
| Full enforce | Q2 onwards | Block unconditionally | Maria Torres operational sign-off; Go/No-Go passed |

### 4.8 Success Metrics — Phase 1

| Metric | Target |
|--------|--------|
| Sentinel-Ops p99 latency (pre-filter) | < 2ms |
| Chronicle audit completeness | 100% |
| RiskCompass VaR model validation completed | Q1 W11 |
| Settlement fails attributable to OpsFabric SOE interference | 0 |
| SOE false positive rate (warn mode) | < 0.5% |
| Information barrier SOE policies authored for all 7 apps | 100% (not yet enforcing) |

---

## 5. Phase 2 — Core Investment (Q2 2026)

### 5.1 Scope

**Applications:** AlphaEngine, TradeSentinel
**Platform additions:** Information barrier partial activation (AlphaEngine — ResearchNexus chinese wall enforcing; TradeSentinel — ResearchNexus chinese wall enforcing), Arbiter trajectory analysis for High Risk agents, Beacon anomaly detection active for AlphaEngine and TradeSentinel

### 5.2 Rationale

AlphaEngine requires RiskCompass to be fully enforcing before deployment: the `limit-enforcer` agent's signals are consumed by AlphaEngine's `allocation-advisor` for pre-allocation limit checks. Deploying AlphaEngine against a non-enforcing RiskCompass would mean concentration limit checks are advisory rather than binding. TradeSentinel requires AlphaEngine to be generating real trade lists before the `order-router` and `execution-monitor` can be exercised against production-grade traffic. The AlphaEngine → TradeSentinel dependency is therefore hard-sequential within Q2.

### 5.3 Delivery Milestones

| Week | Milestone | Owner |
|------|-----------|-------|
| Q2 W1–W2 | AlphaEngine agents deployed in shadow mode; SOE definitions reviewed by Dr. Priya Sharma's quant team | Dr. Priya Sharma |
| Q2 W2 | AlphaEngine concentration limit SOE constraints validated against live RiskCompass limit-enforcer signals | Dr. Priya Sharma / Sarah Nakamura |
| Q2 W3–W4 | AlphaEngine elevated to warn mode; quant team reviews all violation logs daily | Dr. Priya Sharma |
| Q2 W4 | AlphaEngine → ResearchNexus chinese wall (readDeny on pre-publication paths) activated; tested under load | David Okonkwo |
| Q2 W5–W6 | AlphaEngine elevated to soft enforce; override threshold: < 3 overrides/week to proceed | James Chen |
| Q2 W6 | TradeSentinel agents deployed in shadow mode; `order-router` SOE definitions validated against FlexTrade EMS integration | James Chen / Maria Torres |
| Q2 W7–W8 | TradeSentinel elevated to warn mode; MiFID II best execution logging verified end-to-end | David Okonkwo |
| Q2 W8 | TradeSentinel → ResearchNexus chinese wall activated; Beacon anomaly detection enabled for both apps | David Okonkwo |
| Q2 W10–W11 | Phase 2 Go/No-Go review | Program Governance Board |
| Q2 W12 | AlphaEngine and TradeSentinel elevated to full enforce | James Chen |

### 5.4 Go/No-Go Criteria — Phase 2

| Gate | Metric | Threshold |
|------|--------|-----------|
| AlphaEngine concentration enforcement | End-to-end test: SOE blocks allocation instruction exceeding mandate concentration limit | Pass (zero false negatives in test suite) |
| Best execution logging completeness | % of TradeSentinel order-router decisions with venue selection rationale logged to Chronicle before order submission | 100% |
| Chinese wall — AlphaEngine | Penetration test: attempt to read ResearchNexus pre-publication path from AlphaEngine agent | Block confirmed; escalation event logged |
| Chinese wall — TradeSentinel | Penetration test: attempt to read ResearchNexus pre-publication path from TradeSentinel agent | Block confirmed; escalation event logged |
| EU AI Act conformity — AlphaEngine | Conformity assessment documentation complete | David Okonkwo / Robert Lindqvist sign-off |
| EU AI Act conformity — TradeSentinel | Conformity assessment documentation complete | David Okonkwo / Robert Lindqvist sign-off |
| Beacon anomaly detection | Beacon generates zero false-positive alerts on one full trading week of baseline traffic | Sarah Nakamura review |
| AlphaEngine → TradeSentinel data flow | End-to-end test: AlphaEngine trade list consumed by TradeSentinel order-router with full SOE coverage | Pass |
| Override rate — AlphaEngine (soft enforce) | < 3 overrides/week in final 2 weeks of soft enforce phase | Confirmed |
| Arbiter trajectory analysis | Arbiter correctly flags simulated high-risk trajectory (injected test session) before hard limit breach | Pass |

### 5.5 Staffing

| Role | Owner | Allocation |
|------|-------|------------|
| AlphaEngine SOE tuning and quant validation | Dr. Priya Sharma's quant team (3 analysts) | 80% |
| TradeSentinel integration — FlexTrade EMS | James Chen's integration team (2 engineers) | 70% |
| Information barrier activation and testing | David Okonkwo / Information Barriers team | 40% |
| EU AI Act conformity assessment — AlphaEngine, TradeSentinel | Robert Lindqvist / external legal (EMEA) | 60% |
| Beacon anomaly detection tuning | Dr. Priya Sharma (statistical baselines) | 30% |
| Model risk validation — AlphaEngine optimization model | Sarah Nakamura's model risk team | 50% |

### 5.6 Audit-Phase Protocol: AlphaEngine

| Phase | Duration | Blocking | Criteria to Advance |
|-------|----------|----------|---------------------|
| Shadow | Q2 W1–W2 | None | Quant team confirms SOE definitions match mandate constraints |
| Warn | Q2 W3–W5 | None — log violations | Zero concentration limit bypasses; false positive rate < 0.5% |
| Soft enforce | Q2 W5–W11 | Block with override | < 3 overrides/week; chinese wall penetration tests pass |
| Full enforce | Q2 W12+ | Block unconditionally | Conformity assessment signed off; Go/No-Go passed |

### 5.7 Audit-Phase Protocol: TradeSentinel

| Phase | Duration | Blocking | Criteria to Advance |
|-------|----------|----------|---------------------|
| Shadow | Q2 W6–W7 | None | Best execution logging confirmed; no latency degradation on order-router |
| Warn | Q2 W7–W9 | None — log violations | 100% best execution log coverage; MAR pattern detection functional |
| Soft enforce | Q2 W9–W11 | Block with override | Zero P0 violations; separation of duties between tca-analyzer and order-router confirmed |
| Full enforce | Q2 W12+ | Block unconditionally | Conformity assessment signed off; Go/No-Go passed |

### 5.8 Success Metrics — Phase 2

| Metric | Target |
|--------|--------|
| AlphaEngine concentration limit enforcement accuracy | 100% block rate on limit-breaching test instructions |
| TradeSentinel best execution log completeness | 100% of order decisions logged pre-submission |
| Chinese wall violation attempts blocked | 100% — zero successful pre-publication reads from trading agents |
| Beacon false positive rate (first full trading week) | < 2 alerts/day |
| AlphaEngine SR 11-7 validation completed | Q2 W10 |
| TradeSentinel MiFID II transaction reporting tested end-to-end | Q2 W8 |

---

## 6. Phase 3 — Compliance and Advisory (Q3 2026)

### 6.1 Scope

**Applications:** ComplianceShield, AdvisorLens
**Platform additions:** Full compliance monitoring stack operational; GDPR Art.22 human approval gate active in AdvisorLens; EU AI Act Art.52 AI disclosure enforcement active; Chronicle OSCAL-format compliance report generation enabled

### 6.2 Rationale

ComplianceShield's `trade-surveiller` requires all trading data flows — TradeSentinel execution records and OpsFabric settlement records — to be stable and complete before surveillance can be meaningful. Deploying a surveillance system against incomplete data produces false negatives that may appear to be clean compliance records. ComplianceShield must therefore wait until TradeSentinel and OpsFabric are fully enforcing in Q2. AdvisorLens requires published research from ResearchNexus (available via the Q1 SOE definitions) and stable client data access patterns; it does not depend on ResearchNexus being live in full enforce mode, but it does require that the research publication gate be operational and tested.

### 6.3 Delivery Milestones

| Week | Milestone | Owner |
|------|-----------|-------|
| Q3 W1–W2 | ComplianceShield agents deployed in shadow mode; `trade-surveiller` read access to all trading data paths validated | David Okonkwo |
| Q3 W2 | Chronicle OSCAL-format report generation enabled; first compliance report generated for Q2 trading data | David Okonkwo |
| Q3 W3–W4 | ComplianceShield elevated to warn mode; MAR pattern detection false positive rate reviewed weekly by compliance team | David Okonkwo |
| Q3 W4 | AdvisorLens agents deployed in shadow mode; GDPR Art.22 human approval gate configured; EU AI Act Art.52 disclosure enforcement activated | James Chen / David Okonkwo |
| Q3 W5–W6 | AdvisorLens suitability-checker validation: end-to-end test with sample client profiles against mandate constraints | Dr. Priya Sharma / Wealth Management team |
| Q3 W6–W8 | ComplianceShield elevated to soft enforce; `breach-detector` escalation workflow tested | David Okonkwo |
| Q3 W7–W8 | AdvisorLens elevated to warn mode; Art.52 disclosure enforcement confirmed on 100% of client-facing outputs | David Okonkwo |
| Q3 W9 | AdvisorLens elevated to soft enforce; GDPR Art.22 override count monitored | James Chen |
| Q3 W10–W11 | Phase 3 Go/No-Go review | Program Governance Board |
| Q3 W12 | ComplianceShield and AdvisorLens elevated to full enforce | James Chen |

### 6.4 Go/No-Go Criteria — Phase 3

| Gate | Metric | Threshold |
|------|--------|-----------|
| ComplianceShield surveillance coverage | % of TradeSentinel and OpsFabric transactions visible to trade-surveiller | 100% |
| MAR detection test | Simulated layering pattern (injected) detected by trade-surveiller | Detection within 5 minutes; alert escalated |
| Art.52 disclosure enforcement | % of AdvisorLens client-facing outputs with required AI disclosure string | 100% — zero outputs without disclosure |
| GDPR Art.22 gate | Automated material recommendation blocked pending human advisor sign-off | Confirmed in UAT |
| ComplianceShield filing path restriction | Penetration test: attempt by regulatory-filer to write outside approved staging directory | Block confirmed; Chronicle event logged |
| OSCAL compliance report quality | First Q2 OSCAL report reviewed by David Okonkwo's team | Accepted — no material gaps |
| AdvisorLens client data read-only | Penetration test: attempt to write to client profile from any AdvisorLens agent | Block confirmed |
| ComplianceShield override rate (soft enforce) | < 2 overrides/week in final 2 weeks | Confirmed |

### 6.5 Staffing

| Role | Owner | Allocation |
|------|-------|------------|
| ComplianceShield SOE and surveillance configuration | David Okonkwo / US and EMEA compliance teams | 60% |
| Chronicle OSCAL report configuration | James Chen's engineering team (1 engineer) | 40% |
| AdvisorLens suitability logic validation | Dr. Priya Sharma's quant team (1 analyst) | 30% |
| GDPR Art.22 and Art.52 implementation review | Robert Lindqvist / EMEA legal | 40% |
| AdvisorLens client data classification review | Wei Zhang (CISO) | 20% |

### 6.6 Audit-Phase Protocol: ComplianceShield

| Phase | Duration | Blocking | Criteria to Advance |
|-------|----------|----------|---------------------|
| Shadow | Q3 W1–W3 | None | 100% trade data visibility; OSCAL report baseline established |
| Warn | Q3 W3–W6 | None — log violations | MAR detection tested; < 1% false positive rate on surveillance alerts |
| Soft enforce | Q3 W6–W11 | Block with override | Filing path restrictions confirmed; breach-detector escalation workflow tested |
| Full enforce | Q3 W12+ | Block unconditionally | Go/No-Go passed; David Okonkwo sign-off |

### 6.7 Audit-Phase Protocol: AdvisorLens

| Phase | Duration | Blocking | Criteria to Advance |
|-------|----------|----------|---------------------|
| Shadow | Q3 W4–W6 | None | Art.52 disclosure logic confirmed; suitability-checker test coverage complete |
| Warn | Q3 W6–W8 | None — log violations | 100% Art.52 disclosure coverage; GDPR Art.22 gate logic confirmed |
| Soft enforce | Q3 W8–W11 | Block with override | < 2 Art.22 overrides/week; zero outputs without AI disclosure |
| Full enforce | Q3 W12+ | Block unconditionally | Go/No-Go passed; Robert Lindqvist sign-off for EMEA |

### 6.8 Success Metrics — Phase 3

| Metric | Target |
|--------|--------|
| ComplianceShield surveillance coverage | 100% of trades visible |
| Art.52 AI disclosure enforcement rate | 100% |
| GDPR Art.22 gate false negatives (material proposals bypassing human sign-off) | 0 |
| First OSCAL compliance report filed | Q3 W2 |
| MAR detection time for simulated pattern | < 5 minutes |
| ComplianceShield regulatory-filer unauthorized write attempts blocked | 100% |

---

## 7. Phase 4 — Research and Platform Optimization (Q4 2026)

### 7.1 Scope

**Applications:** ResearchNexus
**Platform additions:** Full 25-agent platform operational; Research–Trading chinese wall fully active on both sides; cross-application Beacon anomaly detection at platform scale; Arbiter cross-application risk budget management; performance optimization and capacity planning for full-scale operation

### 7.2 Rationale

ResearchNexus is deployed last because the chinese wall between Research and Trading is the most complex information barrier in the platform, and it cannot be safely tested until TradeSentinel and AlphaEngine are live, fully enforcing, and generating real position and order data. The wall must deny ResearchNexus agents read access to live trading positions — paths that only exist once TradeSentinel is in production. Deploying ResearchNexus earlier would mean the deny rules are tested against synthetic or absent data, masking the most operationally significant failure mode: a research agent reading a live pending order. Regulation FD and MAR violations arising from such a failure carry material regulatory and reputational consequences.

### 7.3 Delivery Milestones

| Week | Milestone | Owner |
|------|-----------|-------|
| Q4 W1–W2 | ResearchNexus agents deployed in shadow mode; chinese wall readDeny rules validated against live TradeSentinel and AlphaEngine paths | David Okonkwo / Dr. Priya Sharma |
| Q4 W2 | Research publication gate tested end-to-end: research output written to staging, blocked from trading apps until human analyst promotes to published directory | David Okonkwo |
| Q4 W3–W4 | ResearchNexus elevated to warn mode; SFDR ESG scoring output reviewed by quant team for accuracy | Dr. Priya Sharma |
| Q4 W4 | Full Research–Trading chinese wall activated on both sides; penetration test suite run across all 7 applications | David Okonkwo / Wei Zhang |
| Q4 W5–W6 | Beacon cross-application anomaly detection enabled at platform scale; baseline established across all 25 agents | Dr. Priya Sharma |
| Q4 W6 | ResearchNexus elevated to soft enforce; publication gate override count monitored | James Chen |
| Q4 W7–W8 | Arbiter cross-application risk budget finalized; risk decay parameters reviewed against Q3 trajectory data | Sarah Nakamura / Dr. Priya Sharma |
| Q4 W8–W9 | Platform-wide performance baseline: p99 latency, Chronicle throughput, Arbiter scoring lag | James Chen |
| Q4 W10–W11 | Phase 4 Go/No-Go review — full platform | Program Governance Board |
| Q4 W12 | ResearchNexus elevated to full enforce; full 25-agent platform declared operational | James Chen |

### 7.4 Go/No-Go Criteria — Phase 4

| Gate | Metric | Threshold |
|------|--------|-----------|
| Chinese wall — ResearchNexus | Penetration test: attempt by any ResearchNexus agent to read TradeSentinel positions or AlphaEngine pending orders | Block confirmed; Regulation FD escalation event logged |
| Chinese wall — full activation | Penetration test suite across all 7 applications, all barrier combinations | Zero successful violations across full suite |
| Research publication gate | Test: trading app attempt to read ResearchNexus staging (pre-publication) path | Block confirmed at SOE layer, not just file permissions |
| SFDR ESG scoring accuracy | Dr. Priya Sharma's quant team review of esg-scorer outputs against manual benchmark | > 95% classification agreement |
| Beacon platform-scale baseline | Beacon operates across 25 agents for 2 full trading weeks with < 5 false positive alerts/day | Confirmed |
| Platform p99 latency | SOE pre-filter p99 latency at full 25-agent load | < 5ms |
| Chronicle throughput | Chronicle sustains full audit event volume under peak load (simulated) without event loss | 100% event capture |
| Arbiter cross-app risk budgets | All 7 applications have calibrated, signed-off risk budgets with decay parameters | Sarah Nakamura sign-off |
| Reg FD compliance confirmation | David Okonkwo's information barriers team confirms chinese wall governance satisfies Reg FD obligations | Signed-off |
| Full platform SR 11-7 inventory | All AI models used by all 7 applications registered in model registry with validation status | Sarah Nakamura sign-off |

### 7.5 Staffing

| Role | Owner | Allocation |
|------|-------|------------|
| ResearchNexus SOE configuration and SFDR validation | Dr. Priya Sharma's quant team (2 analysts) | 70% |
| Chinese wall full activation and penetration testing | David Okonkwo / Wei Zhang (CISO) | 60% |
| Beacon cross-app anomaly detection tuning | Dr. Priya Sharma (statistical baselines) | 40% |
| Platform performance optimization | James Chen's infrastructure team (2 engineers) | 50% |
| Reg FD legal confirmation | David Okonkwo / external SEC counsel | 30% |
| Full platform SR 11-7 model inventory review | Sarah Nakamura's model risk team | 40% |

### 7.6 Audit-Phase Protocol: ResearchNexus

| Phase | Duration | Blocking | Criteria to Advance |
|-------|----------|----------|---------------------|
| Shadow | Q4 W1–W3 | None | Chinese wall deny rules confirmed against live trading data; publication gate logic validated |
| Warn | Q4 W3–W5 | None — log violations | Zero successful pre-publication leaks in warn log; SFDR accuracy confirmed |
| Soft enforce | Q4 W5–W10 | Block with override | Full chinese wall penetration test suite passed; < 2 publication gate overrides/week |
| Full enforce | Q4 W12 | Block unconditionally | Go/No-Go passed; Reg FD legal sign-off; David Okonkwo and Dr. Priya Sharma sign-off |

### 7.7 Success Metrics — Phase 4 (Full Platform)

| Metric | Target |
|--------|--------|
| Chinese wall violation attempts blocked (full suite) | 100% |
| Platform SOE pre-filter p99 latency (25 agents) | < 5ms |
| Chronicle audit completeness across all 7 applications | 100% |
| Beacon false positive rate (steady state, 25 agents) | < 5 alerts/day |
| SFDR ESG classification accuracy | > 95% vs. manual benchmark |
| Full SR 11-7 model inventory complete | 100% of in-scope models validated |
| Platform uptime (Sentinel-Ops enforcement layer) | > 99.9% |
| Reg FD compliance confirmation | Signed-off by Q4 W10 |

---

## 8. Risk Register and Mitigation Strategies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| EU AI Act conformity assessment delays for AlphaEngine or TradeSentinel | Medium | High — Phase 2 start slides | Commission external legal counsel (Robert Lindqvist / EMEA) in Q1 W1; begin conformity documentation in parallel with shadow phase |
| Beacon anomaly detection excessive false positives creating alert fatigue | Medium | Medium — compliance team distrusts system | Calibrate Beacon against 4 weeks of shadow-mode data before enabling alerts; use Dr. Priya Sharma's quant team for statistical baseline review |
| SOE false positives in full enforce mode blocking legitimate trading operations | Low-Medium | High — TradeSentinel order-router blocked during market hours | Maintain soft enforce on TradeSentinel for minimum 4 weeks before full enforce; establish 24/7 override escalation path to James Chen during initial full enforce period |
| Chinese wall configuration error — research leaks to trading | Low | Very High — Regulation FD violation; MAR exposure | Penetration test suite authored in Q1; executed independently by Wei Zhang's security team; results reviewed by David Okonkwo before any chinese wall activation |
| Chronicle audit storage capacity — 25 agents at full load | Medium | Medium — audit gaps if storage is exhausted | S3 lifecycle policies configured in Q1; storage capacity reviewed at Phase 2 Go/No-Go |
| SR 11-7 model validation backlogs (AlphaEngine optimization model) | Medium | High — Phase 2 Go/No-Go gate blocked | Sarah Nakamura to begin AlphaEngine model documentation review in Q1 W8, concurrent with shadow phase; do not wait for full enforce to start SR 11-7 process |
| ResearchNexus SFDR ESG scoring accuracy below 95% threshold | Medium | Medium — Phase 4 full enforce blocked | Dr. Priya Sharma's quant team validates ESG scoring logic in Q3 (pre-deployment); methodology documented and independently reviewed before ResearchNexus shadow phase |
| Operational disruption during OpsFabric soft enforce (T+1 settlement deadlines) | Low | High — CSDR settlement penalties | Settlement deadline tracking monitored by Maria Torres daily during soft enforce; override path maintained 24 hours during settlement windows |

---

## 9. Program Governance

### 9.1 Program Governance Board

| Member | Role | Frequency |
|--------|------|-----------|
| James Chen | Program Sponsor; Go/No-Go authority | Weekly |
| Sarah Nakamura | Model risk and SR 11-7 gate authority | Bi-weekly; Go/No-Go gates |
| David Okonkwo | Compliance, information barrier, and Reg FD gate authority | Bi-weekly; Go/No-Go gates |
| Maria Torres | Operational readiness authority (OpsFabric, settlement) | Monthly; Go/No-Go gates |
| Robert Lindqvist | EMEA regulatory authority (EU AI Act, MiFID II) | Monthly; conformity assessments |
| Dr. Priya Sharma | Quantitative model delivery and SOE definition accuracy | Weekly |
| Wei Zhang | Security and penetration test authority | Go/No-Go gates; security events |

### 9.2 Escalation Protocol

Any Go/No-Go gate failure is escalated to the Program Governance Board within 24 hours. Gate failures do not automatically halt program execution — the Board may accept a documented residual risk and proceed, or issue a formal hold. All gate failures and Board decisions are recorded in the program risk register and included in the quarterly AI Governance report to Catherine Hargrove.

### 9.3 Communication Cadence

| Meeting | Frequency | Attendees | Purpose |
|---------|-----------|-----------|---------|
| Program status review | Weekly | James Chen, Dr. Priya Sharma | Milestone tracking, blocker escalation |
| Go/No-Go review | Per phase | Full Governance Board | Gate assessment, proceed/hold decision |
| Compliance readiness review | Monthly | David Okonkwo, Robert Lindqvist | Regulatory posture, examination readiness |
| SOE violation review | Weekly | Sarah Nakamura, Dr. Priya Sharma, compliance lead | Chronicle violation log analysis; false positive tuning |
| CEO briefing | Quarterly | Catherine Hargrove, James Chen | Program progress, risk posture, budget status |

---

## 10. Document References

| Document | Title |
|----------|-------|
| [00-company-narrative.md](./00-company-narrative.md) | AssetCo business context, governance obligations, and Sentinel-Ops selection rationale |
| [01-operating-model.md](./01-operating-model.md) | Investment value chain and AI application mapping |
| [02-ai-enablement-strategy.md](./02-ai-enablement-strategy.md) | Strategic priorities, agent taxonomy, and authority level definitions |
| [03-regulatory-landscape.md](./03-regulatory-landscape.md) | Multi-jurisdictional regulatory framework analysis |
| [04-app-portfolio-overview.md](./04-app-portfolio-overview.md) | Full application and agent inventory with SOE constraints |

---

*AssetCo Investment Management is a fictional company created for demonstration purposes. All timelines, personnel assignments, regulatory assessments, and metrics are illustrative.*

*This document is maintained by the AssetCo AI Platform team under the AI Enablement program.*
