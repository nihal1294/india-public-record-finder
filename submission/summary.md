# India Public Record Finder

Exact spellings and long collections of PDFs make public-record search difficult
to navigate. India Public Record Finder is a Karnataka-first, evidence-first
guided search: it helps a person find possible matches, compare the fields that
surfaced them, and inspect the source before deciding. Keeping the source crop
beside a candidate makes uncertainty visible instead of turning retrieval into
an official conclusion.

The demo uses a deterministic, entirely fictional historical-roll snapshot. It
does not use government records, does not determine registration or eligibility,
and asks visitors to use the built-in fictional examples rather than real
personal information.

Search combines Kannada and Latin aliases, typo-tolerant lexical retrieval, and
a self-hosted multilingual embedding model. The final match state comes from
deterministic field-aware scoring; no citizen query is sent to an LLM or
third-party embedding provider. Source crops are shown for verification, not
treated as an automated official determination.

Karnataka is the first adapter. The same pattern can support other published
public-record systems only when their schemas, access rules, language needs,
and verification requirements are evaluated independently.
