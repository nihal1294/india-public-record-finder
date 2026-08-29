# India Public Record Finder

India Public Record Finder is an independent Karnataka prototype for
finding a historical record when names, scripts, spellings, relatives,
localities, and document structure vary. Its validated SIR proof is
fictional: it guides one search, returns possible matches, and shows source
evidence for verification. It never makes an official
decision about identity, voter registration, or eligibility.

The demo contains exactly 120 fictional Karnataka records, synthetic PDFs, and
synthetic source crops. Kannada and English input use pre-indexed, self-hosted
hybrid retrieval, aliases, typo tolerance, and deterministic field-aware
scoring. No runtime query is sent to an LLM, web-search provider,
third-party embedding provider, analytics service, OCR or indexing pipeline, or
live government system. The browser keeps searches out of URLs, localStorage,
and sessionStorage; API responses do not set cookies.

A judge-only synthetic test bench lets reviewers choose a sample. It
pre-fills the search and waits for explicit submission. Browse-all access for
real people would violate the privacy design. The interaction design was
informed by private family research; no family data or real electoral-roll
record is included in this demo.

SIR is the Karnataka proof for a reusable multilingual,
evidence-first adapter pattern. Future work has two access modes:
public-source navigation for official gazettes, laws, RERA, environmental
approvals, archives, and reference-led court material; and
citizen-authorized, authority-managed retrieval for certificates, benefits,
municipal services, education, transport, and RTI. Land/property can span
public metadata and authority-managed workflows. Each needs validation for
authority, access, privacy, language, accuracy, and provenance. None works
today.
