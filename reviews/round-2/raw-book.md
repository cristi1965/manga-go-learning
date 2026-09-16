context_id: v15-r2-book-blind-20260825-e

# Round 2 Blind Book / Editorial / Pedagogy Review

candidate: `/Users/jingxin/Documents/Codex/2026-08-04/yan/work/book/v15-text-review/output/人间铸剑录_v15_完整图解版.pdf`

candidate_sha256: `72cee1f84143f3da139e284a14563967c2038fbbe7e2d83c395d5fe1182ded9e`

candidate_page_count: `314`

blockers_open: `0`

remaining_findings: `0`

## Review Position

The initial review was an independent blind pass; no prior-round review report or summary was read. This closure pass inspected only the three recorded findings against the final 314-page candidate. The ELI5/light-novel/comic-dialogue format is treated as a deliberate teaching choice, not as a defect. The fixed accident -> dialogue -> intuition -> technical truth -> code -> exercise scaffold usually helps a beginner know where they are.

The whole-book progression is strong: chapters 1-8 build Go boundaries, 9-16 carry the same `bill-0827` through backend reliability, and 17-24 reuse that object to teach controlled Harness execution. Volume breaks are clear, chapter endings normally create the next chapter's problem, and the `bill-0827` / `req-0827` / `CallID` callbacks preserve continuity. Dialogue is concise, women characters ask substantive boundary questions rather than merely agreeing, and humor generally releases tension without replacing the corrective action.

| issue_id | severity | claim | artifact:page-or-location | evidence | required_fix | verification | status |
|---|---|---|---|---|---|---|---|
| R2B-01 | medium | Chapter 18 originally promised to teach the side-effecting Tool contract but showed only a non-writing draft Tool. | final candidate PDF: pp. 229-237 | Page 229 now states the paired-contract objective. Page 230 gives schema-specific reading guidance for `name`, `sideEffect`, `requiresApproval`, schema refs, contract digest, and Harness-owned `CallID`. Page 235 states the machine-readable contract boundary. Page 237 visibly presents both `create_bill_draft` (`sideEffect: none`, no approval) and `ledger.create_bill` (`sideEffect: write`, approval required, `harness_call_id` idempotency source), followed by an exercise using those exact fields. | Completed: the read-only/write contrast, approval requirement, stable idempotency identity, and input/output contract refs are now taught in one adjacent sequence. | CLOSED: a reader can determine write capability, approval need, and retry identity from the displayed contracts alone; the rendered page is complete and legible. | CLOSED |
| R2B-02 | medium | Chapter 19 originally introduced Run/Step with jargon instead of an everyday analogy and incorrectly asked readers to inspect fields on scalar `Fence`. | final candidate PDF: pp. 240-242 | Page 240 now uses an everyday courier-box analogy: Run is the whole trip, Step a handoff, CallID the unchanging seal, AttemptID the current carrier badge, and Unknown a missing-carrier state awaiting the original receipt. The reading guide explicitly says `Fence` is a fieldless monotonic `uint64` named type and directs field inspection to `Run`, `Step`, `Attempt`, and `Approval`. Pages 241-242 repeat and show the same scalar definition. | Completed: the first handoff is concrete before terminology, and the code-reading anchor now matches the adjacent types. | CLOSED: the analogy supports ordinary-language paraphrase, and every field-reading instruction refers to actual structs while `Fence` is correctly described as a scalar. | CLOSED |
| R2B-03 | medium | Three capstone design exercises originally worded diagrams as proof of runtime behavior. | final candidate PDF: pp. 243, 278, 308 | Page 243 limits acceptance to what a design review checks and says implementation still requires concurrency/crash tests. Page 278 says the diagram review “不等于实现已通过”. Page 308 limits the sequence diagram to explicit design properties and says implementation still requires unique-constraint and fault testing. All three distinctions are visible in the rendered pages. | Completed: the exercises remain useful design checklists while no longer claiming to verify implementation behavior. | CLOSED: each affected acceptance gate now explicitly distinguishes represented design properties from runtime evidence still requiring tests. | CLOSED |

## Editorial Assessment

The recurring template does not generally harm learning; it creates reliable rhythm over a long technical book. The two identified template mismatches are now adapted to their artifacts on pages 230 and 240. The analogy-to-technical handoff is disciplined: analogies do not invent APIs or consistency promises, and the “拆去比喻” sections restore precise boundaries.

Terminology load is mostly staged well through the Go and backend volumes. The former Run/Step spike is now preceded by a familiar physical story that maps each identity to one object or role. Later repetition of `tenant`, `owner`, `Unknown`, `receipt`, and `CallID` remains productive because the same identities are exercised in different failure modes.

## Residual Gaps

Closure verification extracted the final PDF text page by page and rendered pages 230, 237, 240, 243, 278, and 308 at 144 DPI. This targeted pass did not repeat the initial whole-book editorial review or perform a pixel-level production audit of every one of the 314 pages. No companion lab repository was executed; the affected design exercises now explicitly preserve that limitation. No external domain fact-check was performed.
