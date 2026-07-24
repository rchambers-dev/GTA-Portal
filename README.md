# GTA Learner Lifecycle (modular feature)

Standalone development shell for the **Learner Lifecycle**, weekly Kanban, and **Digital Apprenticeship Evidence Pack**.

This is **not** a permanently separate product. After design approval, the permanent feature module integrates into the main GTA portal.

## Architecture split

| Path | Permanence |
|------|------------|
| `src/features/learner-lifecycle` | **Permanent** — screens, components, types, ports |
| `src/components/ui` | Portable shared primitives |
| `src/shell`, `src/app`, `src/adapters` | **Temporary** standalone scaffolding / replaceable adapters |

See `docs/architecture/` for Stage 1 documentation.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (redirects to `/learners/lifecycle`).

## Stage status

- ✅ Stage 1 — architecture docs
- ✅ Stage 2 — portal shell + board/workspace layout with fictional adapters
- ⏳ Stage 3 — Prisma schema + seed (next)

## Notes

- Website/portal is **not** modified in this stage.
- Fictional names only — no real learner data.
- Auth.js and Prisma are approved for later stages; Stage 2 uses ports + fictional adapters.
