# Enterprise Go + AI Learning Specification

## Goal

Turn the current reference-heavy interactive book into a continuous, project-based course. A learner should progress from Go syntax to a controllable AI service by changing, running, testing, and explaining one system rather than reading disconnected supplement pages.

## Product contract

- The primary path stays at 24 chapters. Supplements are optional depth, not a second hidden curriculum.
- Chapters 9-24 incrementally build one `ledger-agent` service.
- Each learning stage has one visible job: Understand, Build, Prove.
- Switching stage moves focus to that stage and does not leave earlier long-form content in the way.
- A unit is complete only when its required quiz, engineering decision, and runnable evidence pass.
- Progress separately reports main chapters, project milestones, and review debt.
- Continue restores the exact unit and stage.
- Previous and next follow the flattened learning order, including supplements.

## Enterprise project contract

The local `ledger-agent` lab must demonstrate these boundaries without external credentials:

1. HTTP request validation and stable error responses.
2. Tenant isolation and idempotent run creation.
3. A replaceable model provider with timeout and strict structured output.
4. A server-owned tool registry with argument and workspace validation.
5. Run/Step state transitions, cancellation, lease and fencing behavior.
6. Event streaming with ordered event IDs and replay.
7. Structured audit records without raw sensitive input.
8. Fixed evaluation cases covering valid, malformed, timeout and hostile inputs.

The bundled provider is deterministic and local. It proves the application boundary, not the quality or availability of a commercial model.

## Learning unit contract

Every Go-to-AI project milestone includes:

- a concrete incident;
- one engineering decision;
- a small relevant code excerpt;
- a project test to run;
- a learner-edited Go challenge whose starter fails and whose fixed tests bind a run proof;
- a production seam that replaces the tagged reference helper inside a temporary copy of `ledger-agent`;
- a failure case;
- an observable acceptance result;
- a near-miss quiz specific to that milestone.

Generic questions such as “what failure does this page solve” are prohibited.

## Acceptance

- Every rendered unit has the complete UI data contract.
- Home statistics equal the data-derived chapter and supplement totals.
- Opening any unit causes no page or console error.
- Build/Prove stage enters the viewport and receives focus.
- Supplement completion survives reload.
- Project completion requires quiz, learner-code proof, and the matching project-test proof; local storage alone is never accepted.
- The project-test proof is bound to the same learner submission digest, so proofs from other code or units cannot be combined.
- Wrong or empty submissions must fail while compiling or running the real named `TestMilestoneNN` test; the reference implementation is excluded with a learner build tag.
- Brand navigation returns to the welcome screen.
- Continue restores unit and stage.
- Project milestones are adjacent in previous/next navigation.
- `ledger-agent` tests pass normally and under `-race`.
- The browser audit covers dynamic unit counts at desktop and mobile widths.

## Explicit limits

- Local tests use a deterministic fake provider; they do not prove real-provider SLAs.
- The first implementation uses a repository abstraction with durable semantics tested in-process. Production Postgres, OpenTelemetry collector and container deployment remain deployment exercises until their integration evidence exists.
- The UI must not label an unverified concept snippet as runnable or enterprise-complete.
- Milestone completion proves that the learner-authored boundary implementation compiled inside the real multi-file project and passed its matching integration gate. It does not claim that the learner rewrote unrelated project files.
