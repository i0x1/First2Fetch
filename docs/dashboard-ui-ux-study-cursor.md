# Dashboard UI/UX Study — Revised Direction

**Product goal:** Move through jobs fast — see more listings, read clearly, act quickly — **without removing features you already rely on daily.**

**Core principle (updated):** The current app was built for a personalized power-user workflow. Icons, quick actions, company/source logos, search provenance, and full settings are **intentional**. The redesign **optimizes layout and readability** on top of those features — it does not hide them behind menus or strip them for minimalism.

**Review scope:** Jobs, Searches, Smart Filters, Status, Feedback, Settings, Help — `apps/desktopProbe`.

**Companion mock:** [`dashboard-ui-ux-mock-cursor.html`](./dashboard-ui-ux-mock-cursor.html)

---

## Design principles

1. **Retain daily tools** — archive, copy URL, copy JD, delete, favorite, block, label, notes, keyboard shortcuts, bulk tab actions, hover row actions.
2. **Optimize density** — shorter rows, better typography/grid for metadata, more jobs visible — not fewer controls.
3. **Icon-first nav** — narrow icon-only sidebar by default; optional expand for labels.
4. **Show identity fast** — company logo + job-board source logo on every list row.
5. **Show context fast** — company, location, times, and **which saved search** the job came from.
6. **Color palette** — **one combined look**, not three separate themes: **white** surfaces, **orange** for actions/active states, **dark blue** for sidebar and headings. Optional **Night** toggle darkens panels only; orange + blue accents stay.
7. **Smart Filters stay scannable** — separate searchable lists with logical rules (blocked ≠ watch/favorite).
8. **AI API keys live in Settings** — Smart Filters page is for rules and company preferences only.

---

## Jobs (Home)

1. **Issue:** Job cards are tall (large padding, footer band, heavy rounding) — only ~3–4 jobs fit on screen.
   **Solution:** **Tabular job board** — fixed column headers (Job/company · Location · Found · Posted · Search · flags · actions). Rows ~34px tall; **12+ jobs** visible without scrolling. Compact logos in first column. Optional card view later for mobile only.

2. **Issue:** List/detail split (`40% / 60%`) limits how many jobs you see while reviewing.
   **Solution:** Default **List Focus** (~65% list / ~35% detail). Optional **Split** and **Detail Focus** toggles — remember choice. Detail pane caps width for JD readability; list uses freed space.

3. **Issue:** Duplicate date UI (jump chips + collapsible headers) eats vertical space.
   **Solution:** Keep **date jump chips** (you use them) but make them slimmer. Sticky date headers stay plain text (`Today · 18`). Hide jump bar only when a single date group is visible.

4. **Issue:** Company, location, time, and search title read as one flat dot-separated line — hard to scan quickly.
   **Solution:** **Two-line metadata grid** per row:
   - Line 1: **Title** (semibold)
   - Line 2: `[company logo] Company` · `Location` · `found 12m` · `posted 2h` (posted optional/tooltip)
   - Line 3 (muted, single line): `[source logo] via {Search Title}` — restore the saved-search label from `link.title`

5. **Issue:** Company identity relies on text only; source is small at the bottom.
   **Solution:** **Dual avatars** at row start: company logo (or initials fallback) + tiny source/board logo stacked or side-by-side. Same logos in detail header.

6. **Issue:** Detail action bar was proposed to collapse into a “More” menu — that conflicts with daily icon workflow.
   **Solution:** **Keep all icon actions visible** in the detail bar: Open (primary button), Applied, Archive, Copy URL, Copy JD, Delete, Favorite, Block, Label selector. Optimize spacing (consistent 36px icon buttons, single wrapped row). Add tooltips + keyboard hints — do not demote to menu.

7. **Issue:** List-row hover actions (archive, delete) are valuable for speed.
   **Solution:** **Keep row hover icons** (archive, delete). Optionally add copy-on-hover if space allows. Show on hover to avoid clutter, not removed.

8. **Issue:** Favorite heart on one button cycles watch → favorite → remove — confusing.
   **Solution:** Keep **separate icons** in detail (heart favorite, eye/watch badge on list, block icon). List shows rose heart for favorite company, blue indicator for watched — retain current semantics with clearer tooltips.

9. **Issue:** Job Notes push description down.
   **Solution:** **Keep notes** (you use them). Place **below** JD in a collapsible section defaulting to **collapsed when empty**, expanded when notes exist — not removed.

10. **Issue:** Active filters hidden behind filter icon only.
    **Solution:** **Add removable filter chips** under search *in addition to* the filter menu — do not replace the menu.

11. **Issue:** Status tab label “Filtered out” is long and technical.
    **Solution:** Rename display label to **“Skipped”**; keep backend status unchanged. Retain tab counts and tab ⋮ bulk menu (refresh, export, archive all, delete all).

12. **Issue:** Keyboard shortcuts missing Open / Applied; `Cmd+A` conflicts with Select All.
    **Solution:** Add **Enter → Open**, **A → Applied**. Change archive to **E** (document in Help + footer hint). Keep ↑↓ jobs, ←→ tabs, delete shortcut with confirm.

13. **Issue:** Empty states use large SVGs and long copy.
    **Solution:** Short copy + one action button. **Optional** small illustration — not full-panel.

14. **Issue:** Per-date “Load more” slows bulk review.
    **Solution:** **Auto-load** when scrolling near bottom of expanded date; keep manual button as fallback.

15. **Issue:** JD fetch blocks perceived speed.
    **Solution:** List stays interactive; detail shows thin progress + **Open listing anyway** link. Do not block ↑↓ navigation.

---

## Navigation & Shell

16. **Issue:** Sidebar labels only at `2xl` — but you prefer **icon-only** to save space.
    **Solution:** **Default icon-only** sidebar (~56px). Tooltips on hover. Optional **expand pin** for labels when needed. New-jobs **badge on Jobs icon**.

17. **Issue:** Flat nav mixes work and support items.
    **Solution:** Light grouping (Work / System / Support) **without removing items**. Keep Status and Feedback accessible — Feedback can also live in Help footer as duplicate entry.

18. **Issue:** Product name inconsistency (First 2 Apply vs First 2 Fetch).
    **Solution:** Standardize on **First2Fetch** in nav and docs.

19. **Issue:** Scan status scattered (logo spinner, Status page, Searches subtitle).
    **Solution:** **One scan strip** on Jobs: Scanning / Next scan / Last found — link to Status. Keep Status page for depth.

20. **Issue:** Theme is only light/dark toggle; prior mock used three separate “modes” (pick White OR Orange OR Dark).
    **Solution:** **One combined accent palette** used together: **white** surfaces (background, cards), **orange** for primary actions / active tabs / badges / selection accent, **dark blue** for sidebar, headings, and key text. Optional **Night** toggle darkens content panels only — orange + blue accents stay. Do not swap entire themes.

---

## Searches (`/links`)

21. **Issue:** Card grid hides columns — checked time, added time, board, job count hard to compare.
    **Solution:** **Table layout** with always-visible columns: **Board** (logo) · **Search title** · **Checked** · **Added** · **Jobs found** · **Status** · **Actions** (Test, Edit, Copy, Delete — always visible, not hover-only).

22. **Issue:** Whole card click for Test/Retry is unclear.
    **Solution:** Row click selects/highlights; **Test** button is explicit primary action per row.

23. **Issue:** Page title “Job Searches” vs nav “Searches”.
    **Solution:** Use **“Searches”** everywhere.

24. **Issue:** Add-search modal uses badge-like job boards.
    **Solution:** List rows: logo · name · **Start** button. Save dialog: **Basic** default, **Advanced URL** secondary tab.

25. **Issue:** Onboarding is marketing-heavy.
    **Solution:** **3-step checklist** (Add search → Scan → Review jobs) — keep CTA buttons, shorten prose.

---

## Smart Filters (`/filters`)

26. **Issue:** Three names for one feature (AI Filters / Advanced Matching / Smart Filters).
    **Solution:** Nav + page title: **Smart Filters**. Help can say “smart job filters.”

27. **Issue:** Prior proposal hid everything in tabs and a checkbox matrix (Watch + Favorite + Block) — illogical because **blocked companies must not appear in watch/favorite**.
    **Solution:** **Three separate searchable sections** on one scroll (fast access, no extra clicks):
    - **Filter prompt** (textarea, char count)
    - **Blocked companies** — search + add + badge list (remove moves off block list)
    - **Favorite companies** — search + add + badge list
    - **Watched companies** — search + add + badge list + short explainer
    Rules: adding to **Block** removes from Favorite/Watched automatically (existing API behavior). No multi-checkbox row per company.

28. **Issue:** AI provider keys on Filters page clutter the rules workflow.
    **Solution:** **Move AI Setup to Settings** (new “AI & API keys” section). Filters page keeps Import/Export + Save at bottom.

29. **Issue:** Save at bottom after long scroll.
    **Solution:** **Sticky Save** when dirty + toast on success. Keep upgrade dialog for non-PRO after save.

---

## Settings (`/settings`)

30. **Issue:** Mock removed several real settings controls.
    **Solution:** **Restore all existing settings** from current app:
    - App update banner
    - Subscription card (tier, trial, manage portal)
    - Job scraping pause/play
    - **Cron schedule** (`CronSchedule` component — notification frequency)
    - **LinkedIn scan interval** (minutes input — keep; add optional preset dropdown helper, do not remove raw input)
    - In-app browser toggle
    - Prevent sleep toggle
    - Sound effects toggle
    - Email alerts toggle
    - Sign out + signed-in email

31. **Issue:** AI keys were on Filters page.
    **Solution:** Add **AI & API keys** section here (providers, models, validate keys) — moved from Filters.

32. **Issue:** Scan health only on Status page.
    **Solution:** One-line under Job scraping: **Running · Next scan in Xm** → link Status.

---

## Status, Help, Feedback

33. **Status:** Keep page. Add plain-language summary cards at top; **collapse** raw logs/IDs under “Technical details.” Do not remove Status from nav.

34. **Help:** Keep FAQ accordion; add **Open Searches / Smart Filters / Settings** buttons in answers. Sync keyboard list with Jobs footer.

35. **Feedback:** Keep nav entry **or** Help footer link — your choice; mock shows both paths. Full form (rating, title, body) unchanged.

---

## Visual system

36. **Issue:** Heavy card shadows and `rounded-2xl` on job rows reduce scan density.
    **Solution:** **Flatter list rows** (6–8px radius), selected row = **left accent bar + light tint** (keep hover actions). Cards OK for settings/modals.

37. **Issue:** JD markdown spacing is loose.
    **Solution:** Slightly tighter `job-description-md` line spacing; optional “Collapse requirements” for long bullet lists (future).

38. **Issue:** Wide monitors under-use horizontal space.
    **Solution:** List Focus lets list grow; detail max ~640px for JD column.

---

## Implementation phases

| Phase | Focus | Items |
|-------|--------|-------|
| **1** | Denser, richer job list | 1, 2, 4, 5, 7, 10, 14, 15 |
| **2** | Keep power-user actions | 6, 8, 11, 12, 9 |
| **3** | Searches table + Filters logic | 21–22, 27–28 |
| **4** | Settings complete + AI move | 30–31 |
| **5** | Themes + nav | 16, 20, 36 |

---

## Target daily flow

1. Open app → **icon nav** → Jobs with **compact rows** (logos + search title + times).
2. **↑↓** through jobs; hover icons or detail icons for archive/copy/delete/fav/block.
3. **Enter** open · **A** applied · **E** archive — all icons still one click away.
4. Glance scan strip; open Status only when debugging.
5. Searches in **table**; Smart Filters in **searchable lists**; AI keys in **Settings**.

---

---

## Mock QA — bugs found in browser review (fixed in mock v3)

1. **Job row text overlap** — “via {search}” and metadata stacked on top of each other on narrow rows.
   **Fix:** Structured meta grid (company · location on one row; found · posted on second); search title on its own line with source badge.

2. **Sidebar footer overlapped job list** — absolute-positioned theme buttons floated over content.
   **Fix:** Sidebar uses flex column; footer pinned with `margin-top: auto`, not absolute.

3. **Detail panel missing at common widths** — grid collapsed to one column too early; detail panel below the fold.
   **Fix:** Keep list + detail side-by-side down to ~720px; only stack on phone widths.

4. **Searches table clipped** — Status / Actions columns cut off on the right.
   **Fix:** Horizontal scroll wrapper + `min-width` on table; compact action buttons.

5. **Wrong nav/action symbols** — same `⌂` icon for Jobs nav and Archive action.
   **Fix:** Distinct icons (briefcase/home for Jobs, box/archive for archive); no emoji in action bar.

6. **Grayscale mock** — did not reflect white + orange + dark blue combination.
   **Fix:** Dark blue sidebar, orange CTAs/active states, white content area (see item 20).

7. **Weak / emoji icons** — nav and actions used emoji or letter glyphs; hard to read at small size.
   **Fix:** Stroke SVG icons (Radix-style) for nav, row actions, and detail bar. Row actions always visible in last column.

8. **Wasted vertical space** — large padding, tall cards, sparse header chrome.
   **Fix:** Tighter shell padding, tabular rows, sticky column headers, more jobs in mock data to prove density.

9. **Oversized secondary tabs** — Settings, Filters, Searches used tall cards, big buttons, and subtitle fluff.
   **Fix:** Compact **key-value tables** and **2-column grids**; label left / control right on one line (~30px rows); icon-only search actions; small toggles; hide redundant subtitles on utility pages.

---

*Revised June 2026 after product-owner feedback. Prior version over-stripped daily features; this doc optimizes around them.*
