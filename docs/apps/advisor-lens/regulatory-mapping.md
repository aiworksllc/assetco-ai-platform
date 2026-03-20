# AdvisorLens — Regulatory Mapping

**Application:** AdvisorLens
**Document:** regulatory-mapping.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** CCO, DPO, Legal, Compliance Technology
**Regulatory Jurisdictions:** US (SEC/FINRA), EU (ESMA/MiFID II, GDPR, EU AI Act), UK (FCA)

---

## 1. Regulatory Framework Summary

AdvisorLens is subject to the most extensive regulatory overlay of any application in the AssetCo AI Platform because it produces client-facing outputs that carry fiduciary weight. Four distinct regulatory regimes apply simultaneously for EU-domiciled HNW clients: SEC Advisers Act fiduciary, MiFID II suitability, GDPR automated decision-making protections, and EU AI Act AI disclosure and human oversight requirements.

| Regulation | Jurisdiction | Applies To | Implementation Owner |
|---|---|---|---|
| SEC Advisers Act (§206, Rule 204-3) | US | All US clients and managed accounts | Compliance / suitability-checker |
| SEC Regulation Best Interest (Reg BI) | US | Retail clients with managed accounts | Compliance / suitability-checker |
| MiFID II Art.25 | EU | EU-domiciled clients | suitability-checker |
| MiFID II Art.24(4) | EU | Cost and charges disclosure to all retail clients | client-reporter |
| GDPR Art.13/14 | EU | All EU data subjects | client-reporter |
| GDPR Art.22 | EU | EU data subjects subject to automated decisions | proposal-generator / SOE gate |
| GDPR Art.35 (DPIA) | EU | AdvisorLens deployment | DPO — pre-deployment requirement |
| EU AI Act Art.13 | EU | AI system transparency | All three agents |
| EU AI Act Art.14 | EU | Human oversight | Proposal approval gate |
| EU AI Act Art.52 | EU | AI disclosure to interacting humans | SOE content guardrail |
| SFDR Art.8/9 | EU | Sustainable investment products | client-reporter |
| FCA Consumer Duty (PS22/9) | UK | UK retail clients | client-reporter / suitability-checker |
| ERISA §404 | US | Pension and retirement clients | suitability-checker |

---

## 2. SEC Advisers Act — Fiduciary Duty

**Requirement:** Investment advisers registered under the Advisers Act owe a fiduciary duty to clients comprising a duty of loyalty and a duty of care. Under the duty of care, advice must reflect the client's specific financial situation, investment objectives, and risk tolerance — generic advice that ignores individual circumstances does not satisfy the standard.

**AdvisorLens Implementation:**
- `suitability-checker` evaluates every proposed recommendation against the client's documented risk tolerance, investment horizon, liquidity needs, and tax situation before any proposal is generated
- The suitability determination output includes an explicit "SEC Advisers Act best-interest" dimension that validates the recommendation is in the client's interest and not driven by undisclosed conflicts
- `proposal-generator` includes a mandatory conflicts-of-interest disclosure in every draft proposal
- Advisor sign-off on every proposal (the human approval gate) provides the documented evidence that a human fiduciary has reviewed and accepted responsibility for each recommendation

**Compliance Gap if SOE Removed:** Without the SOE, proposal-generator could generate and stage proposals based on generic model portfolio signals with no per-client suitability validation. The fiduciary duty requires individualized analysis; the SOE enforces this by making suitability-checker output a required input that cannot be bypassed.

---

## 3. MiFID II Art.25 — Suitability Assessment

**Requirement:** Under MiFID II Art.25(2), investment firms providing investment advice or portfolio management must obtain information on clients' knowledge and experience, financial situation, ability to bear losses, and investment objectives, and ensure recommended services are suitable. A suitability statement must be provided to the client explaining why the recommendation is suitable.

**AdvisorLens Implementation:**
- `suitability-checker` runs a per-recommendation Art.25 evaluation across all four MiFID II suitability dimensions: knowledge and experience, financial situation, ability to bear losses, investment objectives
- The structured suitability determination record serves as the Art.25 suitability statement; the proposal-generator embeds a human-readable suitability summary in every draft proposal
- `unsuitable` determinations block the proposal workflow; `requires-review` routes to compliance officer review
- Suitability records retained for 7 years per MiFID II record-keeping requirements (Art.25(6) and RTS 22)

**Audit Evidence:** Every suitability determination in `advisory/suitability-results/` constitutes a contemporaneous Art.25 record. The Chronicle audit trail captures the timestamp, input parameters, and determination output for every check run.

---

## 4. GDPR Art.22 — Automated Decision-Making

**Requirement:** GDPR Art.22 gives data subjects the right not to be subject to a decision based solely on automated processing that produces legal or similarly significant effects. Investment recommendations with fiduciary implications fall within the scope of "similarly significant effects." Controllers must either obtain explicit consent, establish contractual necessity, or implement a human-in-the-loop. Where any of these grounds applies, the data subject must be informed and given the right to obtain human review, express their point of view, and contest the decision.

**AdvisorLens Implementation:**
- The proposal approval gate (SOE writeDeny on `advisory/proposals/delivered/**`) ensures no recommendation reaches a client without a human advisor's review and sign-off — this satisfies the "human in the loop" requirement for Art.22(2)(b) (contractual necessity ground) and Art.22(3) (human review right)
- For clients who have exercised their Art.22 opt-out right (documented in the CRM consent record), `proposal-generator` applies the `GDPR-ART22-OPT-OUT` tag that triggers a **deliberative review** workflow — the advisor must document the reasoning behind the recommendation, not merely approve it in the review queue
- `suitability-checker` reads the GDPR consent record at the start of every suitability assessment; an opt-out flag prevents purely automated determination from being passed to the proposal stage

**Client Rights Process:** The DPO maintains a documented GDPR Art.22 rights process specifying how clients exercise opt-out, how opt-out status is recorded in Salesforce FSC, how advisors are notified of opt-out clients, and how the deliberative review process is evidenced for regulatory purposes.

---

## 5. GDPR Art.13/14 — Information Obligations

**Requirement:** GDPR Art.13 (data collected directly from the subject) and Art.14 (data obtained from third parties) require controllers to provide information about processing purposes, legal basis, retention periods, and data subject rights at or before the time of data collection.

**AdvisorLens Implementation:**
- `client-reporter` includes a data processing disclosure in every periodic client report summarising: the categories of personal data processed to generate the report, the legal basis for processing (contract performance / legitimate interests / consent), the retention periods, and the data subject's rights including the Art.22 right not to be subject to solely automated decisions
- The disclosure is template-driven and maintained by the DPO; client-reporter calls `mcp__document__apply_regulatory_template` to insert the current approved text into each report

---

## 6. GDPR Art.35 — Data Protection Impact Assessment

**Requirement:** GDPR Art.35 requires a DPIA before processing that is "likely to result in a high risk" to individuals' rights. The EU Data Protection Board's guidelines identify automated decision-making with significant effects, large-scale processing of sensitive data, and systematic monitoring as DPIA triggers. AdvisorLens meets all three.

**Status:** **DPIA is a pre-deployment requirement for AdvisorLens.** The DPO must complete and document a DPIA before AdvisorLens is deployed to production for EU-domiciled clients. The DPIA must address:
1. Systematic description of processing operations and purposes
2. Assessment of necessity and proportionality
3. Assessment of risks to data subjects' rights
4. Measures to address the risks (including SOE enforcement mechanisms)
5. Consultation with supervisory authority if residual risks remain high

The Sentinel-Ops SOE technical measures (client isolation, Art.22 enforcement, read-only access to client data, Art.52 disclosure guardrail) should be documented in the DPIA as risk mitigation measures.

---

## 7. EU AI Act Art.52 — Transparency and AI Disclosure

**Requirement:** EU AI Act Art.52(1) requires that AI systems designed to interact with natural persons disclose to those persons that they are interacting with an AI system, unless this is evident from the context. For AI-generated content presented to humans, disclosure of the AI origin is mandatory.

**AdvisorLens Implementation:**
- The SOE content guardrail enforces Art.52 disclosure as a **blocking technical control**: any write to a client-facing output path (`advisory/proposals/draft/**`, `advisory/reports/**`) that does not contain the exact approved disclosure text is blocked before the file write succeeds
- Missing disclosure generates a CRITICAL severity audit event in Chronicle — it is treated as a compliance failure, not a process gap
- Disclosure texts are defined in the SOE definition and cannot be modified without a formal SOE change that requires CCO and DPO sign-off

**Non-Bypassability:** Because enforcement is at the SOE gate layer (not in application code), no AdvisorLens agent, regardless of prompt engineering, model behaviour, or software bug, can produce a client-facing output without the disclosure. The SOE gate operates independently of the agent model.

---

## 8. EU AI Act Art.13 — Transparency for High-Risk AI

**Requirement:** High-risk AI systems must be designed and developed with sufficient transparency that deployers (AssetCo) and affected persons (clients) can understand the system's capabilities and limitations and interpret its output. This includes logging, explainability of decisions, and documentation of limitations.

**AdvisorLens Implementation:**
- `proposal-generator` produces proposals with embedded reasoning: every recommendation includes a structured rationale section explaining which factors drove the recommendation and what the key risk considerations are
- Suitability determination records include per-dimension rationale — it is always possible to explain why a specific holding was evaluated as suitable or unsuitable for a specific client at a specific point in time
- The Chronicle audit trail provides complete traceability from the input data used in a suitability assessment to the final recommendation presented to an advisor

---

## 9. EU AI Act Art.14 — Human Oversight

**Requirement:** High-risk AI systems must be designed and developed to allow effective oversight by natural persons during the period of use. This includes enabling those responsible to oversee, understand, interpret, and override the AI system's outputs.

**AdvisorLens Implementation:**
- The proposal approval gate is the primary Art.14 mechanism: advisors review every draft proposal and can reject, modify, or escalate before any recommendation reaches a client
- The `unsuitable` determination override path provides advisors with a documented mechanism to challenge and override a suitability determination with documented justification, satisfying the "override" requirement
- Kill-switch capability: any of the three AdvisorLens agents can be suspended by the Platform Security team without affecting the other agents — proposals in the draft queue remain accessible to advisors during agent downtime

---

## 10. FCA Consumer Duty

**Requirement:** FCA Consumer Duty (PS22/9), effective July 2023, requires firms to deliver good outcomes for retail customers across four outcome areas: products and services, price and value, consumer understanding, and consumer support.

**AdvisorLens Implementation:**
- `suitability-checker` outcomes monitoring: the Chronicle audit trail enables systematic review of whether recommendations resulted in client outcomes consistent with the client's stated objectives — Compliance runs quarterly outcomes monitoring reports against this data
- `client-reporter` generates FCA-compliant cost and charges disclosures and ensures personalised explanations of performance and risk, addressing the consumer understanding outcome
- For UK retail clients, `proposal-generator` applies UK-specific disclosure templates (FCA COBS 9A suitability report format) in addition to or instead of MiFID II templates

---

*This document is part of the AssetCo AI Platform documentation suite. This mapping should be reviewed by the CCO, DPO, and Legal before any production deployment and after any material regulatory change. It does not constitute legal advice.*
