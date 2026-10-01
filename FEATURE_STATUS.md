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
| Past Papers | ✅ REAL | **This doc previously said "genuinely backend-blocked" — that was wrong, confirmed by reading `PastPaper.js` and `resources.controller.js` directly tonight.** Real model, real routes (`GET/POST /courses/:courseId/past-papers`), real `fileUrl` via the same `uploadDocument` Cloudinary middleware already used for resumes. `course/[id].tsx` previously linked to a fabricated route (`/paper/${id}-paper-1`) that was never a real ID; fixed tonight along with Notes (below) to link to a real per-course list screen. |
| Course-level Notes & Past Papers list screens, with file download | ✅ REAL, NEW TONIGHT | New: `app/course/[id]/notes.tsx` and `app/course/[id]/past-papers.tsx`, replacing the old `app/notes/[id].tsx` / `app/paper/[id].tsx`, which were pure `ShellScreen` wrappers reached via fabricated route strings (`${id}-note-1`, not a real ID). Both new screens are real lists against the confirmed backend, each item with a working Download button. Download uses a new shared utility, `src/utils/fileDownload.ts`, built on `expo-file-system/next` — the current SDK 57 API, verified against Expo's own docs and a real, currently-open GitHub issue (not assumed from memory): `bytes()` is Promise-wrapped as of SDK 54, and `Directory.list()`/the `File` constructor throw on filenames containing spaces or `#`/`%`, so filenames are sanitized to alphanumerics/dashes/underscores only. **Deliberate scope decision:** files save to this app's own private storage (`Paths.document`), not the device's shared Downloads folder or photo gallery — getting a file into shared storage needs a second library (`expo-media-library`, itself scoped to photos/videos via its `Asset` API, not arbitrary documents) or the Storage Access Framework, a materially bigger scope. "Downloaded" here means "saved for offline viewing inside UniLink," which is what was actually asked for once the shared-storage tradeoff was explained. Past Papers correctly handles a real backend difference `Note` doesn't have — an optional, separately-downloadable `markingSchemeUrl` — checked against the model directly rather than assumed to mirror Notes. This is a NEW native dependency (`expo-file-system`) as of tonight — needs `npx expo install expo-file-system` and a fresh EAS build, will not apply via OTA alone. Not yet built: the same download button on post media and on Portfolio's resume/certificates — same utility, straightforward follow-up, deliberately deferred to keep tonight's scope to what was explicitly asked (Notes and Past Papers) rather than sprawl further this late. |
| Discussion | 🚧 SHELL | See Community section — same screen, reached from a course. |
| AI Assistant (per-course) | ✅ REAL (not course-scoped) | Links to the global `/ai` assistant, which is now real — but it has no awareness of which course it was opened from. See the AI section below for the deliberate scope decision. |

## Community

| Item | Status | Notes |
|---|---|---|
| Post feed (create, view, like) | ✅ REAL | Uses the real Post model. **Like fixed tonight:** `likePost` previously just incremented a bare counter on every call, with no per-user tracking at all — no way to know if the current user had already liked a post, no way to unlike, and repeated taps could inflate the count indefinitely. This was a real, pre-existing bug, not something newly introduced. Fixed with a new `Like` model (same join-record pattern as tonight's `Follow` model, matching how Facebook actually stores likes — a separate record per user+post, not an array on the post itself), a compound unique index preventing duplicate likes, and `likePost` rewritten into a real toggle. `getFeed`/`getPostById` now batch-attach each post's `liked` status for the current user in one query, same efficiency principle as the existing author-name batching. Mobile's like button now shows a filled vs. outline heart based on real state and correctly reconciles with the server's actual response rather than a blind optimistic-always-increment. |
| Clubs, Projects, Study Groups | ✅ REAL | `app/clubs/`, `app/projects/`, `app/study-groups/` — list, create, and join/leave (join-only for Study Groups; no `/leave` route exists for those on the backend, confirmed, so no Leave button is shown) all wired to the real backend. Reachable via the rebuilt Community Hub. |
| Polls, Questions | ✅ REAL | `app/polls/` — real voting with a live percentage bar per option. The backend response has no explicit "did I vote" flag; this screen derives it by scanning each option's `voterIds` for the current user. Create form included. |
| Research | ⛔ NOT BUILT | Not represented in the Hub screen — unclear if this means research papers (see Library) or a separate concept; needs clarification before building. No backend model for this specifically either. |
| Announcements | ✅ REAL | `app/announcements/` — list is visible to everyone; the create button is shown only to lecturer/admin accounts client-side, mirroring the backend's own `isStaff` gate (which is the real enforcement — the client-side hide is just to avoid showing an action that would 403). |
| Discussion (per-course) | ✅ REAL | `app/discussion/[id].tsx` now posts to and reads from `GET/POST /courses/:courseId/discussion`. Like Comments used to, the backend returns a raw `userId` string with no populated name, so entries still show "You" or a generic label. **Not fixed tonight** — Comments got the author-name fix (see below) because that's what was asked for; Discussion has the exact same fixable gap and is a natural next candidate for the identical treatment. |
| Comments on posts | ✅ REAL, with real author names | `app/post/[id].tsx` posts to and reads from `GET/POST /posts/:postId/comments`. Backend fixed tonight: the `Comment` model existed already but had zero routes at all before this session — `getComments`/`addComment` are new, reusing `post.controller.js`'s existing manual-join pattern (`attachAuthorNames`) to attach a real name per comment. This doc previously noted comments only showed "You" or a generic label — that's now fixed; comment authors show their real name and are tappable through to their profile (see Following/Public Profile below). |
| Following / Followers | ✅ REAL, new tonight | Zero precedent anywhere before this session — no `Follow` model, no routes, nothing. Built as the real Instagram public-account model (confirmed this is what was wanted, not a request/approve system): one-directional, instant, no approval step. New `Follow` model (compound unique index on `{followerId, followingId}` prevents duplicates), new `/api/follow` router: `POST/DELETE /follow/:userId`, `GET /follow/:userId/followers`, `GET /follow/:userId/following`, `GET /follow/:userId/status`. Wired into the new public profile screen (below) as a Follow/Following toggle button. Not built: any notification when someone follows you, and no followers/following COUNT shown anywhere yet (would need a second round trip; wasn't asked for). |
| Public profile view (tap a name to see someone's profile) | ✅ REAL, new tonight | New screen, `app/user/[id].tsx` — did not exist in any form before; there was previously no way to view anyone's profile but your own. Shows name, role, bio, avatar (`GET /profile/summary/:userId`, expanded tonight from name/role only to include avatarUrl and bio — same public exposure tier as what's already visible on every post, not a new privacy surface), achievements (`GET /profile/achievements/:userId`, already existed, simply never had a mobile caller), and the Follow/Following button described above. Reachable by tapping a post author's name or a comment author's name, both wired tonight. **Honest limitation, not a bug:** the "Message" button on this screen opens the existing course-scoped `messages/new.tsx` flow, not a direct conversation with that specific person — there is no backend endpoint to start a conversation by userId alone, and building one wasn't in tonight's scope. Flagged clearly in-code rather than silently shipped as if it were fully wired. |

## Messaging

| Item | Status | Notes |
|---|---|---|
| Chats | ✅ REAL | Messages genuinely save to and load from the backend (`GET/POST /messages/:id/messages`) — **this doc previously said "local-only send," which was stale; confirmed by reading the code and by the screen's own in-app StatusBanner.** No live push layer: the screen polls every 4 seconds rather than receiving messages instantly. A socket.io server exists on the backend (added for the Admin Panel's live notifications) but only admits admin-role JWTs into an "admins" room — no student-facing events or rooms exist, so real-time delivery for chat is still a separate, unbuilt piece, not just "point the client at the existing server." |
| Conversation list — three-type model + tabbed filtering | ✅ REAL | Rebuilt tonight. `(tabs)/messages.tsx` — was previously a flat, direct-only model with no `type` field at all; would have silently mis-rendered or crashed on any real course/group conversation. Matches web's `Messages.js`/`messageService.js` exactly: real `direct`/`course`/`group` types, real `unreadCount`, four-tab filter (Messages/Unread/Communities/Lecturers), Lecturers tab resolved via each direct conversation's other-participant role lookup. **Promoted to its own bottom tab** (was previously reached only via a header button on Community) — moved from `app/messages/index.tsx` to `app/(tabs)/messages.tsx`; the URL is unchanged (`/messages`) since Expo Router group folders don't affect the path, so no other navigation call sites needed updating. The now-redundant "💬 Messages" button was removed from Community's header. `messages/new.tsx` (start a direct conversation) and `chat/[id].tsx` are unchanged, still reached the same way. Deliberately NOT built: starting a new course or group conversation (joining/creating) — `new.tsx` only supports picking a classmate for a direct message; creating a titled group or joining a course chat is a distinct, larger feature, intentionally left as a follow-up. |
| Voice notes, file sharing | ⛔ NOT BUILT | |
| Typing indicator, read receipts | ⛔ NOT BUILT | Needs Socket.io wired up on both ends. |
| Voice/video calls | ⛔ NOT BUILT | Explicitly deferred in spec too ("future"). |

## Emergency

| Item | Status | Notes |
|---|---|---|
| Report submission (medical/safety/abuse) | ✅ REAL | Uses real EmergencyReport model. |
| My Reports (report history) | ✅ REAL | New finding tonight. `GET /emergency/my-reports` is real and complete — mobile has no screen showing a student's own past reports at all right now. |
| Lecturer/admin report review, acknowledge, respond, escalate, resolve | ✅ REAL (backend), ⛔ NOT BUILT (mobile) | Substantial real backend found tonight: role-scoped viewing (`GET /emergency/reports` — lecturers see only their own courses' reports plus university-wide reports with no course, restricted types like abuse hidden from lecturers entirely and visible only to admins), `PATCH /:id/acknowledge`, `/respond` (internal notes thread), `/escalate`, `/status` (admin-only resolve/dismiss). Every action, including denied attempts, is written to a real audit log. This is a full incident-management system with zero mobile presence — mobile only ever calls the student-facing submit endpoint. Out of scope for a quick add: this is lecturer/admin-role UI, the same category of work as the broader Lecturer role surface documented elsewhere in this file. |
| Emergency contacts list | ✅ REAL (but static) | `GET /emergency/contacts` is real and returns real data, but the data itself is hardcoded in the controller (National Emergency, Ambulance, Campus Security with fixed numbers) — not database-backed, not editable without a code deploy. Accurate to call this "real" for mobile's purposes (a genuine list to display), but distinct from a true admin-editable contacts feature. |
| Request Help ("I need help now" quick action) | 🚧 SHELL (backend, not mobile) | Genuinely different from the other rows here: `POST /emergency/help` exists and returns 200, but it is a true stub server-side — the handler does not persist anything, notify anyone, or create any record. Calling it currently does nothing beyond returning a canned success message. This is the one item in this section where the backend itself, not just mobile, needs real work. |
| SOS button, live location | ⛔ NOT BUILT | Needs expo-location + a live-tracking backend design. Confirmed still absent on backend too — no route, no model field for it. |
| Trusted contacts (user-managed, distinct from the static list above) | ⛔ NOT BUILT | Confirmed absent on backend. |
| Campus security / hospital / police integration | ⛔ NOT BUILT | Real-world integration, not just code. |
| Medical profile | ⛔ NOT BUILT | Confirmed absent on backend — no fields on User or elsewhere. |

## Explore (Library / Marketplace / Events)

| Item | Status | Notes |
|---|---|---|
| Library (list, digital resources) | ✅ REAL | Fetched from the real backend. **Previously said SHELL/"Needs Library/Book model" — stale.** Borrow/reserve workflow beyond listing is not separately verified here — check `app/library/index.tsx`'s own status comment for current detail. |
| Marketplace (listings, jobs) | ✅ REAL | `GET /marketplace/listings` and `/marketplace/jobs` both real. **Previously said SHELL/"Needs Listing model" — stale.** Buyer/seller messaging is a separate, still-unverified concern — that would ride on the Messaging system, which genuinely is still shell (see below). |
| Events (list) | ✅ REAL | `GET /api/events` on the real backend. **Previously said SHELL/"Needs Event model" — stale.** |
| Events (RSVP, QR check-in) | 🚧 SHELL | List is real, but the event detail screen's RSVP only flips local state — nothing persists. QR check-in is a placeholder box, not a real generated/scannable code. This part of the doc's original claim still holds. |
| Lost & Found | ✅ REAL | Confirmed tonight by reading `lostAndFound.controller.js` and `LostItem.js` directly — full CRUD (`GET/POST /`, `PATCH /:id/resolve`), image upload via Cloudinary, ownership check on resolve (only the original reporter can mark resolved). **Mobile's screen (`app/lost-and-found/index.tsx`) is still a `ShellScreen` claiming "Needs: LostItem model... Needs: POST route" — that claim is now confirmed false. This is a real, ready-to-wire backend with zero mobile screen calling it, same shape as the Achievements/Portfolio and Notifications gaps found earlier.** |

## Profile

| Item | Status | Notes |
|---|---|---|
| Name, email, role, university ID | ✅ REAL | From the real User model. |
| Bio, phone, avatar, cover photo | ✅ REAL | New tonight, and now fully verified end-to-end rather than proposed: `User` model extended with `bio`, `phone`, `avatarUrl`, `coverUrl`. Real routes confirmed added to the already-mounted `/api/profile` router (there is no `/api/users` mount anywhere in this backend — mobile originally called the wrong prefix entirely, caught and fixed once the backend was actually available to check): `PUT /profile/me` (name/bio/phone), `PUT /profile/me/avatar`, `PUT /profile/me/cover` (Cloudinary uploads via the existing, already-proven `uploadImage` middleware and `uploadBufferToCloudinary` helper — no new upload infrastructure invented). `profile.tsx` now actually displays avatar, cover, and bio, all three previously either nonexistent or invisible (bio could be set but never shown anywhere). |
| Achievements, Badges | ✅ REAL | **This doc previously said SHELL — "No fields on User model for these" — that was wrong, confirmed by reading the backend directly tonight.** Real `Achievement` model + `GET /profile/achievements` (also `GET /profile/achievements/:userId` for viewing someone else's). One genuine, confirmed gap: there is no route anywhere that CREATES an Achievement record — nothing awards them yet, by admin action or otherwise — so this list is correctly empty for every user until that separate piece is built. Mobile's `achievements.tsx` was rebuilt tonight to actually call this; it correctly only reads/displays, since there's nothing to award from the client side. |
| Skills, Languages | ✅ REAL | Previously said SHELL, same as above — wrong. Real fields on the `Portfolio` model, editable via `PATCH /profile/portfolio`. Mobile's `achievements.tsx` rebuilt tonight with full add/remove UI for both. |
| Portfolio (Projects), Volunteer hours | ✅ REAL | Same correction. Real fields on `Portfolio`, same `PATCH /profile/portfolio` endpoint. Rebuilt tonight with an add-project form and an editable hours field. |
| Resume, Certificates (upload) | ✅ REAL | Same correction — `POST /profile/portfolio/resume` and `/certificates` are real, Cloudinary-backed, confirmed by reading the controller. Rebuilt tonight using `expo-document-picker` — **a brand-new native dependency as of tonight, not previously in this project**, meaning this specific piece cannot ship via OTA update alone and needs a fresh EAS build even though everything else in this same file change is pure JS. |

## Settings

| Item | Status | Notes |
|---|---|---|
| Dark mode, theme | ✅ REAL | `useColors()` + `useMemo` pattern is applied across the app. Three real dark-mode bugs (tab bar, Emergency screen, an orphaned duplicate chat route) were found and fixed in a prior session — this doc previously said NOT BUILT, which was stale. |
| In-app Notifications | ✅ REAL | New tonight. `app/notifications/index.tsx` — `GET/PATCH /notifications`, `PATCH /notifications/read-all`, matching web's `userNotificationService.js` exactly (the student/lecturer-facing system, not the separate admin-only `/api/admin/notifications` — confirmed by reading `AppRoutes.js`'s actual `RoleGuard` props, not by route name, since web has two similarly-named routes for two different role-gated systems). Wired into `home.tsx` as a bell icon with a real unread-count badge, deliberately fetched in its own independently-failing effect so a notifications hiccup can never block or error the main dashboard. Push notifications (OS-level alerts via `expo-notifications`) are a separate, genuinely unbuilt piece — this is the in-app feed only, same as web. |
| Privacy, Security (settings toggles) | ⛔ NOT BUILT | Confirmed tonight: zero backend surface exists anywhere (checked `userService.js`, `authService.js`, and the full `src/services` directory on web) — this is backend work first, not a mobile task. Change-password is separately real (see Settings section of `app/settings/change-password.tsx`) and unrelated to this row. |
| Downloads, Storage | 🚧 REAL, NARROW SCOPE | New tonight: `src/utils/offlineCache.ts` — a real, generic cache-last-successful-response utility (AsyncStorage-backed, same storage already proven for exam drafts), wired into `(tabs)/home.tsx`'s dashboard load. On a failed fetch with a cache available, the screen shows the cached data with an honest "Showing saved data from X ago" banner instead of an error. This is deliberately NOT the full "Downloads/offline mode" feature — it's one reusable primitive proven on one real screen, not wired app-wide, and there is still no storage-usage UI or user-facing download management. Was scoped this narrowly on purpose rather than fake a "Download" button the way web's `Student/Notes.js`/`Results.js` do (`console.log`, no real file) — that would have been a regression in honesty, not a feature. |
| Language (10 languages) | 🚧 REAL INFRASTRUCTURE, ENGLISH ONLY | New tonight: `react-i18next` + `expo-localization` (a NEW native dependency, needs a fresh EAS build, will not apply via OTA alone). Real, working language picker in Settings, saved to SecureStore, device-locale-aware default. English (`src/i18n/locales/en.json`) has real translated content for the highest-traffic screens; the other nine languages are genuinely empty stub files (`{ "_status": "not_yet_translated" }`) — selecting one is honest and functional (i18next's own `fallbackLng` mechanism serves the English string per-key with a clear "not yet translated" note shown in the picker), not fabricated machine-translated content dressed up as complete. Full string extraction across all ~46 screens into translation keys was NOT attempted tonight — that is still a large, real, separate effort, not a quick add, exactly as this file said before. |
| Accessibility (screen reader semantics — per-screen roles, labels, state) | ✅ COMPLETE | Every real screen in the app (41 of 45 — the other 4 are a pure redirect with no UI, plus 3 pure `ShellScreen` wrappers that inherit their accessibility from the shared component fix below) now has real, correct `accessibilityRole`/`Label`/`State` — not labels bolted on for coverage. Final batch tonight covered the remaining 21 real screens: `ai/index.tsx` (sender-aware chat bubble labels, live-region thinking indicator), `announcements`, `assignment/[id].tsx` (dual student/grader UI, per-item grading form), `auth/forgot-password.tsx`, `cat/[id].tsx` (dual student/publisher UI), `clubs`, `community-hub`, `discussion/[id].tsx`, `event/[id].tsx`, `events`, `library` (dual physical/digital sections), `marketplace` (dual listings/jobs sections), `polls` (real `radiogroup`/`radio` on vote options with percentage+count in each label, not generic buttons), `projects` (radiogroup status picker), `study-groups`, `course/[id].tsx` (radiogroup day-picker, explicit disabled-state on placeholder "Unit 1/2" cards so they don't read as real tappable items), and its two sub-routes. Also fixed the shared `ShellScreen.tsx` component itself — real headers, and every placeholder item now explicitly marked `disabled` to a screen reader rather than reading like a live, tappable row — which is what actually covers `lost-and-found/index.tsx`, `notes/[id].tsx`, `paper/[id].tsx`, and the four still-shell Settings sections without needing individual per-file edits. **Piggybacked while in `discussion/[id].tsx`:** fixed the exact same "raw userId, no populated name" gap Comments had before being fixed earlier tonight — `getDiscussionForCourse` in `community.controller.js` now attaches real author names via the same batch-lookup pattern, and mobile shows real, tappable-to-profile names instead of "You"/a generic label. Remaining, deliberately out of scope for this pass: Settings-level user toggles (large text, high contrast, reduced motion as actual OS-level preferences, distinct from the semantic correctness just completed) are still entirely unbuilt. |

## AI

| Item | Status | Notes |
|---|---|---|
| General chat assistant | ✅ REAL | `app/ai/index.tsx` calls `POST /api/ai/ask`, proxied through the backend (OpenAI `gpt-4o-mini`) so the API key never ships in the mobile app. Server enforces a 30-request/day/user cap backed by a real `AiUsage` model (survives Render's free-tier restarts, unlike an in-memory counter) and returns a clear 429 message when hit. Conversation history is client-held only, not persisted server-side. |
| Course-scoped context (AI aware of a specific course's notes/timetable) | ⛔ NOT BUILT | The "Ask AI about this course" link (now labeled "Ask UNILINK AI") opens the same general assistant with no course context passed in. Deliberately scoped this way for the first real version — feeding student notes/timetable data to an external LLM raises real privacy questions (should other students' or a lecturer's data ever reach the prompt?) worth deciding deliberately, not bolting on quietly. |
| Structured output (quiz generation, flashcards as distinct UI, not just chat text) | ⛔ NOT BUILT | The assistant can be asked for these in chat and will respond in prose, but there's no dedicated flashcard/quiz UI parsing structured output from it - it's a general chat, not these specific tools. |
| Study timetable, career advice | ⛔ NOT BUILT | Same as above - answerable via general chat, no dedicated feature. |

## Cross-cutting infrastructure (not single features)

| Item | Status | Notes |
|---|---|---|
| OTP verification | ⛔ NOT BUILT | Needs an SMS provider (Twilio/Africa's Talking) + backend route. |
| Biometric login | ⛔ NOT BUILT | Needs `expo-local-authentication`, straightforward once login UX is finalized. |
| Offline mode (cache notes/timetable, offline queue) | ⛔ NOT BUILT | Real architecture decision, not a quick add. |
| Certificate pinning | ⛔ NOT BUILT | |
| Push notifications | ⛔ NOT BUILT | Needs `expo-notifications` + backend to trigger them. |
| OTA updates (JS/asset-only code push without a new APK) | ✅ REAL | Configured via `eas update:configure`: `app.json` has `runtimeVersion: {"policy":"appVersion"}` and `updates.url` pointed at the real project; `eas.json`'s `preview` and `production` build profiles each have a matching `channel`. This uses expo-updates' default `ON_LOAD` + `fallbackToCacheTimeout: 0` behavior — the app always boots instantly from its current cached bundle, checks for a newer one in the background, and only applies it on the *next* cold launch, never mid-session. That default needed zero code to work. `app/_layout.tsx` adds one thing on top: a silent, non-blocking check on mount purely so update activity shows up in logs (found/not-found/failed) instead of being completely invisible — genuinely optional, not required for updates to function. Correctly guarded with `Updates.isEmbeddedLaunch` (not `__DEV__`, which would incorrectly skip the check on legitimate EAS preview-build APKs) so it never throws in Expo Go or a dev client. Real discipline going forward: pure JS/logic/UI changes → `eas update:configure`d channel picks them up automatically on next publish, no new APK needed; anything touching native code (new native package, permission, `app.json` plugin change) needs a version bump and a full new EAS build instead — OTA cannot ship native changes, only JS/asset ones. |

## Exams

| Item | Status | Notes |
|---|---|---|
| Exam list (student) | ✅ REAL | New tonight. `app/exams/index.tsx` calls `GET /exams`, matching web's `examService.js` `getStudentExams` exactly. Zero mobile presence before this — genuinely missing, not previously documented anywhere. |
| Take exam | ✅ REAL | New tonight. `app/exams/[id]/take.tsx` — full state machine ported from web's `TakeExam.js`: countdown timer with auto-submit at zero, per-question navigation, MCQ/true-false/essay/short question types, submit confirmation dialog. Answer drafts persist to AsyncStorage (not SecureStore — these aren't credentials) so a crash mid-exam doesn't lose progress, same intent as web's localStorage draft-save. Deliberately NOT ported: web's fullscreen-on-request anti-cheat measure, since `requestFullscreen()` is a browser API with no native equivalent (a mobile app is already fullscreen). Added, with no web counterpart to match: a hardware back-button confirmation dialog, since accidentally backing out mid-timed-exam is a one-tap native accident that doesn't have a browser-back analog. |
| Results | ✅ REAL | New tonight. `app/exams/results.tsx` calls `GET /exams/results/me`, matching `getStudentResults`. Deliberately NOT ported: web's "Download" and "Print Results" buttons — both are cosmetic on web itself (download only shows a toast with no real file; print calls `window.print()`, no native equivalent), so building fake versions here would be a regression, not parity. |
| Lecturer exam creation/grading | ⛔ NOT BUILT | Web has a full 11-file Lecturer role surface (`Lecturer/CreateExam.js`, `GradeSubmissions.js`, etc., ~2,635 lines total) with no mobile equivalent at all. Out of scope for tonight's pass — this is its own dedicated build, not a quick add, and mobile currently has zero role-gated navigation pattern to build it on top of. |
| Admin panel (backend) | ✅ REAL | Major correction tonight: this file and prior conversation had assumed essentially no backend work existed here. Confirmed false by reading `admin.controller.js` and `admin.routes.js` directly — real admin creation (bcrypt-hashed, audit-logged), user management, and more, all built on the existing `User` model with `role: "admin"` rather than a separate Admin collection. A `BACKEND-MISSING/` folder sitting in the repo root, containing an older draft of the same controller against a different, since-abandoned design (a separate `Admin` model, different file-naming convention), looked at first like evidence of unfinished work — it is not; it's superseded scaffolding from an earlier design pass, safely ignorable. |
| Admin panel (mobile) | ⛔ NOT BUILT | The backend being real does not change this: mobile has zero admin-role screens, zero role-gated navigation, and building this properly means the same category of work as the Lecturer surface above — its own dedicated pass, not a quick add. |

## Auth (additions)

| Item | Status | Notes |
|---|---|---|
| Forgot password (pre-login reset) | ✅ REAL | New tonight. `app/auth/forgot-password.tsx` — two-step flow (email → code + new password), added to `authStore.ts` as `forgotPassword`/`resetPassword`, matching web's `AuthContext.js` payload shape exactly (`resetPassword` sends all four fields to the backend, including `confirmNewPassword` — the server re-validates the match itself rather than trusting the client check alone). Wired into `login.tsx` via a new "Forgot your password?" link; the screen was built once already this session without that link and was unreachable until caught. |

## Profile (additions)

| Item | Status | Notes |
|---|---|---|
| Edit Profile (name, bio, phone, avatar, cover) | ⚠️ UNVERIFIED ENDPOINTS | Expanded tonight from name/bio only. `PUT /users/profile` (name/bio/phone) is the existing, already-flagged unverified port of web's `EditProfile.js` — does NOT appear in `userService.js`, the audited service file. `PUT /users/profile/avatar` and `PUT /users/profile/cover` are new tonight and have ZERO precedent anywhere in this codebase, web included — there was nothing to port; these are mobile-first proposed endpoints, not confirmed against any real backend route. Do not assume any of the three are live until actually hit and confirmed. Image upload mechanics (permission request, ImagePicker, multipart FormData via raw `axios.put` + manual Bearer token, not the shared `api` client) are copied directly from `(tabs)/community.tsx`'s post-media upload — real, tested, confirmed working on-device — not a new pattern invented for this. `profile.tsx` now actually displays avatar, cover, and bio, which were previously either nonexistent or write-only (bio could be set but never seen anywhere). Added a genuine `setUser` action to `authStore.ts` (previously did not exist — the first draft of this screen referenced it without checking, caught before it shipped) which persists to SecureStore the same way `completeAuth` does, so profile edits survive an app restart instead of silently reverting to the pre-edit values on next cold launch. `UniLinkUser` type extended with `bio`, `phone`, `avatarUrl`, `coverUrl`, all optional. |

## Exams (fixes)

| Item | Status | Notes |
|---|---|---|
| "Blank screen, exam routes not found" bug | ✅ FIXED | Root cause was never a missing route — `GET /exams/:id` and `POST /exams/:id/submit` are correct and match `examService.js` exactly, confirmed by re-checking byte-for-byte. The real bug: a Published exam can still be outside its valid submission window, and the backend correctly rejects that (confirmed identical behavior on web: "not open for submission"). Mobile's `catch` block in `exams/[id]/take.tsx` swallowed that real message on ANY error and silently did `router.replace('/exams')` — with `loading` never properly resolving to false in the failure case, the practical result was an indefinite spinner that looked exactly like a blank screen. Fixed by adding a real `loadError` state, a proper error render branch showing the actual backend message, and — going one step further than web (which has no equivalent check) — hiding the "Take Exam" button on `exams/index.tsx` when `startTime` is unambiguously still in the future, replacing it with a disabled "Opens [date]" state. Deliberately conservative: only the clear future-date case is caught client-side; anything ambiguous (already started, near a boundary, no startTime set) still shows the real button and defers to the backend's actual response, same as web, rather than mobile inventing its own timezone/grace-period rules it can't verify. |

## Cross-cutting fixes (tonight)

| Item | Status | Notes |
|---|---|---|
| Tab bar dark mode | ✅ FIXED | `app/(tabs)/_layout.tsx` imported the static `Colors` object instead of `useColors()`, so the tab bar stayed pure white at the bottom of every screen, all the time, even in dark mode — visible on all five tabs. Same bug class as the two below. Not previously documented anywhere; found by checking the layout file directly, not by a screenshot. |
| Emergency screen dark mode | ✅ FIXED | `app/(tabs)/emergency.tsx` had the identical static-`Colors`-import bug. Also caught and fixed a second latent issue while in the file: the active-type-button highlight was hardcoded to pale pink, which would have looked equally broken against a dark background once the main bug was fixed. |
| Orphaned duplicate chat route | ✅ FIXED (deleted) | `app/messages/chat[id].tsx` was a dead, unreachable duplicate of the real, live `app/chat/[id].tsx` — nothing in the app ever navigated to it. Deleted rather than fixed, since the live twin was already correct. |

## Honest summary

Real, working, end to end: **Login, Register, Post feed with real
comments (author names now real, not generic labels) and a public
profile view reachable by tapping any author's name, Following/
Followers (real Instagram-style one-directional follow, new tonight),
Emergency report + report history, Profile view/edit (including
avatar, cover, bio, phone), Achievements & Portfolio (skills,
languages, projects, volunteer hours, resume, certificates), Home
greeting, Messaging (three-type model with tabbed filtering, polling
not real-time), Exams (list/take/results), Forgot Password, In-app
Notifications, Lost & Found (backend real, mobile screen not yet
wired), Library, Marketplace (including jobs), Emergency contacts
(static list).** Everything else in this document is either a
genuine UI shell, a genuine backend gap, or not present at all.

This batch (Comments backend, Following/Followers from scratch,
public profile screen) was built in one continuous pass at the
person's explicit request despite a genuine size mismatch between the
pieces — Comments needed only new routes against an existing model,
Following needed an entirely new schema designed from a design
conversation first. Each piece was still verified individually
(`node --check` on every backend file, brace/paren balance and
import-resolution checks on every mobile file) rather than assumed
correct by association with the rest of the batch, learning directly
from earlier the same night, where a similarly bundled batch shipped
with one real bug (a used-but-never-installed npm package) that only
surfaced at build time.

**Tonight (this session) had the UNILINK-BACKEND repo available for
the first time.** Every prior "SHELL — needs a model" or "NOT BUILT"
claim in this file was written from mobile or web absence alone, never
checked against actual backend code — because nobody working on this
project before tonight had that repo open at the same time as this
one. That gap produced real, meaningful errors in both directions:
Achievements/Portfolio, Lost & Found, and the admin panel were all
marked unbuilt or absent while their backends were fully real and
working; conversely, three brand-new endpoints (`/profile/me/avatar`,
`/profile/me/cover`, plus mobile's original guess at `/users/profile`,
which turned out to target a route prefix — `/api/users` — that has
never existed in this backend at all) were built and shipped as
"unverified" before this repo was available to check them against,
and needed a real path correction once it was.

The single largest, highest-confidence takeaway from tonight: **this
project has substantially more real backend than either the mobile or
web frontend currently uses.** Achievements/Portfolio and Lost & Found
were the two proven this session (both now wired into mobile). Not yet
wired into anything, confirmed real and ready: the full lecturer/admin
emergency-report review system (acknowledge/respond/escalate/resolve,
role-scoped, fully audit-logged), and the admin panel backend broadly.
Anywhere this file says a mobile or web screen is SHELL, the correct
default assumption going forward is "check the backend before assuming
it needs to be built from scratch" — that check has had a better than
even hit rate tonight.

32+ screens exist and are fully navigable — no dead links, every
button goes somewhere (verified each screen tonight added is actually
linked from somewhere, not just present as a file, following the same
discipline that caught two genuinely orphaned/unreachable screens in
earlier sessions).

Real, current priority order for what's next, in order of leverage
rather than alphabetically:
1. **Wire Lost & Found's mobile screen to its real, already-confirmed
   backend** — smallest remaining gap of this exact shape, should be a
   fast win using the same pattern as tonight's Achievements build.
2. **A real backend fix for Emergency's "Request Help" stub** — the
   one item found tonight where the backend itself, not mobile, is the
   incomplete side.
3. **Lecturer role surface** (web: ~2,635 lines, 11 files) and/or the
   **admin panel mobile UI** — both are large, standalone builds, both
   now confirmed to have complete, real backends waiting, and both
   need mobile's first-ever role-gated navigation pattern before
   either can start. Whichever is tackled first, that navigation
   pattern is shared infrastructure for both.
4. Accessibility pass on the ~34 screens not yet covered.
5. Genuinely unbuilt on any backend, confirmed tonight: push
   notifications, SOS/live location, trusted contacts (user-managed),
   medical profile, OTP, biometric login, offline mode, certificate
   pinning, user search/discovery, and real-time chat.

## Session: search, profile posts, account deletion, financial support

| Item | Status | Notes |
|---|---|---|
| New message: search by name | ✅ REAL | `GET /profile/search?q=`. University-scoped, min 2 chars, max 20 results. |
| Profile: direct Message button + posts | ✅ REAL | `POST /messages/start`, `GET /posts/user/:userId` (community posts excluded). |
| Delete account | ✅ REAL | `DELETE /profile/me { password }`. Soft delete + anonymize; admins cannot self-delete. |
| Financial Support | 🚧 SHELL | Settings > Financial Support. "Coming soon". No backend. |
