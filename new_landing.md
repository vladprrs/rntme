§01 — Hero

Eyebrow: rntme · pilot program · 2026
H1: Your AI agent is a fast coder, but a terrible architect.
Lede: You built an internal tool with Cursor in a weekend. Awesome. A month later, it's an insecure, unmaintainable mess. Changing one button burns through your context window, breaks the database, and forces a rewrite.
Pitch: rntme is a safe runtime for AI-generated apps. Instead of letting your agent hallucinate a sprawling codebase, you let it write a single JSON blueprint. The runtime strictly validates it and instantly boots a working API and declarative UI. No architectural rot.
CTAs:
Apply as a pilot team → → Tally form
See it on GitHub → GITHUB_URL
Meta row (4 cells):
Architecture → event-sourced
Input → validated JSON
Output → API + UI + events
Pilot cohort → 10 teams
§02 — MicroJobs

Marker: §02 · Core job / Three things, end-to-end
Label: Core job
H2: Scale your AI-generated tools without the technical debt.
Card 01

Title: Force your agent to describe intent, not implementation.
Action: Instead of generating thousands of lines of React and Node.js, your agent writes a single JSON blueprint defining the domain, state transitions, and UI screens.
Value: → The AI doesn't invent security flaws, messy database migrations, or weird state management. It just maps the business logic.
Card 02

Title: Boot API and UI on a battle-tested runtime.
Action: The runtime compiles the blueprint and automatically serves a Hono HTTP API, a declarative React UI, and an event-sourced SQLite backend.
Value: → You stop reviewing sprawling, unmaintainable pull requests. The runtime guarantees the architecture is sound.
Card 03

Title: Make changes without exhausting your context window.
Action: Need a new approval step? The agent updates 10 lines in the JSON blueprint. The validator enforces invariants before anything runs.
Value: → No more "AI broke the app, time to rewrite from scratch." You edit blueprints; the runtime safely applies the changes.