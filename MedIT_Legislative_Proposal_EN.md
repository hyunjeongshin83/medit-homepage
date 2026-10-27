# MedIT Policy White Paper

**Pharmacist-Assisted Medication Information Model: Patient Safety, Adverse Event Reporting, and Digital Health Regulation**

- Author: Hyun Jeong Shin, Founder, MedIT
- Date: June 11, 2026
- Purpose: Policy reference for US, EU, UK, and global stakeholders
- Status: Pre-regulatory engagement draft — not FDA submission
- Citations checked: October 27, 2026 (Korean statutes against the Korea Law Information Center, current versions). This is not legal advice; items marked "primary text to be verified" were not checked against the primary source.

---

## 1. Executive Summary

MedIT is a pharmacist-assisted medication information platform, currently at the design and demo stage, operated from the Republic of Korea. This white paper presents illustrative scenarios assumed by the founder (not collected from real patients) and proposes policy directions for strengthening adverse event reporting and digital pharmacy regulation, drawing parallels between Korea's KAERS system and US FAERS/MedWatch.

**Key positioning**: MedIT is designed to support — not replace — the independent professional judgment of licensed pharmacists. Patient-facing responses are planned to be reviewed by licensed pharmacists at partner pharmacies before delivery; no such review service is operating yet. The platform does not provide medical diagnosis, treatment recommendations, or prescriptions.

---

## 2. The Underreporting Problem

Adverse event reporting systems worldwide rely on voluntary submissions, but patient self-reporting rates remain critically low.

### Korea (KAERS)
- 2025: 277,279 total reports (about 277,000; up about 9.4% from 253,486 in 2024)
- Reports by reporter type (share of the 277,279 total, calculated; may not sum to exactly 100% because of rounding): regional pharmacovigilance centers 181,898 (65.6%); pharmaceutical companies 86,891 (31.3%); healthcare professionals 6,902 (2.5%); patients/consumers directly 100 (0.04%); other 1,488 (0.5%)
- **Reports received directly from patients/consumers: only 100 (0.04%)**, so the direct reporting channel is used very little. Reports in which the first reporter was a consumer or non-healthcare professional numbered 30,849 (11.1%), but most appear to have reached KAERS through regional centers or pharmaceutical companies (reporting route to be confirmed against the original data); this indicates that consumers do bring adverse events to others' attention
- Source: Korea Institute of Drug Safety & Risk Management, "2025 Drug Safety Information Report Trends" (as reported by the Korean trade press Yaksa Gongron, March 10, 2026; cross-checking against the original data is recommended)

### Global comparison
- Hazell & Shakir, *Drug Safety* 2006: median underreporting rate of 94%
- Pirmohamed et al., *BMJ* 2004: 6.5% of UK hospital admissions related to ADRs
- US FDA FAERS: 1,289,133 reports received in 2014 alone (FDA, "reports received and reports entered in FAERS by year"); patient direct reporting via FDA Form 3500B remains a small fraction

**The structural gap**: Patients lack accessible, intuitive channels to report adverse events in their own words.

---

## 3. Five Illustrative Inquiry Scenarios (Assumed by the Founder)

These are illustrative scenarios assumed by the founder (not collected from real patients) that show gaps current regulatory frameworks struggle to address:

| # | Inquiry Type | Example | Regulatory Gap |
|---|---|---|---|
| 1 | OTC drug effect timing | "I took Benachio (OTC indigestion remedy); I want faster effect" | OTC information provision standards |
| 2 | Chronic disease side effect | "I'm dizzy on losartan; should I continue?" | Post-prescription monitoring |
| 3 | Symptom severity | "Metformin nausea is severe; what should I do?" | Patient-initiated adverse event escalation |
| 4 | Drug-drug interaction | "Can I take Tylenol and Brufen together?" | Integrated interaction guidance |
| 5 | High-risk drug monitoring | "I get frequent nosebleeds on warfarin; is it dangerous?" | Active monitoring for high-risk medications |

Each scenario is mapped to a regulatory gap that appears to exist in both Korean and US systems.

---

## 4. Design Principles for Non-Device CDS Compliance

MedIT is designed to align with FDA's Clinical Decision Support (CDS) Software guidance (revised guidance issued January 6, 2026 and re-issued January 29, 2026; Docket FDA-2017-D-6569) under FD&C Act §520(o)(1)(E):

### Criterion 1 — Information Type
MedIT does **not** acquire, process, or analyze medical images, in vitro diagnostic device signals, or pattern/signal acquisition system data.

### Criterion 2 — Information Display
The platform is designed to display, analyze, or print medical information about a patient, including medication information from regulatory sources (Korea MFDS, US FDA labels), peer-reviewed clinical literature citations, and clinical practice guidelines.

### Criterion 3 — HCP Audience
Responses are designed to be reviewed by licensed pharmacists (treated here as HCPs under the FDA guidance's definition of health care professional; the exact wording of that definition is to be confirmed against the primary text).

### Criterion 4 — Independent Review
Planned design: all AI-generated drafts would include source citations (PubMed, FDA, regulatory databases), plain-language reasoning summaries, a pharmacist review interface before patient delivery, and exclusion of time-critical/emergency use cases. The current demo screens are rule-based samples.

**Important caveat**: When MedIT provides information directly to patients (as opposed to HCPs), the §520(o)(1)(E) Non-Device CDS exemption is not available for that function. As summarized here (not a direct quotation), the 2026 FDA guidance indicates that a software function intended to support or provide recommendations to a patient fails criterion three (HCP audience) and would not be non-device CDS; the guidance focuses on software intended for HCPs.

MedIT addresses this by positioning licensed pharmacists as the primary user for clinical decision support functions, providing patient-facing content only as general information (FDA general wellness/educational policy), and excluding individualized diagnostic or treatment recommendations from patient-facing outputs.

---

## 5. International Regulatory Context

### United States
- **FD&C Act §520(o)** — Non-Device CDS exemption (21st Century Cures Act, 2016; section numbering — primary text to be verified)
- **FDA CDS Guidance** (issued January 6, 2026; re-issued January 29, 2026)
- **HIPAA** — applies to any entity processing US PHI, regardless of national origin
- **State pharmacy laws** — vary by state; MedIT does not offer services to US residents and does not engage US pharmacist-patient relationships

### European Union
- **MDR Rule 11** — software for diagnostic/therapeutic decisions defaults to Class IIa or higher (primary text to be verified)
- **AI Act (Regulation 2024/1689)** — high-risk for AI that is a safety component of, or is itself, a medical device requiring third-party conformity assessment (Annex I route, e.g., via MDR); it is not an automatic classification of all medical device AI. Application dates were reportedly postponed by a 2026 amendment (August 2, 2028 reported for Annex I products; secondary source, primary text to be verified)
- **GDPR Article 9** — special protections for health data

### United Kingdom
- **MHRA** — software-as-medical-device regulation
- **Yellow Card Scheme** — patient and HCP adverse event reporting (~60,000 reports annually)

### Japan
- **PMDA** — two-stage SaMD approval pathway

### Australia
- **TGA** — SaMD regulation, ARTG listing

---

## 6. HIPAA Considerations

MedIT does not currently process US Protected Health Information (PHI) and does not operate as a HIPAA-covered entity or business associate. The platform is designed with Korea's Personal Information Protection Act (PIPA) and, where applicable, GDPR Article 9 in mind. No HIPAA-compliant channel is available today. Encryption, access controls, and audit trails consistent with HIPAA Security Rule technical safeguards are design goals, not audited or certified controls, and Business Associate Agreements (BAAs) would have to be established before any US PHI is processed through formal US healthcare partnerships.

US-based partnerships requiring PHI processing would necessitate BAA execution, HIPAA-eligible cloud infrastructure (separate from Korean operations), and HIPAA-compliant messaging channels (KakaoTalk and standard SMS are not HIPAA-compliant).

---

## 7. Policy Recommendations

### 7.1 Strengthen Patient Self-Reporting
- Reduce friction in patient adverse event reporting (FDA Form 3500B in the US, Yellow Card in UK)
- Enable digital tools to assist patients in completing reports in their own language
- Provide automated routing to appropriate national authorities

### 7.2 Recognize "Information Provision" SaMD Category
- Distinguish "information-provision" software from clinical decision-making software
- Reference: US Non-Device CDS framework as a model
- Reduce regulatory burden on tools that aid — not replace — professional judgment

### 7.3 Pharmacist-Assisted AI Frameworks
- Recognize pharmacist verification as a safety mechanism for AI-generated medication information
- Define clear responsibility allocation: AI assists, pharmacist verifies, pharmacist bears professional responsibility

### 7.4 Cross-Border Pharmacovigilance
- Support international interoperability of adverse event reporting (ICH E2B, MedDRA)
- Facilitate patient mobility data sharing through standards (FHIR, RxNorm)

---

## 8. MedIT's Regulatory Engagement Approach (Planned)

MedIT plans to consider the following forms of engagement: FDA public docket comments (e.g., on CDS guidance), Patient-Focused Drug Development (PFDD) participation, academic publication on underreporting, participation in industry associations (e.g., Consumer Technology Association, digital health groups), and cross-border regulatory dialogue with MFDS, FDA, MHRA, and PMDA. No such engagement has taken place yet.

This white paper does not constitute a regulatory submission. MedIT is not seeking FDA approval at this stage; the platform is positioned as information provision and pharmacist-assisted services.

---

## 9. Open Research Questions

1. What is the optimal pharmacist review latency for patient-perceived "real-time" responses while maintaining safety?
2. How can AI-generated medication information be reliably distinguished from medical advice in patient-facing communications?
3. What standards should govern the use of regulatory drug databases (FDA Orange Book, MFDS e-약은요, RxNorm) in consumer-facing applications?
4. How can underreporting be reduced without introducing reporting fatigue or false-positive overload?

---

## 10. References

### Korean Law
Act numbers below are the current versions per the Korea Law Information Center (law.go.kr), last verified October 27, 2026. Amendments with later effective dates exist, so re-check the current version when citing.

- Pharmaceutical Affairs Act (current: Act No. 21525, effective October 8, 2026; Act No. 21937, which restricts wholesaler licensing for telemedicine intermediaries, promulgated September 15, 2026, effective September 16, 2027)
- Medical Service Act (current: Act No. 21490, effective October 2, 2026; telemedicine amendment Act No. 21238, promulgated December 23, 2025, effective December 24, 2026)
- Digital Medical Products Act (enacted as Act No. 20139, promulgated January 23, 2024, effective January 24, 2025; current: Act No. 21525, effective October 8, 2026; Articles 33–35 effective January 24, 2026)
- Personal Information Protection Act (current: Act No. 21445, effective September 11, 2026)

### US Law and Regulation
- 21st Century Cures Act (2016), P.L. 114-255 (primary text to be verified)
- FD&C Act §520(o) — Non-Device CDS (primary text to be verified)
- FDA CDS Guidance (issued January 6, 2026; re-issued January 29, 2026), Docket FDA-2017-D-6569
- HIPAA — 45 CFR Parts 160 and 164
- FDA FAERS — fda.gov/drugs/surveillance/faers

### International
- EU MDR 2017/745, Annex VIII Rule 11 (primary text to be verified)
- EU AI Act, Regulation (EU) 2024/1689 (the 2026 amendment postponing application dates: primary text to be verified)
- WHO Programme for International Drug Monitoring
- ICH E2B(R3) Electronic Transmission of Individual Case Safety Reports

### Academic Sources
- Hazell L, Shakir SAW. *Drug Saf.* 2006;29(5):385-396
- Pirmohamed M, et al. *BMJ.* 2004;329(7456):15-19
- Osanlou R, et al. *BMJ Open.* 2022;12(7):e055551

---

## 11. Disclaimers

**This document is informational only.** It does not constitute legal advice, regulatory submission, or medical advice.

**Not FDA approved**: MedIT has not been evaluated or approved by the US Food and Drug Administration. MedIT does not diagnose, treat, cure, or prevent any disease.

**Operator notice**: MedIT is operated from the Republic of Korea by Hyun Jeong Shin (sole proprietor). No pharmacist consultation service is operating yet; responses are planned to be reviewed by licensed pharmacists at partner pharmacies, and no partner pharmacy has been contracted. MedIT does not offer services to US residents, and no US pharmacist-patient relationship is formed.

**For US adverse event reporting**, contact FDA MedWatch: 1-800-FDA-1088 or fda.gov/medwatch.

---

**Contact**: hyunjeong.shin@sookmyung.ac.kr

**MedIT** — Medication Technology Platform · Pharmacist-Reviewed Information (Planned) · Adverse Event Safety · Patient KAERS Self-Report Assistance

— End of Document —
