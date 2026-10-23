# Pinfo — Antigravity Guardrails

These rules apply to every phase of development.

## Project

- **Project:** Pinfo, an AI-powered packaged food and beverage intelligence web app.
- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui frontend; Python FastAPI + Pydantic backend; Open Food Facts for product data; Gemini API (server-side only).

## Rules

1. Inspect the existing project and relevant files before editing anything.
2. Read the project docs and config first (`README.md`, `docs/architecture.md`, `docs/ANTIGRAVITY_RULES.md` if they exist).
3. Implement ONLY the phase described below.
4. Follow the approved architecture and directory structure in `docs/architecture.md`.
5. Do not introduce a different framework or replace the stack without asking me.
6. Do not rewrite unrelated files.
7. Do not regenerate the whole project to change one feature.
8. Preserve existing working functionality.
9. Use real integrations where specified. Never replace them with fake responses.
10. Never invent successful API results.
11. Keep all secrets server-side. Never put keys in frontend code, logs, commits or chat.
12. Use typed interfaces and input validation.
13. Include loading, success, empty, error and fallback states.
14. Add or update relevant tests.
15. Run the lint, type-check, build and test commands that apply to this phase.
16. If a command fails, diagnose and report it. Do not hide or skip it.
17. Do not silently delete dependencies or configuration.
18. Do not install unnecessary packages. Explain each new dependency.
19. Do not mark anything complete unless it meets the acceptance criteria.
20. If a requirement is ambiguous or a change is destructive, stop and ask me first.
21. Do not claim tests passed unless you actually ran them and they passed.
22. Do not proceed to the next phase.

## Additional Rules

- Never hard-code package versions from memory. Use what the package registry actually installs, then record the real versions.

## End-of-Phase Report (Required)

Each phase must end with a report covering:

- What was implemented
- Files created or modified
- Commands executed
- Tests that actually passed or failed (with real output summary)
- Known issues
- Environment variables I must configure
- Manual checks I should perform
- Whether each acceptance criterion is met (yes / no / partial, with evidence)
- The exact next step
