# Requirements

## Intent Summary

- **Type:** new feature
- **Scope:** system-wide
- **Classification:** greenfield
- **Affected repos:** none (new application)
- **Description:** A quiz game application with two roles (Admin, Player). Admins manage topics and questions. Players select a topic, answer 10 timed multiple-choice questions, earn points, and compete on a global all-time leaderboard. Delivered as a mobile-responsive web application (PWA-capable).

---

## Functional Requirements

### Authentication & Authorization

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| FR-1 | The system must support user registration via email and password with email verification. Passwords must be minimum 8 characters and enforce composition rules (uppercase, lowercase, number, special character) | Given a new user submits a valid email and a password meeting strength requirements, when they complete email verification, then their account is active and they can log in. Given a user submits a password that does not meet composition rules, then the system rejects with a validation error | P0 |
| FR-2 | Social login (Google, GitHub) — deferred to post-V1 | N/A — deferred by human override | Deferred |
| FR-3 | The system must enforce role-based access control with two roles: Admin and Player | Given a user is authenticated, when they attempt an action, then the system permits or denies based on their assigned role | P0 |
| FR-4 | Players must not be able to access admin functions (topic/question CRUD, viewing all player scores). Authorization must be enforced at the API layer on every request regardless of frontend state | Given a user with the Player role, when they attempt to access an admin endpoint (via UI or direct API call), then the system returns a 403 Forbidden response. Frontend role-based UI is supplementary, not a security control | P0 |
| FR-5 | Admins must be able to perform all player actions in addition to admin actions | Given a user with the Admin role, when they navigate to player features (play quiz, view leaderboard), then they can use them | P1 |
| FR-28 | The system must support secure password reset via email with time-limited, single-use tokens | Given a user requests a password reset, when the system sends a reset email, then the token is cryptographically random (min 128 bits entropy), expires after 15 minutes, and is invalidated after use. Given an expired or used token is submitted, then the system rejects the request | P1 |
| FR-29 | Sessions must expire after 24 hours of inactivity. Active sessions must be invalidated when a user changes their password | Given a user's session has been idle for more than 24 hours, when they make a request, then the session is expired and the user must re-authenticate. Given a user changes their password, then all other active sessions for that user are invalidated | P0 |
| FR-30 | The system must enforce rate limiting on authentication endpoints | Given a user or IP makes more than 5 failed login attempts per account per 15 minutes, then the account is temporarily locked and the user is notified. Given an IP makes more than 10 auth requests per minute, then further requests are rejected with 429 | P0 |

### Admin — Topic Management

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| FR-6 | Admins must be able to create a new topic with a unique name | Given an admin submits a new topic name that does not already exist, when they save, then the topic is created and visible in the topic list | P0 |
| FR-7 | Admins must be able to edit an existing topic name | Given an admin edits a topic name to a value that does not conflict with another topic, when they save, then the topic name is updated | P1 |
| FR-8 | Admins must be able to delete a topic. Deletion removes the topic from the playable list and question bank but does NOT retroactively remove historical quiz scores | Given an admin deletes a topic, when confirmed, then the topic no longer appears as playable and its questions are removed from the active bank. Historical quiz results referencing this topic are preserved with the topic name marked as "[deleted]". Player cumulative scores remain unchanged | P1 |
| FR-9 | Topic names must be unique (case-insensitive) | Given an admin attempts to create or rename a topic to a name that already exists (case-insensitive match), when they save, then the system rejects with a validation error | P0 |

### Admin — Question Management

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| FR-10 | Admins must be able to add questions to a topic. Each question has: question text, 4 options, and exactly 1 correct answer | Given an admin creates a question with text, 4 options, and selects one correct answer, when they save, then the question is stored in the topic's question bank | P0 |
| FR-11 | Admins must be able to edit existing questions (text, options, correct answer) | Given an admin modifies any field of an existing question, when they save, then the changes are persisted | P1 |
| FR-12 | Admins must be able to delete a question from a topic | Given an admin deletes a question, when confirmed, then the question is removed from the topic's bank | P1 |
| FR-13 | A topic must have a minimum of 10 questions before it is playable by players | Given a topic has fewer than 10 questions, when a player views available topics, then that topic is not listed as playable | P0 |

### Admin — Score Viewing

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| FR-14 | Admins must be able to view all player scores | Given an admin navigates to the player scores section, when the page loads, then they see a list of all players with their total scores | P1 |

### Player — Topic Selection

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| FR-15 | Players must see a list of available topics (only topics with ≥10 questions) | Given a player navigates to "Play Quiz," when the page loads, then only topics with at least 10 questions in their bank are displayed | P0 |
| FR-16 | Players must be able to select one topic to start a quiz | Given a player clicks on a topic, when they confirm, then a new quiz session begins with that topic | P0 |

### Player — Quiz Gameplay

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| FR-17 | Each quiz consists of exactly 10 questions randomly selected from the chosen topic's question bank. The correct answer must NOT be included in the API response that delivers the question to the player | Given a player starts a quiz, when questions load, then exactly 10 questions are presented (randomly chosen, no duplicates within a single quiz). The API response contains only question text and answer options without indicating correctness. Answer validation occurs server-side after submission | P0 |
| FR-18 | Each question displays the question text and 4 answer options | Given a question is presented, when the player views it, then the question text and exactly 4 clickable options are visible | P0 |
| FR-19 | Each question has a 10-second countdown timer. If the timer expires without an answer, the question scores 0 and the quiz advances to the next question | Given a question is displayed, when 10 seconds elapse without an answer, then the question is marked as unanswered (0 points) and the next question loads | P0 |
| FR-20 | A correct answer scores +10 points | Given a player selects the correct answer within the time limit, when the answer is submitted, then +10 points are added to the quiz score | P0 |
| FR-21 | An incorrect answer scores 0 points (no negative marking) | Given a player selects an incorrect answer, when the answer is submitted, then 0 points are added (no deduction) | P0 |
| FR-22 | After all 10 questions are answered or timed out, the player sees a quiz summary showing: total score, number correct, number incorrect, number unanswered | Given the 10th question is completed, when the summary loads, then it displays total score out of 100, correct count, incorrect count, and unanswered count | P0 |
| FR-31 | A quiz session is atomic — only one active quiz session per player is allowed at any time. Quiz answer submissions must be rate-limited to max 1 per second per session | Given a player has an active quiz session, when they attempt to start another quiz, then the system rejects the request. Given a player submits answers faster than 1 per second, then excess submissions are rejected | P0 |

### Player — Score & History

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| FR-23 | Players must be able to view their personal quiz history (list of past quizzes with topic, score, date) | Given a player navigates to "My History," when the page loads, then they see a chronological list of all quizzes they have played with topic name, score, and date/time | P1 |
| FR-24 | Each completed quiz score must be added to the player's cumulative total score | Given a player completes a quiz with score S, when the quiz ends, then S is added to their lifetime total score | P0 |

### Leaderboard

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| FR-25 | The system must display a global leaderboard ranked by total cumulative score (descending) | Given a player or admin navigates to the leaderboard, when the page loads, then all players are listed in descending order of total score | P0 |
| FR-26 | The leaderboard must show: rank, player display name, and total score | Given the leaderboard is displayed, when a user views it, then each entry shows the player's rank (position), display name, and total score | P0 |
| FR-27 | The leaderboard must be accessible to all authenticated users (both roles) | Given any authenticated user, when they navigate to the leaderboard page, then it loads successfully regardless of role | P0 |

---

## Non-Functional Requirements

| ID | Requirement | Measure | Priority |
|---|---|---|---|
| NFR-1 | Timer accuracy — the 10-second countdown must be accurate on the client regardless of network latency | Timer drift must be ≤ 500ms from actual elapsed time; timer enforcement (scoring) must be validated server-side with a grace period of up to 500ms | P0 |
| NFR-2 | Response time — page loads and API responses must be fast under normal load | p95 response time < 500ms for API calls; initial page load < 3 seconds on 4G connection | P1 |
| NFR-3 | Security — authentication tokens must be stored in httpOnly, Secure, SameSite=Strict cookies. Tokens must NOT be stored in localStorage or sessionStorage | Tokens use httpOnly + Secure + SameSite=Strict cookies; passwords hashed with bcrypt (cost ≥ 10) or argon2; no plaintext credentials in transit or at rest | P0 |
| NFR-4 | Security — all API endpoints must validate authorization at the API layer on every request | Every mutation and query endpoint checks the user's role claims from the authenticated session before processing; unauthorized access returns 403 | P0 |
| NFR-5 | Responsive design — the application must be usable on mobile, tablet, and desktop | All screens render correctly and are interactive on viewports from 320px to 1920px wide | P0 |
| NFR-6 | Accessibility — the application must meet WCAG 2.1 AA for core user flows | Core flows (login, play quiz, view leaderboard) pass automated accessibility audit (axe-core) with zero critical violations | P1 |
| NFR-7 | Scalability — the system must handle 100 concurrent users at launch with architecture that supports growth to 10,000 | At 100 concurrent users: p95 < 500ms, zero errors. Architecture uses stateless services, connection pooling, and horizontally scalable data layer | P1 |
| NFR-8 | Availability — the system should target high uptime | 99.5% uptime measured monthly (excludes planned maintenance windows) | P2 |
| NFR-9 | Data integrity — quiz scores must be tamper-proof. The server must track quiz session state (active question, serve timestamp). The client submits only answer choice and question ID. Server validates: (1) question belongs to active session, (2) answer received within time window, (3) each question answered at most once. Final score is computed server-side and written atomically | Score calculation and timer enforcement occur server-side; client cannot submit arbitrary scores; server rejects out-of-sequence or duplicate submissions | P0 |
| NFR-10 | PWA capability — the application should be installable on mobile devices | App serves a valid web manifest and service worker; passes Lighthouse PWA audit for installability | P2 |
| NFR-11 | Transport security — all client-server communication must occur over TLS 1.2+ | HTTP requests redirect to HTTPS; HSTS header set with min max-age of 1 year; no mixed content | P0 |
| NFR-12 | CSRF protection — all state-changing API requests must be protected against CSRF attacks | CSRF mitigation via SameSite cookie attribute (Strict) combined with origin header validation; all state-changing requests validate CSRF protections | P0 |
| NFR-13 | Input validation — all user-supplied input must be validated and sanitized | Topic names ≤ 100 chars, question text ≤ 500 chars, option text ≤ 200 chars, display names ≤ 50 chars. All inputs validated for length and character set; sanitized to prevent XSS, SQL injection, and HTML injection. Database queries use parameterized statements | P0 |
| NFR-14 | Audit logging — the system must log security-relevant events | Logs cover: successful/failed logins, password changes, role changes, account lockouts, admin CRUD operations. Logs include timestamp, user ID, action, IP address, and result. Logs retained for minimum 90 days. Logs must not contain plaintext passwords or tokens | P1 |
| NFR-15 | Observability — the system must emit structured logs and key metrics | API requests and errors logged with structured format. Key metrics (response time p50/p95/p99, error rate, active sessions) available via monitoring. Alerts fire when error rate exceeds 1% or p95 latency exceeds 1s over a 5-minute window | P2 |
| NFR-16 | Data backup and recovery — data must be recoverable in case of failure | Recovery Point Objective (RPO) ≤ 24 hours; Recovery Time Objective (RTO) ≤ 4 hours | P2 |

---

## Assumptions

- A-1: A single admin account will be pre-seeded or there will be an admin registration/promotion mechanism (out of scope for MVP — can be handled via direct DB/CLI seeding)
- A-2: Questions within a topic are all equally weighted — there is no concept of difficulty levels
- A-3: A player can play the same topic multiple times, and each quiz contributes to their cumulative score
- A-4: The global leaderboard includes all registered players, not just those who played a specific topic
- A-5: Social login (Google, GitHub) is deferred to post-V1 — email/password is the sole auth mechanism for launch
- A-6: Email verification infrastructure (SMTP or transactional email service) will be available as an external dependency
- A-7: "Display name" shown on the leaderboard is set during registration and is unique per user
- A-8: The question bank for a topic can grow beyond 10 questions — quizzes randomly select 10 each time
- A-9: No simultaneous multiplayer mode — players play independently and scores accumulate asynchronously
- A-10: A server-side grace period of up to 500ms beyond the 10-second window is acceptable for answer submission, accommodating network latency
- A-11: If a player disconnects mid-quiz, the session is forfeited — unanswered questions score 0. The quiz completes with whatever answers were submitted within time
- A-12: Admin quiz scores count toward the leaderboard. The system does not prevent admins from viewing answers before playing. This is accepted for MVP
- A-13: Deleting a topic removes it from the playable list and question bank but does NOT retroactively remove historical quiz scores from player totals or history. Historical entries show the topic name marked as "[deleted]"
- A-14: Deployments must be zero-downtime (rolling or blue/green). Planned maintenance windows are acceptable but must be communicated in advance

---

## Out of Scope

- OOS-1: Periodic leaderboards (weekly/monthly resets) — deferred to future iteration
- OOS-2: Per-topic leaderboards — deferred to future iteration
- OOS-3: Analytics dashboard (completion rates, difficulty analysis, drop-off rates) — deferred to future iteration
- OOS-4: Multiplayer/real-time competitive mode
- OOS-5: Question difficulty levels or adaptive difficulty
- OOS-6: Achievements, badges, or gamification beyond scoring
- OOS-7: Payment/subscription features
- OOS-8: Offline play or quiz caching (PWA is installable but requires connectivity)
- OOS-9: Admin role management UI (admin accounts seeded via backend mechanism)
- OOS-10: Internationalization / multi-language support
- OOS-11: Question media (images, audio, video) — text-only questions for MVP
- OOS-12: Admin session force-termination capability — deferred to future iteration
- OOS-13: Concurrent session limits beyond password-change invalidation — deferred to future iteration
- OOS-14: Social login (Google, GitHub) — deferred to post-V1 by human override
- OOS-15: Password breach database checking (HaveIBeenPwned) — deferred to post-V1 by human override; composition rules enforced instead

---

## Contributor Feedback Resolution

### Addressed from Security Architect

| Gap | Resolution |
|---|---|
| GAP-1: Rate limiting | Added FR-30 (auth rate limiting) and FR-31 (quiz submission rate limiting) |
| GAP-3: Session management | Added FR-29 (session expiry and password-change invalidation) |
| GAP-4: Password policy | Strengthened FR-1 with password strength requirements |
| GAP-5: Answer leakage | Added answer confidentiality requirement to FR-17 |
| GAP-6: Input validation | Added NFR-13 with specific length limits and sanitization rules |
| GAP-7: CSRF protection | Added NFR-12 |
| GAP-9: Password reset | Added FR-28 |
| GAP-10: Transport security | Added NFR-11 |
| GAP-2: Account lockout | Covered within FR-30 (progressive lockout on failed attempts) |
| GAP-8: Audit logging | Added NFR-14 |
| NFR-3 refinement | Changed from "or" to explicit httpOnly/Secure/SameSite=Strict cookies directive |
| NFR-9 refinement | Expanded with specific server-side validation steps |
| FR-4 refinement | Clarified API-layer enforcement regardless of frontend state |

### Addressed from Systems Architect

| Item | Resolution |
|---|---|
| 2.1: Timer grace window | Added A-10 (explicit 500ms grace period assumption), clarified in NFR-1 |
| 2.4: Cascade delete integrity | Rewrote FR-8 acceptance criteria; added A-13 |
| 3.2: Rate limiting | Covered by FR-30 and FR-31 |
| 3.3: Quiz session atomicity | Added FR-31 and A-11 |
| 3.1: Backup/recovery | Added NFR-16 |
| 3.4: Observability | Added NFR-15 |
| 3.5: Deployment strategy | Added A-14 |
| 4.1: Admin leaderboard integrity | Added A-12 (accepted trade-off for MVP) |

### Not addressed (with rationale)

| Item | Rationale |
|---|---|
| Security GAP-8: Admin force-terminate sessions | Deferred to OOS-12. For MVP, password-change invalidation provides adequate session control. Admin force-termination adds complexity without proportional value at this scale |
| Security: Concurrent session limits | Deferred to OOS-13. Single active quiz session (FR-31) addresses the scoring integrity concern. Browser session limits add UX friction for legitimate multi-device users |
| Systems 2.2: Small question bank UX | Acknowledged as known limitation per existing design. No requirement change needed — the minimum-10-questions rule (FR-13) already ensures playability. Exact-10 repetition is a content problem, not a system problem |
