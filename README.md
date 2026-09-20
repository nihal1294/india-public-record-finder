# India Public Record Finder

India Public Record Finder is an independent, Karnataka-first prototype for
helping a person find a possible match in a fictional historical roll and
verify the source before deciding. It does not determine identity, voter
registration, or eligibility.

- [Try the live synthetic demo](https://nihaliddya--india-public-record-finder-web.modal.run/)
- [Watch the two-minute demonstration](https://drive.google.com/file/d/1XW1h0NIwHuy3ux70VTRoE2Cdg3RFMCwF/view?usp=drive_link)

## Why this exists

Scanned historical rolls can be difficult to navigate when a name appears in a
different script or spelling, a relative or locality is the useful clue, and
the document structure is unfamiliar. This prototype asks for one focused
search, surfaces possible matches, shows why they appeared, and keeps source
evidence beside the result. It preserves uncertainty rather than presenting
retrieval as an official conclusion.

The interaction design was informed by private family research; no family data
or real electoral-roll record is included in this demo.

## Privacy-conscious access

Individual public inspection and machine-scale discovery are different access
models. Karnataka CEO archival roll PDFs use structured paths identifying a
district, assembly constituency, and part. Predictable online distribution can
lower automation and correlation barriers. That observation is not an
allegation of illegality, completeness, or wrongdoing.

This independent prototype explores a purpose-limited alternative: guide a
specific request and let the person verify evidence. The fictional judge
explorer exists only to test the demo. It must never become browse-all access
for real people. The [Karnataka Chief Electoral Officer website](https://ceo.karnataka.gov.in/)
is linked as official context only, not as an integration or endorsement.

## Current synthetic Karnataka demo

The only working profile is a Karnataka-shaped SIR journey containing exactly
120 fictional records, synthetic PDFs, and synthetic source crops. A person can
enter a name in Kannada or English, optionally add a relative, locality, or age
in the roll year, inspect possible matches, and check the synthetic source
reference.

The service uses pre-indexed, self-hosted hybrid retrieval: Kannada and Latin
aliases, typo-tolerant lexical retrieval, a self-hosted multilingual embedding
model, and deterministic field-aware scoring. A result is always a possible
match, never an official identity, registration, or eligibility decision.

At runtime, a citizen query is not sent to an LLM, web-search provider,
third-party embedding provider, analytics service, OCR or indexing pipeline,
or live government system. The browser does not put a query in its URL,
`localStorage`, or `sessionStorage`; the documented API responses do not set
cookies. Do not enter real personal information.

### What the benchmark establishes

The [180-query synthetic benchmark](benchmarks/reports/demo-v1.json) compares
hybrid retrieval with lexical retrieval. On 30 Romanized-name queries, the
expected record ranks first in 22 hybrid results versus 24 lexical results.
On 30 typo queries, those counts are 15 versus 12. Both methods place the
expected record in the first five results for every positive test query.
Embeddings therefore help some queries and hurt others; this small fictional
dataset does not establish accuracy on real voter rolls or other languages.

### Judge test bench

`/demo-data` is a synthetic, demo-only judge test bench. It lists only the 120
fictional records so reviewers can choose a non-curated sample. Selecting
`Use this sample` pre-fills the form and waits for the explicit `Find possible
matches` submission. It is not a real-person directory and must not be carried
into a production service as browse-all access.

## Architecture and privacy boundaries

- `src/record_finder/` contains the read-only API, hybrid retrieval, immutable
  synthetic-snapshot validation, and offline build tools.
- `apps/web/` contains the guided React browser application. It supports the
  search route and the synthetic judge route without putting a search in the
  URL.
- `data/synthetic/demo-v1/` contains the immutable fictional demo snapshot.
  `models/manifest.json` pins the self-hosted multilingual retrieval model.
- The runtime validates the snapshot, serves read-only search, record,
  evidence, example, readiness, and synthetic-catalog routes, and displays
  evidence for a person to inspect. It does not offer uploads, accounts,
  citizen-triggered OCR or indexing, or a live authority integration.
- Any future personal or restricted-record journey must keep authentication,
  consent, and final delivery with the responsible authority.

The synthetic catalog route is `GET /api/demo/records`. It is manifest-bound,
returns the 120 fictional records in fixed order, is GET-only, and sends a
`no-store` response. The other runtime routes are `POST /api/search`, `GET
/api/records/{synthetic_id}`, `GET /api/evidence/{evidence_id}`, `GET
/api/examples`, and `GET /healthz`.

## Future adapters across Indian public records

SIR is one validated Karnataka demonstration, not a nationwide people-search
mirror. The reusable idea is a multilingual, evidence-first adapter pattern:
help a person understand an authority's identifiers and language, reach an
official source, and preserve that source's access and privacy boundaries.
None of the adapters below works today.

| Primary access mode | Representative future journeys | Boundary |
| --- | --- | --- |
| Public-source navigation | [eGazette](https://egazette.gov.in/) and [India Code](https://indiacode.gov.in/), [RERA authorities](https://www.mohua.gov.in/documents/acts-and-policies/rera-YDM4EzMtQWa?pageTitle=Real-Estate-%28Regulation-and-Development%29-Act%2C-2016-%5BRERA%5D), [PARIVESH](https://parivesh.nic.in/), parliamentary material, archives, and reference-led [eCourts](https://services.ecourts.gov.in/) case and order routes | Cite the official item and preserve its date, jurisdiction, and language. Court navigation starts from CNR or a supplied reference, retains CAPTCHA and authority controls, and never creates a party-name corpus or profiles litigants. |
| Citizen-authorized and authority-managed retrieval | Civil and e-District certificates, benefits, municipal workflows, education, transport, and RTI | Personal or restricted records stay within the responsible authority's own access, consent, and delivery process. |

Each adapter needs separate validation of its source authority, jurisdiction,
access rules, identifiers, language and OCR needs, freshness, evidence, and
privacy contract. Where an authority requires CAPTCHA, payment, login, OTP,
eKYC, consent, or a supplied reference, the adapter preserves that boundary and
hands the person back to the authority. Public availability is not permission
to aggregate people or documents into a new central database.

Land/property spans both access modes: some [official land and property
services](https://dolr.gov.in/en/citizen-centric-services/) expose public
metadata, while registration, mutation, certified copies, payment, identity
proof, and delivery remain authority-managed. A future adapter would guide
jurisdiction, identifiers, and vocabulary - never create an owner-name index,
title decision, or national parcel mirror.

The bounded sequence after this demo is: central eGazette and India Code first,
Karnataka RERA second, and a land/property jurisdiction-and-identifier
navigator third. Environmental approvals are the next public-source candidate.
Court discovery follows only after a reference-first privacy and legal-accuracy
design is validated. The [Department of Land Resources transliteration
initiative](https://dolr.gov.in/en/transliteration/) is context for the
multilingual land-record challenge, not evidence of universal language support.

## Setup and validation

Python uses CPython 3.14 and uv. Node uses pnpm. Fetch the model to an
operator-controlled cache outside the repository, then use it for the live
service:

```bash
uv run python scripts/fetch_models.py multilingual_e5_small \
  --destination /path/to/model-cache --manifest models/manifest.json
pnpm web:build
uv run record-finder serve \
  --snapshot data/synthetic/demo-v1/manifest.json \
  --model-cache /path/to/model-cache \
  --model-manifest models/manifest.json \
  --web-root apps/web/dist
```

Validate the repository with:

```bash
uv run pytest -q
uv run ruff check src tests
uv run mypy src
pnpm web:test
pnpm web:build
pnpm e2e
```

For a judge walkthrough, open `/`, try the four fictional examples - `Exact
Kannada`, `Romanized spelling variation`, `Needs refinement`, and `No confident
match` - and verify the synthetic crop after a possible match. Then open
`/demo-data`, choose a fictional sample, and explicitly submit the pre-filled
form. The sample does not search automatically.

## Container and deployment smoke checks

The `Dockerfile` builds the browser application with Node 24 and packages it
with the CPython 3.14 service, fictional snapshot, and pinned model. It runs as
a non-root user and starts the read-only `record-finder serve` entrypoint.

```bash
docker build -t india-public-record-finder .
docker run --rm -p 8080:8080 india-public-record-finder
```

The Modal driver builds that Dockerfile as a remote image. Deployment changes
public traffic, so run it only from an approved immutable release tree with an
approved full commit SHA:

```bash
uv run --group deploy modal deploy deploy/modal_app.py \
  --name india-public-record-finder --strategy rolling --tag <full-commit-sha>
RECORD_FINDER_DEPLOYED_BASE_URL=https://example.modal.run pnpm e2e:deployed
```

The browser smoke command requires a clean public HTTPS origin. It does not
start a local server and exercises the release journey against that origin.

## Contribution principles

Contributions preserve the synthetic-only boundary, add focused tests for
observable behavior, and pass the relevant validation commands.
