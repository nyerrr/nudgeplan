# NudgePlan Frontend (React Native + Expo + TypeScript)

## Setup

```powershell
cd frontend
npm install
```

## Run

### Option A: Web browser (no phone, no emulator needed)

```powershell
npx expo start --web
```

Opens at http://localhost:8081. This is the fastest way to iterate when you
do not have an Android device. The API defaults to `http://localhost:8001`,
which is already correct for web.

### Option B: Android emulator (requires Android Studio)

```powershell
npx expo start
```

Press `a`. The emulator reaches the backend at `http://10.0.2.2:8001`
(this default is set in `src/api/plan.ts`).

### Option C: Physical Android phone (requires Expo Go)

Your phone and PC must be on the same WiFi. Set your PC's LAN IP in
`frontend/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:8001
```

Find your LAN IP with `ipconfig` (look for IPv4 Address).

## API URL defaults

| Target              | URL                     |
| ------------------- | ----------------------- |
| Web / iOS simulator | `http://localhost:8001` |
| Android emulator    | `http://10.0.2.2:8001`  |

`EXPO_PUBLIC_API_URL` overrides all of these.

## Navigation

Routing is file-based via [expo-router](https://docs.expo.dev/router/introduction/).
The file tree *is* the navigation structure.

```
app/
  _layout.tsx            Root stack: tabs + the three modal flows
  (tabs)/
    _layout.tsx          Bottom tab bar
    index.tsx            Today     - daily plan, energy, Reality Check summary
    dump.tsx             Dump      - conversational brain dump
    plan.tsx             Plan      - every task, filterable
    you.tsx              You       - preferences and settings
  confirm.tsx            Modal - review and tune extracted tasks
  reality-check.tsx      Modal - hours + energy, then suggested changes
  task/[id].tsx          Modal - one task, with its micro-steps
```

The core loop is:

```
Dump  ->  Confirm  ->  Reality Check  ->  Today
```

`Today` is the landing surface. `Dump` is where you get things out of your
head. `Plan` holds everything else. `You` holds defaults.

## Project layout

```
src/
  theme.ts              Design tokens: colours, spacing, radii, type scale
  api/plan.ts           Backend client + response validation (the Micro-Step Guard)
  components/
    ui.tsx              Primitives: Button, Card, Chip, Checkbox, StatTile...
    task.tsx            TaskCard, PendingTaskCard, EnergySelector, StepEditor
  data/dumpPrompts.ts   Example brain-dump prompts shown as tap targets
  lib/realityCheck.ts   Reality Check Engine (capacity vs. workload rules)
  lib/time.ts           Minute/date formatting and greeting helpers
  lib/a11y.ts           Platform-aware accessibility state helper
  store/PlanContext.tsx App state (tasks, pending tasks, check-in)
```

## Data flow

There is no seed data. The app starts empty and only fills up from a real
request to the backend:

```
POST /ai/plan { text }
  -> { tasks: [{ title, minutes, energy, priority, due, steps }],
       breakdown, model }
  -> src/api/plan.ts  normalises every field again (never trusts the network)
  -> store.pending    editable on the Confirm screen
  -> store.tasks      committed to the plan
```

`src/api/plan.ts` and `backend/main.py` apply the same guard: missing fields
get defaults, minutes are clamped to 5-480 and rounded to 5, unknown energy or
priority falls back to `medium`, and a task with no steps gets a synthetic
first step. A malformed model response produces zero tasks instead of invented
ones, and the Dump screen asks the user to rephrase.

## Design system

- One dark theme, tuned for low light. Surfaces are low-chroma so task
  content is the only saturated thing on screen.
- Energy is colour coded: red (low), amber (medium), green (high).
- Minimum touch target is 44pt. Tap targets have generous hit slop.
- All interactive controls carry ARIA state. `src/lib/a11y.ts` exists because
  react-native-web ignores React Native's `accessibilityState` prop and only
  reads flat `aria-*` attributes - spreading `a11yState()` gives each
  platform the shape it understands.

## Current features

- Brain dump text input, calling the live `POST /ai/plan` backend
- Structured task extraction (time, energy, priority, due date, micro-steps)
  produced by Gemini, with a validated fallback when the model misbehaves
- Extracted task confirmation with per-task editing
- Reality Check: available hours + energy level, workload vs capacity,
  suggested changes computed from the actual tasks when the plan does not fit.
  The engine ranks by priority first, so the lowest-priority task is offered up
  before anything else; tasks due today **and** high priority are pinned and
  never suggested (the UI says the day is a hard limit instead). Applying a
  suggestion sets the task's due date to tomorrow, and "Move all N to tomorrow"
  applies the whole set in one tap.
- Daily plan with micro-steps, completion checkboxes, and progress
- Today and Reality Check share one yardstick: energy-adjusted capacity
  (`availableHours x ENERGY_FACTOR`), so the two screens never disagree
- Plan tab with multi-select delete: pick the tasks the planner got wrong (or
  select all shown) and remove them behind a two-step confirm
- Task detail with editable micro-steps, rescheduling, and deletion
- Task list with All / Today / Later / Done filters
- Preferences for typical hours, usual energy, and notification defaults
- Live backend status (model name, online/offline) on the You screen

## Known limits

- State is in memory. Reloading the page clears the plan (Supabase lands in
  Phase 3).
- Notification toggles are UI only; no push scheduling yet.
- `GEMINI_MOCK=true` on the backend swaps Gemini for a local heuristic planner
  so the app is still usable with no API key.

