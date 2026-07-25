# GTA Portal

Design and demo build of the **GTA Apprenticeship Portal** — role-based workspaces for learners, employers, teaching staff, mentors, and other GTA roles.

It started as a standalone Learner Lifecycle shell. It is now the living portal prototype used for design, walkthroughs, and stakeholder demos.

## Live demo (no local setup)

The portal is hosted on **Vercel**:

**[https://gta-portal.vercel.app](https://gta-portal.vercel.app)**

Open that URL in a browser to use the current build. You do **not** need to install dependencies or run anything locally for demos or reviews — the Vercel deployment is the shared source of truth for “what it looks like now.”

Source: [github.com/rchambers-dev/GTA-Portal](https://github.com/rchambers-dev/GTA-Portal) (`main` deploys to Vercel).

## What’s in the portal

Role-based workspaces (switch demo account from the portal chrome), including:

- **Learner** — dashboard, learning, modules, CEA, OTJ hours, progress, reviews, attendance, CV, messages, support
- **Employer** — dashboard, apprentice overview, OTJ agreement, reviews, messages, support & concerns
- **Staff / mentor / curriculum / quality / safeguarding / admin** — operational workspaces and shared queues

Demo data uses **fictional names only** — no real learner data.

## Optional: run locally (development only)

Only needed if you are changing code. For viewing or demos, use the Vercel URL above.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build check
npm run lint
npm test
```

## Architecture notes

| Path | Role |
|------|------|
| `src/features/*` | Feature modules (learner portal, lifecycle, mentor tools, etc.) |
| `src/shell`, `src/app`, `src/adapters` | Portal chrome, routes, and demo/fictional adapters |
| `docs/architecture/` | Stage architecture docs |

Auth.js, Prisma, and real integrations are planned later; the current build uses ports + fictional adapters for demos.
