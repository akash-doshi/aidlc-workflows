### Provided Prompt

Role: You are a solution architect. You understand how to architect complex systems.

Task: Create a file called components.yaml that details the components based on the requirements. A component is 

anything that has its own lifecycle and maybe deployed independently if we so choose.

Context: Why are we doing this. Once we have this output our next choice to figure out how we should split this into units. We may chose to build microservices and 1 frontend, we may choose monolith, or 1 backend and 1 front end, in order to do that though we need to understand the building blocks.

Output Format: component-format.yaml 

Requirements: requirements.md 


### Chat Response

| Component | Rationale |
|---|---|
| Authentication | Owns the entire identity lifecycle (registration, login, password reset, sessions, rate limiting). Has distinct security concerns, its own token/session state, and clear boundaries — changes to auth logic (e.g., adding OAuth later) shouldn't ripple into quiz or content logic. |
| API Gateway | Single enforcement point for cross-cutting concerns: authorization, CSRF, TLS, input validation, rate limiting. Separating this lets you swap or scale the routing/security layer independently of business logic. |
| Topic Management | Encapsulates the admin content-organization lifecycle (create/edit/soft-delete topics). Decoupled from questions so topic policy (uniqueness, naming rules) can evolve without touching question CRUD. |
| Question Management | Owns the question bank lifecycle (add/edit/delete questions, enforce structure rules). Separated from Topic Management because questions have their own validation rules, and from Quiz Engine because authoring and consumption are different concerns with different access patterns. |
| Quiz Engine | Owns real-time gameplay state: session creation, question selection, timer enforcement, answer validation, and atomic score computation. This is the most stateful and latency-sensitive component — isolating it allows independent scaling and focused performance optimization. |
| Scoring | Owns persistence of completed results and cumulative score aggregation. Separated from Quiz Engine because score history is a read-heavy, append-only concern with different data access patterns than active session management. |
| Leaderboard | Dedicated read-optimized ranking view. Separated because leaderboard queries (sort all players by score) are a distinct access pattern that benefits from caching or materialized views without coupling to the write path of scoring. |
| Web Application | The entire client-side UI and PWA shell. Has its own build/deploy lifecycle (static assets, service worker, manifest). Changes to the frontend (design, responsiveness, accessibility) ship independently of backend logic. |
| Email Service | Abstracts the external dependency on SMTP/transactional email. Isolating this lets you swap providers, add retry/queue logic, or stub it in dev/test without touching auth internals. |
| Audit Log | Cross-cutting observability concern (structured logs, metrics, alerting, retention policy). Separated so that logging infrastructure, retention rules, and monitoring can evolve independently. Multiple components write to it but none depend on its internal implementation. |

#### Each component has its own entities, clear behaviour, and explicit dependency/dependent-component relationships — giving you the building blocks to decide on deployment topology (monolith, microservices, or anything in between).

