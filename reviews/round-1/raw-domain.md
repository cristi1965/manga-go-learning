# v15 Round 1 Domain Review

context_id: v15-r1-domain-fresh-20260825-a
role: independent AI-assisted Go / backend / Harness AI domain reviewer
status: closed
candidate_sha256: d5bfb31b56e88973ae941f93d67a66d94a34ac56f6899640be12d114fba7af8a
closure_scope: original three Round 1 issues only
hash_closure: final 312-page candidate
blockers_open: 0
remaining_findings: 0

| issue_id | severity | claim | artifact:page-or-location | evidence | required_fix | verification |
|---|---|---|---|---|---|---|
| v15-r1-dom-001 | P1 | The supplementary SSE handler was invalid Go and dropped the explicit unauthenticated guard used by the chapter's canonical handler. | PDF p180, p185-p186 | p180 and p185 both use `p, ok := PrincipalFrom(c)`, return `ErrUnauthorized` on `!ok`, and only then assign `ctx`, call `WatchBill`, and subscribe. The acceptance text still states that unauthenticated requests create zero subscriptions. | No further fix required for this issue. | **CLOSED** on final candidate `d5bfb3...af8a`: anchor-based PDF extraction confirms the two-result Principal guard remains before every authorization watch and subscription. |
| v15-r1-dom-002 | P1 | The cache code could not implement the chapter's required distinction between cache miss and Redis failure, allowing an outage to become silent database fall-through. | PDF p159-p165; code split p162-p163 | p162 still receives `entry, cacheErr`, permits DB fill only for `ErrCacheMiss`, and records/returns `CacheReadFault` plus `ErrCacheUnavailable` for other faults. p163 continues the same function through bounded DB fill, `CacheFillFault`, and the final return. | No further fix required for this issue. | **CLOSED** on final candidate `d5bfb3...af8a`: extracted p162-p163 and supplied final renders show the complete hit/miss/fault code at readable size, safely inside both page boundaries. |
| v15-r1-dom-003 | P2 | Settlement precedence was ambiguous when `sandbox.Run` returned both a trusted receipt and a non-nil local `runErr`, especially for a failure receipt without success-shaped output. | PDF p245-p248 | The decision contract remains on p245. The code on p246-p248 records `runErr` through `RecordRunDiagnostic`, validates output only for `OutcomeSucceeded`, uses `SettleFailed` for rejected/failed outcomes, and marks absent, invalid or unknown-outcome receipts unknown. | No further fix required for this issue. | **CLOSED** on final candidate `d5bfb3...af8a`: anchor-based extraction confirms the four requested paths and deterministic settle/unknown precedence are unchanged. |

## Residual Gaps

- `full-pdf-check-v15.json` is bound to the final SHA and reports 312 pages, 71/71 story units, 71/71 explanation units and 64/64 code blocks present, with no automated failures.
- The PDF is a teaching artifact rather than a runnable module. This review did not execute PostgreSQL/Redis/Broker fault injection, race/leak suites, lease/fence CAS, receipt reconciliation, sandbox isolation or Eval statistics end to end.
- This was a lightweight hash closure of the original three issues, using anchor-based PDF extraction and the supplied final cache renders. It was not a fresh search for unrelated domain defects.
