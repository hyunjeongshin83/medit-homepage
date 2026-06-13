# MedIT Policy White Paper

**Pharmacist-Assisted Medication Information Model: Patient Safety, Adverse Event Reporting, and Digital Health Regulation**

- Author: Hyun Jeong Shin, Founder, MedIT
- Date: June 11, 2026
- Purpose: Policy reference for US, EU, UK, and global stakeholders
- Status: Pre-regulatory engagement draft — not FDA submission

---

## 1. Executive Summary

MedIT is a pharmacist-assisted medication information platform operated from the Republic of Korea. This white paper presents observed patterns from MedIT's natural-language patient inquiry interface and proposes policy directions for strengthening adverse event reporting and digital pharmacy regulation, drawing parallels between Korea's KAERS system and US FAERS/MedWatch.

**Key positioning**: MedIT is designed to support — not replace — the independent professional judgment of licensed pharmacists. Patient-facing responses are reviewed by Korea-licensed pharmacists before delivery. The platform does not provide medical diagnosis, treatment recommendations, or prescriptions.

---

## 2. The Underreporting Problem

Adverse event reporting systems worldwide rely on voluntary submissions, but patient self-reporting rates remain critically low.

### Korea (KAERS)
- 2025: ~270,000 total reports
- **Patient self-reports: only 100 (0.04%)**
- Source: Korea Institute of Drug Safety & Risk Management

### Global comparison
- Hazell & Shakir, *Drug Safety* 2006: median underreporting rate of 94%
- Pirmohamed et al., *BMJ* 2004: 6.5% of UK hospital admissions related to ADRs
- US FDA FAERS: ~2.6 million reports cumulative; patient direct reporting via FDA Form 3500B remains a small fraction

**The structural gap**: Patients lack accessible, intuitive channels to report adverse events in their own words.

---

## 3. Five Patient Inquiry Scenarios (from MedIT Platform)

These represent real-world patient communication patterns that current regulatory frameworks struggle to address:

| # | Inquiry Type | Example | Regulatory Gap |
|---|---|---|---|
| 1 | OTC drug effect timing | "I took Benachio (OTC indigestion remedy); I want faster effect" | OTC information provision standards |
| 2 | Chronic disease side effect | "I'm dizzy on losartan; should I continue?" | Post-prescription monitoring |
| 3 | Symptom severity | "Metformin nausea is severe; what should I do?" | Patient-initiated adverse event escalation |
| 4 | Drug-drug interaction | "Can I take Tylenol and Brufen together?" | Integrated interaction guidance |
| 5 | High-risk drug monitoring | "I get frequent nosebleeds on warfarin; is it dangerous?" | Active monitoring for high-risk medications |

Each pattern maps to a regulatory gap that exists in both Korean and US systems.

---

## 4. Design Principles for Non-Device CDS Compliance

MedIT is designed to align with FDA's Clinical Decision Support (CDS) Software guidance (January 29, 2026 revision, FDA-2017-D-6569) under FD&C Act §520(o)(1)(E):

### Criterion 1 — Information Type
MedIT does **not** acquire, process, or analyze medical images, in vitro diagnostic device signals, or pattern/signal acquisition system data.

### Criterion 2 — Information Display
The platform displays, analyzes, or prints medical information about a patient, including medication information from regulatory sources (Korea MFDS, US FDA labels), peer-reviewed clinical literature citations, and clinical practice guidelines.

### Criterion 3 — HCP Audience
Pharmacist-verified responses are designed for review by licensed pharmacists (HCPs per FDA definition: *"...nurse practitioner, registered nurse... dentist... pharmacist... physician, physician assistant..."*).

### Criterion 4 — Independent Review
All AI-generated drafts include source citations (PubMed, FDA, regulatory databases), plain-language reasoning summaries, pharmacist review interface before patient delivery, and exclusion of time-critical/emergency use cases.

**Important caveat**: When MedIT provides information directly to patients (as opposed to HCPs), the §520(o)(1)(E) Non-Device CDS exemption does not apply under the 2026 FDA guidance, which states: *"Software functions that support or provide recommendations to patients or caregivers – not HCPs – meet the definition of a device."*

MedIT addresses this by positioning licensed pharmacists as the primary user for clinical decision support functions, providing patient-facing content only as general information (FDA general wellness/educational policy), and excluding individualized diagnostic or treatment recommendations from patient-facing outputs.

---

## 5. International Regulatory Context

### United States
- **FD&C Act §520(o)** — Non-Device CDS exemption (21st Century Cures Act, 2016)
- **FDA CDS Guidance** (January 29, 2026 revision)
- **HIPAA** — applies to any entity processing US PHI, regardless of national origin
- **State pharmacy laws** — vary by state; MedIT does not engage US pharmacist-patient relationships

### European Union
- **MDR Rule 11** — software for diagnostic/therapeutic decisions defaults to Class IIa or higher
- **AI Act (Regulation 2024/1689)** — high-risk classification for medical device AI
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

MedIT does not currently process US Protected Health Information (PHI) and does not operate as a HIPAA-covered entity or business associate. The platform complies with Korea's Personal Information Protection Act (PIPA), applies GDPR Article 9 standards where applicable, would establish Business Associate Agreements (BAAs) before processing any US PHI through formal US healthcare partnerships, and uses encryption, access controls, and audit trails consistent with HIPAA Security Rule technical safeguards.

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

## 8. MedIT's Regulatory Engagement Approach

MedIT pursues responsible engagement through FDA public docket comments (e.g., on CDS guidance), Patient-Focused Drug Development (PFDD) participation, academic publication of underreporting patterns, industry association participation (Consumer Technology Association, digital health groups), and cross-border regulatory dialogue with MFDS, FDA, MHRA, PMDA.

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
- Pharmaceutical Affairs Act (Law No. 17208)
- Medical Service Act (Law No. 20670)
- Digital Medical Products Act (Law No. 20214)
- Personal Information Protection Act (Law No. 19234)

### US Law and Regulation
- 21st Century Cures Act (2016), P.L. 114-255
- FD&C Act §520(o) — Non-Device CDS
- FDA CDS Guidance (January 29, 2026), Docket FDA-2017-D-6569
- HIPAA — 45 CFR Parts 160 and 164
- FDA FAERS — fda.gov/drugs/surveillance/faers

### International
- EU MDR 2017/745, Annex VIII Rule 11
- EU AI Act, Regulation (EU) 2024/1689
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

**Operator notice**: MedIT is operated from the Republic of Korea by Hyun Jeong Shin (sole proprietor). Korea-licensed pharmacists provide professional consultation. No US pharmacist-patient relationship is formed.

**For US adverse event reporting**, contact FDA MedWatch: 1-800-FDA-1088 or fda.gov/medwatch.

---

**Contact**: hyunjeong.shin@sookmyung.ac.kr

**MedIT** — Medication Technology Platform · Pharmacist-Verified Information · Adverse Event Safety · Patient KAERS Self-Report Assistance

— End of Document —
