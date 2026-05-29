# CLAUDE.md — Ad Studio Architecture Reference

This file is the source of truth for AI assistants working in this repo.
Read it before writing any code.

---

## What This Project Is

A production-quality AI ad creation tool (modeled after Vibe.co/studio).
Users paste a business URL → the system crawls it → generates a 30-second video ad
concept → user edits it in a timeline editor → exports it.

This is a **client pitch prototype**. Code quality and visual polish are the evaluation
criteria. Every decision must look like it was made by a senior engineer, not generated
by an AI coding tool.

---

## Monorepo Structure

```
ad-studio/
├── packages/
│   ├── client/          # React 18 + TypeScript + Vite frontend
│   └── server/          # Node.js + Express + TypeScript backend
├── infrastructure/
│   ├── oracle/          # Terraform stubs for Oracle Cloud
│   └── docker/          # Docker utilities
├── docker-compose.yml   # Local dev orchestration
├── .env.example         # Environment variable template
└── CLAUDE.md            # This file
```

---

## Tech Stack Decisions (WITH justification)

| Concern | Choice | Why |
|---|---|---|
| Frontend framework | React 18 | Hooks ecosystem, concurrent features, industry standard |
| Build tool | Vite (NOT CRA) | ESM-native, instant HMR, no webpack config hell |
| State management | Zustand (NOT Redux) | Minimal boilerplate, hooks-native, no Provider wrapping |
| Styling | CSS Modules + design tokens | Scoped styles, no class soup, tokens enforce consistency |
| Backend runtime | Node.js + Express | FFmpeg bindings, Puppeteer, stream support |
| Crawling | Puppeteer | Full JS rendering, screenshot capability, asset extraction |
| Background jobs | BullMQ + Redis | Reliable job queues for crawl/generate/render pipeline |
| Video composition | FFmpeg (server) + Canvas (client preview) | Server handles real export, canvas for real-time preview |
| Storage abstraction | Interface pattern | Swap local → Oracle Object Storage without changing callers |
| WebSockets | `ws` library | Real-time crawl progress updates to client |
| Logging | Winston | Structured logs, levels, transport config — never console.log |

---

## Design System Rules

**Never use:**
- Raw Tailwind utility class soup
- Inter, Roboto, or system fonts
- Generic component libraries (MUI, Chakra)
- Fully rounded elements (border-radius: 9999px on everything)
- Purple gradients on white backgrounds
- `alert()` or `window.confirm()`

**Always use:**
- CSS custom properties from `src/styles/tokens.css`
- Plus Jakarta Sans (headings), DM Sans (body), JetBrains Mono (technical)
- Custom modals for confirmations
- Design token spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px
- Border radius: 6px (interactive), 12px (cards), 16px (containers)

**Color palette (defined in tokens.css):**
- `--color-bg`: #0A0A0F
- `--color-surface`: #14141F
- `--color-surface-elevated`: #1E1E2E
- `--color-primary`: #3B82F6 (sparingly — primary actions only)
- `--color-secondary`: #8B5CF6 (AI-generated content indicators)
- `--color-text-primary`: #F1F5F9
- `--color-text-secondary`: #94A3B8

---

## Code Quality Non-Negotiables

1. **TypeScript strict mode** — zero `any` types, interfaces for everything
2. **No `console.log`** — use the Winston logger from `server/src/config/logger.ts`
3. **No hardcoded values** — all config via environment variables
4. **Service layer on backend** — controllers call services, never contain business logic
5. **Custom hooks on frontend** — every reusable behavior gets a `use*` hook
6. **Every async operation has 3 states**: loading, error, success — with UI for each
7. **Error boundaries** in React with proper fallback UI
8. **Components max ~150 lines** — split if larger
9. **Comments explain WHY, not WHAT** — architecture decisions, not code narration
10. **No `placeholder.com` images** — extract real assets or use canvas-generated placeholders

---

## Feature Modules (frontend)

| Module | Path | Responsibility |
|---|---|---|
| url-intake | `features/url-intake/` | URL input form, crawl progress, asset review panel |
| ad-preview | `features/ad-preview/` | Custom video player, regenerate options |
| ad-editor | `features/ad-editor/` | Timeline editor, properties panel, canvas preview |
| export | `features/export/` | Format selection, resolution, download trigger |

---

## Backend Services

| Service | Path | Responsibility |
|---|---|---|
| crawler | `services/crawler/` | Puppeteer crawl, asset extraction, color detection |
| ai | `services/ai/` | AI orchestration (voiceover, script gen) — mock + interface |
| media | `services/media/` | FFmpeg composition, canvas export |
| storage | `services/storage/` | File I/O abstraction — local now, Oracle Object Storage interface |

---

## Custom Hooks (to build)

- `useMediaTimeline` — timeline state machine (tracks, clips, playhead)
- `useCrawlProgress` — WebSocket connection to crawl job status
- `useVideoPlayer` — custom player controls (play, pause, scrub, fullscreen)
- `useAdProject` — project CRUD (create, load, save, delete)

---

## Build Order

1. Foundation (DONE): directories, config files, design tokens
2. Design system: base components (Button, Input, Modal, Skeleton, Progress)
3. Backend services: crawler → AI mock → storage abstraction
4. Backend API routes + WebSocket server
5. Frontend: URL intake feature
6. Frontend: Ad preview feature
7. Frontend: Timeline editor
8. Frontend: Export dialog
9. README.md with Mermaid architecture diagram
10. Final review pass: types, error handling, loading states, empty states

---

## Oracle Cloud Notes

- Container Instances for both client (nginx) and server (node)
- Oracle Object Storage for generated assets (abstracted behind storage service)
- Autonomous Database (optional) for project persistence
- Terraform stubs in `infrastructure/oracle/`
- All cloud config via environment variables — never baked into code
