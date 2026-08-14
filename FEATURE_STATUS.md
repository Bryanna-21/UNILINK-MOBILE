# UniLink Mobile — Feature Status Tracker

Last updated: build session, Aug 2026.

Legend:
- ✅ REAL — calls the live backend, works end to end today
- 🚧 SHELL — UI exists, no backend, tapping things does nothing real
- ⛔ NOT BUILT — not present in the app at all yet

This file is the source of truth for what's real. If a screen's
in-app StatusBanner ever disagrees with this file, trust the banner
first (it's harder to forget to update) but fix this file too.

## Foundation

| Item | Status | Notes |
|---|---|---|
| Project scaffold (Expo Router, SDK 57) | ✅ REAL | |
| Auth: Login | ✅ REAL | Plain email/password only. No OTP, no biometric, no "remember device." |
| Auth: Register | ✅ REAL | Matches backend's required fields exactly. |
| Tab navigation shell | ✅ REAL | Home / Courses / Community / Explore / Profile |
| Theme (colors, spacing, radius) | ✅ REAL | Matches spec's design tokens. |

## Home

| Item | Status | Notes |
|---|---|---|
| Greeting, role display | ✅ REAL | From real logged-in user. |
| Today's Classes | ✅ REAL | Reads each enrolled course's merged timetable (`GET /courses/:id/timetable/mine`, folds in personal overrides), filtered to today's weekday. **This doc previously said SHELL — that was stale; the in-app StatusBanner and code already correctly said REAL.** |
| Continue Learning (Notes) | ✅ REAL | Pulled live from enrolled courses' notes (`GET /courses/:id/notes`). Previously listed as SHELL — stale. |
| Upcoming CAT | ✅ REAL | Pulled live from enrolled courses' CATs (`GET /courses/:id/cats`). Previously listed as SHELL — stale. |
| Attendance | ✅ REAL | Sign-in per course for today via `POST /courses/:id/attendance`, one signature per student/course/date enforced backend-side (409 on duplicate). Previously listed as SHELL ("needs an Attendance model") — the model and full controller already existed; stale. |
| Recent Notes | ⛔ NOT BUILT | Folded conceptually into "Continue Learning" for now — no separate section. |
| Quick Actions (Emergency) | ✅ REAL | Links to real Emergency screen. |
| Lost & Found | ⛔ NOT BUILT | |
| Weather, Time widgets | ⛔ NOT BUILT | Would need a weather API integration. |

## Courses

| Item | Status | Notes |
|---|---|---|
| Course list | ✅ REAL | Fetched from `GET /api/courses`. **Previously said SHELL/"No Course model" — stale; the screen's own comment already correctly says LIVE.** |
| Course detail (header) | ✅ REAL | Fetches the actual course by id. |
| Timetable (per-course, lecturer add) | ✅ REAL | `POST /courses/:id/timetable` — lecturers can add real entries. Feeds Home's "Today's Classes." |
| Units | 🚧 SHELL | Backend model + routes (`/courses/:courseId/units`) exist, but no mobile screen calls them at all — there's no Units screen in the app tree yet. Status is correctly SHELL; the doc's old reason ("No Unit model") was stale, not the conclusion. |
| Notes (offline download, bookmarks, highlighting, PDF viewer) | ⛔ NOT BUILT | Backend has a real Notes upload/list route (`/courses/:id/notes`, used by Home's "Continue Learning"), but the fuller feature set here — offline download, bookmarks, highlighting, in-app PDF viewer — genuinely isn't built. Real scope: needs file storage + PDF rendering lib. |
| Assignments (detail screen) | ✅ REAL | `app/assignment/[id].tsx` now has real submit/resubmit for students and a real grading UI for lecturers/admins, matching the backend's role gating exactly (verified `getSubmissionsForAssignment` 403s non-graders server-side). Reached from `app/course/[id]/assignments.tsx`, a new list screen (the course-detail screen previously linked to a fabricated single-item id, which has been fixed). |
| CATs (detail screen) | ✅ REAL | `app/cat/[id].tsx` now shows real published results to students and a real publish form to lecturers/admins. Known rough edge, kept deliberately: publishing requires a `studentId` and no backend endpoint exposes a course roster with student names to a lecturer, so the publish form takes a raw ID rather than a name picker. Reached from `app/course/[id]/cats.tsx`, a new list screen. |
| Past Papers | 🚧 SHELL | Needs file storage (Mongo alone isn't right for files) — this one is still genuinely backend-blocked, not just unwired. |
| Discussion | 🚧 SHELL | See Community section — same screen, reached from a course. |
| AI Assistant (per-course) | 🚧 SHELL | Links to the global `/ai` shell — not a separate per-course implementation. |

## Community

| Item | Status | Notes |
|---|---|---|
| Post feed (create, view, like) | ✅ REAL | Uses the real Post model. |
| Clubs, Projects, Study Groups | ✅ REAL | `app/clubs/`, `app/projects/`, `app/study-groups/` — list, create, and join/leave (join-only for Study Groups; no `/leave` route exists for those on the backend, confirmed, so no Leave button is shown) all wired to the real backend. Reachable via the rebuilt Community Hub. |
| Polls, Questions | ✅ REAL | `app/polls/` — real voting with a live percentage bar per option. The backend response has no explicit "did I vote" flag; this screen derives it by scanning each option's `voterIds` for the current user. Create form included. |
| Research | ⛔ NOT BUILT | Not represented in the Hub screen — unclear if this means research papers (see Library) or a separate concept; needs clarification before building. No backend model for this specifically either. |
| Announcements | ✅ REAL | `app/announcements/` — list is visible to everyone; the create button is shown only to lecturer/admin accounts client-side, mirroring the backend's own `isStaff` gate (which is the real enforcement — the client-side hide is just to avoid showing an action that would 403). |
| Discussion (per-course) | ✅ REAL | `app/discussion/[id].tsx` now posts to and reads from `GET/POST /courses/:courseId/discussion`. Like Comments, the backend returns a raw `userId` string with no populated name, so entries show "You" or a generic label. |
| Comments on posts | ✅ REAL | `app/post/[id].tsx` now posts to and reads from `GET/POST /posts/:postId/comments`. Same "no populated name" caveat as Discussion. |

## Messaging

| Item | Status | Notes |
|---|---|---|
| Chats | 🚧 SHELL | UI + local-only send exists. A socket.io *server* now exists on the backend (added since this doc was last accurate — built for the Admin Panel's live notifications), but it only admits admin-role JWTs into one "admins" room. No student-facing events, rooms, or Message/Conversation model exist yet — real chat is still its own build, not just "point at the existing server." |
| Voice notes, file sharing | ⛔ NOT BUILT | |
| Typing indicator, read receipts | ⛔ NOT BUILT | Needs Socket.io wired up on both ends. |
| Voice/video calls | ⛔ NOT BUILT | Explicitly deferred in spec too ("future"). |

## Emergency

| Item | Status | Notes |
|---|---|---|
| Report submission (medical/safety/abuse) | ✅ REAL | Uses real EmergencyReport model. |
| SOS button, live location | ⛔ NOT BUILT | Needs expo-location + a live-tracking backend design. |
| Trusted contacts | ⛔ NOT BUILT | |
| Campus security / hospital / police integration | ⛔ NOT BUILT | Real-world integration, not just code. |
| Medical profile | ⛔ NOT BUILT | |

## Explore (Library / Marketplace / Events)

| Item | Status | Notes |
|---|---|---|
| Library (list, digital resources) | ✅ REAL | Fetched from the real backend. **Previously said SHELL/"Needs Library/Book model" — stale.** Borrow/reserve workflow beyond listing is not separately verified here — check `app/library/index.tsx`'s own status comment for current detail. |
| Marketplace (listings, jobs) | ✅ REAL | `GET /marketplace/listings` and `/marketplace/jobs` both real. **Previously said SHELL/"Needs Listing model" — stale.** Buyer/seller messaging is a separate, still-unverified concern — that would ride on the Messaging system, which genuinely is still shell (see below). |
| Events (list) | ✅ REAL | `GET /api/events` on the real backend. **Previously said SHELL/"Needs Event model" — stale.** |
| Events (RSVP, QR check-in) | 🚧 SHELL | List is real, but the event detail screen's RSVP only flips local state — nothing persists. QR check-in is a placeholder box, not a real generated/scannable code. This part of the doc's original claim still holds. |

## Profile

| Item | Status | Notes |
|---|---|---|
| Name, email, role, university ID | ✅ REAL | From the real User model. |
| Achievements, Badges, Skills | 🚧 SHELL | No fields on User model for these. |
| Certificates, Languages | 🚧 SHELL | Same. |
| Portfolio, Resume, Volunteer hours, Projects | 🚧 SHELL | Same. |

## Settings

| Item | Status | Notes |
|---|---|---|
| Dark mode, theme | ⛔ NOT BUILT | |
| Notifications, Privacy, Security | ⛔ NOT BUILT | |
| Downloads, Storage | ⛔ NOT BUILT | |
| Language (10 languages) | ⛔ NOT BUILT | Needs an i18n library + real translations, not just a toggle. |
| Accessibility (screen reader, large text, high contrast, reduced motion) | ⛔ NOT BUILT | |

## AI

| Item | Status | Notes |
|---|---|---|
| Summarize notes, explain concepts, quizzes, flashcards | ⛔ NOT BUILT | Needs a real LLM API decision + backend proxy (never call an LLM API key directly from the mobile app). |
| Study timetable, career advice | ⛔ NOT BUILT | |

## Cross-cutting infrastructure (not single features)

| Item | Status | Notes |
|---|---|---|
| OTP verification | ⛔ NOT BUILT | Needs an SMS provider (Twilio/Africa's Talking) + backend route. |
| Biometric login | ⛔ NOT BUILT | Needs `expo-local-authentication`, straightforward once login UX is finalized. |
| Offline mode (cache notes/timetable, offline queue) | ⛔ NOT BUILT | Real architecture decision, not a quick add. |
| Certificate pinning | ⛔ NOT BUILT | |
| Push notifications | ⛔ NOT BUILT | Needs `expo-notifications` + backend to trigger them. |

## Honest summary

Real, working, end to end: **Login, Register, Post feed, Emergency
report, Profile view, Home greeting.** Everything else in this
document is either a UI shell with no backend behind it, or not
present in the app at all yet.

26 screens exist and are fully navigable — no dead links, every
button goes somewhere. Newly added since the first pass: AI Assistant
(chat-shaped, no LLM connected), Event detail with local-only RSVP,
CAT detail, Past Paper detail, Lost & Found. Course detail, Explore,
and Events now link into their real sub-screens instead of showing
inert cards.

This file should shrink the "SHELL" and "NOT BUILT" rows over time as
real backend features ship — that is the actual next phase of this
project, not a footnote.
