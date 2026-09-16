# v15 Round 1 Production Review

context id: `v15-r1-production-fresh-20260825-c`

Candidate: `work/book/v15-text-review/output/人间铸剑录_v15_完整图解版.pdf`  
SHA-256: `c8ec4dd3904daeb89e538ba996f881555ac67cbe0dc2c667a9c4f1e657b03086`  
Scope: independent AI-assisted PDF production review; no manuscript, build, or PDF changes.

Current Round 1 closure binding: `d5bfb31b56e88973ae941f93d67a66d94a34ac56f6899640be12d114fba7af8a` (`312` pages)  
blockers_open: `0`  
remaining_findings: `0`

## Findings

| issue_id | severity | claim | artifact:page-or-location | evidence | required_fix | verification |
|---|---|---|---|---|---|---|
| none | none | no findings | PDF:all 310 pages | All 16 contact sheets were visually inspected. No overlap, clipping, broken images, missing avatars, anomalous blank pages, illegible charts, or inconsistent page frames were observed. Original 144 DPI checks covered cover p1; character/portrait page p2; TOC pp3-5; volume openers pp7, 102, 221; longest dialogue p305; explanation p306; dense code pp162, 261, 307; both landscape diagrams pp10, 69; appendix p309; and final page p310. Text and diagrams remain sharp at reading scale, essential text has adequate contrast, dialogue bubbles and avatars stay within bounds, and code line numbers/comments/keywords remain distinguishable. Direct PDF inspection found 310 pages, 82 valid outline entries with 11 top-level entries, and 24 resolved internal TOC link annotations on pp3-5; first and last outline targets resolve to pp1 and 310. Bound preflight evidence reports no empty pages, replacement characters, placeholders, invalid bookmarks/links, missing/nonportable fonts, or missing story/explanation/code anchors. | none | Pass when the reviewed SHA remains unchanged and the cited pages/contact sheets reproduce the same rendering and PDF structure. |

## Residual Gaps

- Visual review used the supplied 144 DPI rasterization and contact sheets, not a second renderer, physical print proof, or 300 DPI press workflow. The layout contract explicitly defines this as a screen-reading edition.
- Link destinations and outline page targets were checked structurally; every TOC link was not manually clicked in multiple PDF viewer applications.
- Accessibility semantics were not in review scope; `pdfinfo` reports the PDF is untagged.
- Color and contrast were judged from rendered output on the current display path, without calibrated print/colorimetry measurements.

## Round 1 Closure

Closure candidate SHA-256: `bd86060c5a3c3e5bdaa771d5960bc757090c6c932165c0593602c17c9bdc482f`  
Closure candidate pages: `311`  
Closure verdict: **fail - 1 major production regression remains**.

| issue_id | severity | claim | artifact:page-or-location | evidence | required_fix | verification |
|---|---|---|---|---|---|---|
| PROD-R1-CLOSURE-001 | major | The expanded cache code page overflows the A4 page and clips the final source lines; the footer page number also overlaps the code area. | PDF:p162 | The supplied 144 DPI closure render visibly ends inside the code block after line 44, with no lower code-box boundary. Independent `pdfplumber` coordinates place line 44 at `top=836.6, bottom=846.6` and line 45 at `top=851.8, bottom=861.8` on a page whose MediaBox height is `841.9`; line 44 is partially outside the page and line 45 is fully outside it. The page number `162` occupies `top=812.1, bottom=821.1` inside the still-running code region. This violates the layout contract's no-clipping and complete-code requirements even though text extraction still sees the off-page operators. | Reflow this code skeleton across enough pages, or otherwise rebalance it without dropping below the 9.0 pt code minimum. Keep every source line and the complete code-box boundary inside the page safe area, with the footer separated from code. | Bind a new PDF SHA; render p162 and all newly shifted adjacent pages at 144 DPI; visually confirm the complete last line and lower code-box boundary; use word/text coordinates to show no code glyph exceeds the MediaBox or footer safe area; rerun full page, bookmark, TOC-link, font, anomaly, and code-anchor checks. |

Closure visual checks otherwise passed for p9, pp163, 184-185, 238, 245-247, and 299: updated explanation labels and code-reading hooks are legible; SSE and receipt code/highlighting remain clear; page transitions, avatars, panels, and footer spacing show no overlap or clipping.

Direct structure inspection of the closure candidate found 311 pages with only A4 portrait/landscape sizes, 82 outline entries (11 top-level) with no invalid targets, 24 resolved internal TOC links on pp3-5, and no empty-text pages. The bound full-PDF check reports no empty pages, replacement characters, placeholders, invalid bookmarks/links, missing or nonportable fonts, or missing story/explanation/code anchors. These structural passes do not waive `PROD-R1-CLOSURE-001`, because extractable off-page text is still visually clipped.

## Round 1 Final Closure

Final candidate SHA-256: `d5bfb31b56e88973ae941f93d67a66d94a34ac56f6899640be12d114fba7af8a`  
Final candidate pages: `312`  
Final verdict: **pass**  
blockers_open: `0`  
remaining_findings: `0`

`PROD-R1-CLOSURE-001` is resolved. The cache code overflow and footer collision were fixed by a safe two-page split on pp162-163. The SHA-bound target renders show p162 labeled `代码完整展开 1/2` with lines 01-32 and a complete lower code-box boundary, and p163 labeled `代码完整展开 2/2` with lines 33-45, including the final brace. Both pages retain the original readable code size and syntax highlighting. Independent coordinates place the lowest non-footer text at `bottom=738.2` on both pages, while the page numbers occupy `top=812.1, bottom=821.1`; no body word starts below 800 pt, leaving about 74 pt between body content and footer.

No remaining findings were observed on pp164, 260, or 263, or in the final structural checks. Page 164 follows the split with an intact validation page; pp260 and 263 preserve explanation/code layout after page shifts. All three show complete panels or code boxes, clear text/highlighting, and page numbers separated from content. Their lowest non-footer text bottoms are `576.4`, `531.1`, and `725.0` respectively, with footers at `812.1-821.1`; no clipping, overlap, or footer intrusion was observed.

Direct PDF inspection confirms 312 pages, only A4 portrait/landscape sizes, 82 outline entries with 11 top-level entries and no invalid targets, 24 resolved internal TOC links on pp3-5, and no empty-text pages. Bound full-PDF evidence reports no text anomalies, font portability failures, or missing story/explanation/code anchors. The final closure remains bound to SHA `d5bfb31b56e88973ae941f93d67a66d94a34ac56f6899640be12d114fba7af8a`.
