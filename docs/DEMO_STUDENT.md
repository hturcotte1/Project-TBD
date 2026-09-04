# Demo Student (canonical fixture)

The seed (`packages/shared/src/seed`) and the mock Common App site (`packages/browser/src/mock`) must describe the same student so that a sync against the mock site reconciles cleanly with the seeded rows. Today's date for the demo is treated as **2026-09-04** (the app itself uses the real clock).

## Identity
- Name: Dee Demo (preferred "Dee"); email `demo@example.com`; auth id `dev:demo`
- Phone `+15555550100`; Lincoln High School (Chicago, IL); graduating 2027; timezone `America/Chicago`
- Quiet hours 22:00–07:00; nudge intensity `normal`; onboarding complete
- Common App login email: `demo@example.com`, password `demo-password` (mock site only)

## Academics
- GPA 3.82 unweighted / 4.31 weighted (4.0 / 5.0 scale); rank 41 / 512
- Rigor: 7 AP by graduation. Senior courses: AP Literature, AP Physics C, AP Statistics, AP Gov, Spanish 5, Jazz Band
- SAT 1450 (720 EBRW / 730 M, 2026-06-06); AP: World History 5 (2025), US History 4 (2026), Calc AB 4 (2026), Lang 5 (2026)
- Test stance: `submit_selectively`

## Activities (6 entered on Common App out of 8 in the profile)
1. `journalism_publication` — Editor-in-Chief, The Lincoln Log (school paper). 150-char description. Grades 10,11,12. school_year. 8 h/wk, 36 wk/yr. continue: yes
2. `music_instrumental` — Lead trumpet, Jazz Band. Grades 9-12. all_year. 5 h/wk, 40 wk/yr
3. `work_paid` — Line cook, Rosa's Taqueria. Grades 11,12. all_year. 12 h/wk, 48 wk/yr
4. `community_service` — Tutor, Boys & Girls Club. Grades 10-12. school_year. 3 h/wk, 30 wk/yr
5. `family_responsibilities` — Childcare for two younger siblings. Grades 9-12. all_year. 10 h/wk, 50 wk/yr
6. `debate_speech` — Varsity, Lincoln Debate. Grades 9-11. school_year. 6 h/wk, 28 wk/yr
7. `research` — Summer research assistant, UIC chemistry lab (profile only; NOT yet on Common App)
8. `student_government` — Junior class treasurer (profile only; NOT yet on Common App)

## Recommenders
- Ms. Park — teacher, AP English Language (`park@lincolnhs.example`)
- Mr. Okafor — teacher, AP Physics (`okafor@lincolnhs.example`)
- Mr. Diaz — counselor (`diaz@lincolnhs.example`)

## School list (12) and Common App state
| # | School (slug) | Plan | Deadline | On Common App? | Questions | Supplements | Recs (from Common App) |
|---|---|---|---|---|---|---|---|
| 1 | University of Michigan (`umich`) | EA | 2026-11-01 | yes | in_progress | "Community essay" complete 298w; "Why Michigan" in_progress 143w | FERPA complete; counselor Mr. Diaz assigned, not submitted; Ms. Park invited 2026-09-02 not submitted; Mr. Okafor submitted 2026-09-01 |
| 2 | Northwestern University (`northwestern`) | ED | 2026-11-01 | yes | not_started | "Why Northwestern" not_started | FERPA complete; Ms. Park invited 2026-09-02 not submitted |
| 3 | University of Chicago (`uchicago`) | EA | 2026-11-01 | yes | complete | "Why UChicago" in_progress 102w; "Extended essay" not_started | FERPA complete; Ms. Park invited 2026-09-02; Mr. Okafor submitted 2026-09-01 |
| 4 | University of Illinois Urbana-Champaign (`uiuc`) | EA | 2026-11-01 | yes | not_started | "Major essay" not_started | FERPA complete; no recommenders (UIUC does not require) |
| 5 | University of Wisconsin–Madison (`wisconsin`) | EA | 2026-11-01 | yes | not_started | "Why Wisconsin" not_started | FERPA complete |
| 6 | Purdue University (`purdue`) | EA | 2026-11-01 | yes | not_started | "Purdue short answers" not_started | FERPA complete |
| 7 | Indiana University Bloomington (`indiana`) | EA | 2026-11-01 | yes | not_started | none | FERPA complete |
| 8 | Georgetown University (`georgetown`) | RD | 2027-01-10 | **no** (Georgetown uses its own application) | — | internal rules only | — |
| 9 | Washington University in St. Louis (`washu`) | RD | 2027-01-02 | yes | not_started | "Why WashU (optional)" not_started | FERPA complete |
| 10 | Emory University (`emory`) | RD | 2027-01-01 | yes | not_started | "Emory short answers" not_started | FERPA complete |
| 11 | Vanderbilt University (`vanderbilt`) | RD | 2027-01-01 | yes | not_started | "Vanderbilt short answer" not_started | FERPA complete |
| 12 | Loyola University Chicago (`loyola-chicago`) | rolling | 2026-12-01 (priority) | yes | not_started | none | FERPA complete |

Common App tab: Profile complete, Family complete, Education in_progress, Testing complete (SAT 1450 self-reported), Activities in_progress (6 entered), Writing in_progress (prompt #5, 412 words), Courses & Grades not_started. Dashboard: nothing submitted. Fee status unpaid everywhere; Dee is fee-waiver eligible.

## Essays in the database
- Personal essay: prompt 5, draft v1 412 words (student-written placeholder prose about the taqueria; two drafts: v1 380w on 2026-08-20, v2 412w on 2026-09-01)
- Michigan "Community essay": one draft, 298 words, item status done
- Michigan "Why Michigan": one draft 143 words, in_progress
- UChicago "Why UChicago": one draft 102 words, in_progress (untouched since 2026-08-25 → stale)
- Northwestern "Why Northwestern": no draft

## Conversation (main)
- 2026-09-01 outbound welcome text from the agent
- 2026-09-02 inbound "hey what should i do first"
- 2026-09-02 outbound reply with three concrete actions
- 2026-09-03 outbound proactive nudge about Ms. Park / Michigan (recorded in `nudges` with kind `recommender_inactivity`, acknowledged)

## Audit / jobs
- One succeeded `full_sync` browser job on 2026-09-03 with a snapshot matching the state above and an empty diff, plus a `verify_credentials` job on 2026-09-01.
