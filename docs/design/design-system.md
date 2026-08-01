# Legal AI — Design System · Handoff Specification (v2)

> **Purpose.** A self-contained source of truth for the Legal AI platform design system.
> Hand this file to another chat as context: it is enough to build UI **without repository access**.
> All values are exact and ready to use.
>
> **v2 adds** (from a design critique) the layers that make interaction _pleasant for a non-technical
> lawyer_: motion, elevation & z-index, Human-in-the-Loop & citations, data tables, empty/loading
> states, voice & tone, and target-size rules. New material is flagged **[v2]**.
>
> **Stack:** React 19 + Vite + TypeScript + Tailwind CSS 4. Typeface Geist (self-hosted via `@fontsource`).
> Icons Lucide (`lucide-react`). Theme: light by default + dark via `<html data-theme="dark">`.
> UI languages: `uk` (default) · `ru` · `en`. In-product strings are Ukrainian (examples kept in Ukrainian).

---

## 0. Philosophy — "calm confidence"

This is a legal product; the cost of a mistake is a courtroom. Trust is built through **calm, tidiness, predictability**, not a wow-effect. Reference points: Claude · Linear · Stripe — a warm-neutral "paper" background, plenty of air, a single restrained accent, shadows instead of heavy borders. Not "a startup with gradients" and not "a government portal".

**Three rules that keep the system coherent (a violation breaks it silently — reviewed first):**

1. **Zero "magic" values.** Color, spacing, radius, shadow, duration — tokens only. No token yet → add a token, never hardcode a raw value in a component.
2. **A component does not know about the theme.** Use `bg-paper`, not `bg-white dark:bg-slate-900`. The theme flips at the CSS-variable layer.
3. **A component does not know about language.** No strings in JSX — dictionary keys only.

**Primary user of the UI:** the lawyer (non-technical) — non-technical, possibly older, works with dense text all day, and pays the price for any error. Every ambiguous design call is resolved in favor of _her clarity and calm_, not information density.

---

## 1. Color tokens

Two layers: **primitives** (raw palette, never used directly in components) and **semantic tokens** (the only ones that reach Tailwind and markup). The neutral is **warm** (paper `#FAF9F5`, not cold `#FFFFFF`) — a deliberate choice.

### 1.1 Semantic tokens — surfaces and ink

| Token      | Tailwind class      | Light     | Dark                  | Purpose                 |
| ---------- | ------------------- | --------- | --------------------- | ----------------------- |
| canvas     | `bg-canvas`         | `#FAF9F5` | `#020617` (slate-950) | page background         |
| paper      | `bg-paper`          | `#FFFFFF` | `#0F172A` (slate-900) | cards, surfaces         |
| paperAlt   | `bg-paperAlt`       | `#FBFAF7` | `#131C2E`             | secondary surfaces      |
| line       | `border-line`       | `#ECEAE3` | `#1E293B` (slate-800) | borders, dividers       |
| lineStrong | `border-lineStrong` | `#E0DCD2` | `#293548`             | strong borders (inputs) |
| ink        | `text-ink`          | `#1F1E1B` | `#E2E8F0` (slate-200) | primary text            |
| inkSoft    | `text-inkSoft`      | `#6B6862` | `#94A3B8` (slate-400) | secondary text          |
| inkMute    | `text-inkMute`      | `#9B978E` | `#64748B` (slate-500) | muted text              |

### 1.2 Accent — the only one

| Token        | Tailwind class            | Light     | Dark                   | Purpose                     |
| ------------ | ------------------------- | --------- | ---------------------- | --------------------------- |
| brand        | `bg-brand` / `text-brand` | `#2563EB` | `#60A5FA` (blue-400)   | primary actions, active nav |
| brand tint   | `bg-brand/10`             | `#EEF3FE` | `rgba(96,165,250,.12)` | accent backing              |
| brand border | `border-brand/20`         | `#DBE6FD` | `rgba(96,165,250,.28)` | accent border               |

**Rule:** blue is for primary actions and the active navigation state only. Everything else is neutral. One accent keeps the system coherent.

### 1.3 Status semantics — muted, never neon

| Token  | Tailwind class                 | Light     | Dark                  | Meaning         |
| ------ | ------------------------------ | --------- | --------------------- | --------------- |
| ok     | `text-ok` / `bg-ok/10`         | `#2E7D5B` | `#4ADE80` (green-400) | done / success  |
| warn   | `text-warn` / `bg-warn/10`     | `#B7791F` | `#FBBF24` (amber-400) | attention       |
| danger | `text-danger` / `bg-danger/10` | `#BC4334` | `#F87171` (red-400)   | problem / error |

**Status is a subsystem.** Status color is set **only** via `<Badge tone=…>` or the health mapping. Status color is never written by hand in markup.

> **[v2] Contrast caveat.** `text-warn #B7791F` on `bg-warn/10` and `text-danger`/`text-ok` on their tints must be verified at **≥ 4.5:1** before shipping (amber-on-light is the classic failure). If a status _label text_ falls below AA, darken the text token for that pairing — do not lighten the tint (the tint must stay quiet). Status used as a large dot/fill is exempt (non-text).

### 1.4 CSS variables (source, `src/index.css`)

Values are space-separated RGB triplets so Tailwind's `rgb(var(--x) / <alpha-value>)` supports opacity (`bg-warn/10`).

```css
:root {
  color-scheme: light;
  --c-canvas: 250 249 245; /* #FAF9F5 */
  --c-paper: 255 255 255; /* #FFFFFF */
  --c-paper-alt: 251 250 247; /* #FBFAF7 */
  --c-line: 236 234 227; /* #ECEAE3 */
  --c-line-strong: 224 220 210; /* #E0DCD2 */
  --c-ink: 31 30 27; /* #1F1E1B */
  --c-ink-soft: 107 104 98; /* #6B6862 */
  --c-ink-mute: 155 151 142; /* #9B978E */
  --c-brand: 37 99 235; /* #2563EB */
  --c-ok: 46 125 91; /* #2E7D5B */
  --c-warn: 183 121 31; /* #B7791F */
  --c-danger: 188 67 52; /* #BC4334 */
}
[data-theme="dark"] {
  color-scheme: dark;
  --c-canvas: 2 6 23;
  --c-paper: 15 23 42;
  --c-paper-alt: 19 28 46;
  --c-line: 30 41 59;
  --c-line-strong: 41 53 72;
  --c-ink: 226 232 240;
  --c-ink-soft: 148 163 184;
  --c-ink-mute: 100 116 139;
  --c-brand: 96 165 250;
  --c-ok: 74 222 128;
  --c-warn: 251 191 36;
  --c-danger: 248 113 113;
}
```

---

## 2. Typography

A single grotesque, **Geist** (weights 400/500/600/700, latin + cyrillic), plus **Geist Mono** for tokens, ids and `{{variables}}`. The scale is fixed — 5 sizes. Splitting the size (`text-[10px]`, `text-[11px]`) is forbidden.

| Role            | Size / weight  | Extra                                      | Example                             |
| --------------- | -------------- | ------------------------------------------ | ----------------------------------- |
| H1 / Display    | 24px / 600     | tracking −0.02em                           | service title                       |
| H2 / Heading    | 18px / 600     | —                                          | screen section                      |
| Label / section | 13px / 600     | UPPERCASE, tracking 0.07em, `text-inkMute` | "ЧЕРГА НА РЕВ'Ю"                    |
| Body            | 15px / 400     | line-height 1.6                            | primary text (baseline, no smaller) |
| Meta            | 12px / 400–500 | `text-inkMute`                             | "2 дні тому · 24 поля"              |
| Mono            | 12–13px        | `text-brand`                               | `first_name`, `art. 180 CK`         |

```
font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, monospace
```

Use `font-variant-numeric: tabular-nums` for any column of numbers (prices, counts, dates in tables) so digits align.

---

## 3. Grid, radii, shadows

- **Base unit — 4px.** All spacing is a multiple: 4 · 8 · 12 · 16 · 24 · 32 · 48.
- **Radii:** `rounded-card` = **14px** (cards), `rounded-btn` = **12px** (inputs), buttons effectively **10px**, chips 8px, pill 999px.
- **Layout:** content max-width **1040–1200px**, centered; comfortable page padding `clamp(20px, 5vw, 64px)`. Breakpoints (Tailwind default): `sm 640 · md 768 · lg 1024 · xl 1280`. Admin is desktop-first but must stay usable on a tablet (lawyer may review on an iPad).

---

## 4. [v2] Elevation & layering

Two card shadows are not enough — overlays need their own level, and layering needs a fixed z-scale or modals/toasts collide.

### 4.1 Elevation ladder

| Level | Token               | Light value                                                   | Use                        |
| ----- | ------------------- | ------------------------------------------------------------- | -------------------------- |
| e0    | —                   | none                                                          | flush elements, table rows |
| e1    | `shadow-card`       | `0 1px 3px rgba(31,30,27,.04)`                                | resting card               |
| e2    | `shadow-card-hover` | `0 4px 16px rgba(31,30,27,.06)`                               | hovered/active card        |
| e3    | `shadow-pop`        | `0 4px 12px rgba(31,30,27,.10), 0 2px 4px rgba(31,30,27,.05)` | dropdown, popover, tooltip |
| e4    | `shadow-modal`      | `0 24px 48px rgba(31,30,27,.16)`                              | dialog, sheet              |

**Backdrop** (behind modals/sheets): `bg-ink/32` in light, `bg-black/60` in dark; optional `backdrop-blur-sm`.

> **[v2] Dark-theme rule (critical).** Shadows are nearly invisible on `slate-950`. In dark, elevation is carried by **`border-line` + a slightly lighter `paper`**, not by shadow. Every card/overlay must have a 1px border so it never dissolves into the background. This is the #1 place dark mode breaks silently.

### 4.2 z-index scale (tokens, never raw numbers)

```
--z-base: 0
--z-sticky: 100     /* sticky table header, topbar */
--z-dropdown: 200   /* menus, popovers, tooltips */
--z-sheet: 300      /* side sheet */
--z-modal: 400      /* dialog + its backdrop */
--z-toast: 500      /* notifications, always on top */
```

---

## 5. [v2] Motion

Motion is how "calm confidence" is _felt_. The rule: subtle, quick, never bouncy. `framer-motion` is available but most transitions are plain CSS.

```
--motion-fast: 120ms   /* hover, focus, color */
--motion-base: 180ms   /* enter/exit, expand, tab switch */
--motion-slow: 280ms   /* modal/sheet open, larger moves */

--ease-out:    cubic-bezier(0.2, 0, 0, 1)     /* default — decelerate on entry */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)   /* moves that start and stop on screen */
```

Rules: animate `opacity` and `transform` only (not layout properties). No spring/overshoot — this is a legal tool, not a game. Modals fade + rise 8px; dropdowns fade + rise 4px; toasts slide in from the edge. **Always** wrap in `@media (prefers-reduced-motion: reduce)` → transitions collapse to none.

---

## 6. Icons

One set — **Lucide** (`lucide-react`, already a dependency), monochrome, **1.5px** stroke, size 16–20. A full replacement for emoji (emoji render differently across OSes, carry their own color/weight, and read as unserious in a legal context). **Exception** — the health dot: it is a color indicator, not an icon.

```tsx
import {
  Scale,
  Eye,
  Pencil,
  Trash2,
  Search,
  Plus,
  MessageSquare,
  FileText,
  Sparkles,
  BadgeCheck,
  Quote,
} from "lucide-react";
<Eye size={17} strokeWidth={1.7} />;
```

**[v2] Canonical icon mapping** (one concept → one icon, everywhere): law/service `Scale` · document `FileText` · comment `MessageSquare` · request `Inbox` · law-change `GitPullRequest` · view `Eye` · edit `Pencil` · delete `Trash2` · AI-suggested `Sparkles` · human-confirmed `BadgeCheck` · citation `Quote`.

---

## 7. Domain systems

Legal-platform specifics: here color **encodes data**, it does not decorate.

### 7.1 Graph node ladder: `law → article → service → document`

| Kind  | Label (uk) | Stripe    | Tint      |
| ----- | ---------- | --------- | --------- |
| `law` | Закон      | `#0E4D6E` | `#E6EEF3` |
| `art` | Стаття     | `#1B6CA8` | `#E8F0F7` |
| `srv` | Послуга    | `#2563EB` | `#EEF3FE` |
| `doc` | Документ   | `#7FA8D0` | `#EDF3F9` |

The blue ladder from deep navy to light = built-in "classic/trust": from the source of law to the result.

### 7.2 Health traffic light (service state)

| Health    | Dot       | Label (uk)       | Meaning                                     |
| --------- | --------- | ---------------- | ------------------------------------------- |
| `ok`      | `#2E7D5B` | Готова до роботи | form and document are consistent            |
| `warn`    | `#B7791F` | Потребує уваги   | template expects data the form does not ask |
| `problem` | `#BC4334` | Проблема         | document cannot be assembled without a fix  |

### 7.3 Lifecycle statuses (single `<StatusBadge>`)

- Service: `draft → active → paused → archived`
- Order: `new → paid → generating → lawyer_review → done → cancelled`

One component, one status→tone mapping. Status color is defined nowhere else.

---

## 8. [v2] Human-in-the-Loop & citations — the trust layer

The whole product is "AI proposes → the lawyer verifies". The lawyer must **instantly** see what is machine-suggested versus human-confirmed, and **where every fact came from**. This is the single most important trust surface, so it is a first-class part of the design system, not ad-hoc styling.

### 8.1 Provenance marker `<Provenance state>`

| State       | Visual                                                                                  | Copy (uk)              |
| ----------- | --------------------------------------------------------------------------------------- | ---------------------- |
| `ai`        | `Sparkles` 14px in `text-brand`, `bg-brand/8`, **dashed** left border `border-brand/40` | «Запропоновано AI»     |
| `confirmed` | `BadgeCheck` 14px in `text-ok`, `bg-ok/8`, **solid** left border `border-ok/40`         | «Підтверджено юристом» |
| `edited`    | `Pencil` 14px in `text-inkSoft`                                                         | «Змінено юристом»      |

A block awaiting review carries the `ai` marker; once the lawyer approves, it flips to `confirmed`. The state change is the core interaction of the app — make it obvious and satisfying (subtle `--motion-base` transition, marker morphs blue→green).

### 8.2 Confidence — two levels, never a fake percentage

Do **not** show "87.3%": false precision erodes a lawyer's trust. Two states only:

- `high` → no chrome (quiet is the signal of confidence)
- `needs-review` → `Badge tone="warn"` «Варто перевірити»

### 8.3 `<Citation>` component — source of every fact

A fact extracted by AI must sit next to its source. Format: mono chip, `text-brand`, `Quote` icon, e.g. `art. 180 СК`. On hover/focus → popover (`shadow-pop`) with the exact quoted passage and a link to the source document/article node. A fact with **no** citation renders a `danger` marker «Без джерела» — an unsourced legal claim is a bug, not a neutral state.

---

## 9. Component library

Lives in `packages/ui/src/components`; the showcase is `DesignKitPage` (`/design`).

### 9.1 Button — `variant: primary | secondary | ghost | danger`

Base: `inline-flex items-center justify-center gap-2 rounded-[10px] px-[18px] py-2.5 text-sm font-medium transition-colors disabled:opacity-50`

| Variant   | Classes                                                           |
| --------- | ----------------------------------------------------------------- |
| primary   | `bg-brand text-white shadow-card hover:bg-brand/90`               |
| secondary | `bg-paper text-ink border border-lineStrong hover:bg-paperAlt`    |
| ghost     | `bg-transparent text-brand hover:bg-brand/10`                     |
| danger    | `bg-paper text-danger border border-danger/30 hover:bg-danger/10` |

**States (all required):** default · hover · **focus-visible** (ring `ring-2 ring-brand/40`) · active (`scale-[.98]`) · disabled (`opacity-50`) · **loading** (`Spinner` 14px replaces leading icon, label stays, button disabled). **IconButton:** see target-size rule in §12 — **40×40 minimum**, `rounded-[10px]`, `bg-paper border border-lineStrong text-inkSoft hover:bg-paperAlt`, `aria-label` required.

### 9.2 Input / Textarea / Label / FormField

- Label: `text-[12.5px] font-semibold text-inkSoft mb-1.5`
- Input: `w-full px-3.5 py-2.75 rounded-[10px] border border-lineStrong bg-paper text-ink text-sm placeholder:text-inkMute`
- Focus (visible ring required): `focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15`
- Textarea: same + `resize-y min-h-[62px]`
- **[v2] FormField wrapper** = Label + control + optional hint (`text-inkMute text-xs`) + **error** (`text-danger text-xs` with an `AlertCircle` 13px icon — never color alone). Error state also sets `border-danger` and `aria-invalid`.

### 9.3 Badge — `tone: ok | warn | danger | brand | neutral`

`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-semibold` + optional dot.

| Tone    | Pill                       | Dot          |
| ------- | -------------------------- | ------------ |
| ok      | `bg-ok/10 text-ok`         | `bg-ok`      |
| warn    | `bg-warn/10 text-warn`     | `bg-warn`    |
| danger  | `bg-danger/10 text-danger` | `bg-danger`  |
| brand   | `bg-brand/10 text-brand`   | `bg-brand`   |
| neutral | `bg-paperAlt text-inkSoft` | `bg-inkMute` |

### 9.4 Chip — `tone: used | extra | missing` (document anatomy)

`inline-flex px-2.25 py-0.75 rounded-lg font-mono text-xs font-medium border`. used→ok, extra→warn, missing→danger.

### 9.5 ReviewItem — single inbox (comments / requests / law changes)

Title, timestamp, body, actions. **"Resolved" is an obvious action button, not a status badge.** Resolved item is muted, body collapsed, action "↩ reopen". One component instead of three near-identical inboxes.

### 9.6 ServiceCard — composite

Icon (in `bg-brand/10`) + title + description → metadata row (health dot + N fields + N tabs + price) → footer: status `<Badge>` + IconButtons (view / edit / delete).

### 9.7 ConfirmModal + useConfirm()

Single replacement for native `window.confirm`. Imperative: `await confirm({ title, body, variant: 'danger'|'warn'|'info', confirmLabel })` → `true/false`. Elevation `shadow-modal`, backdrop per §4, traps focus, closes on `Esc`.

### 9.8 [v2] Table — the lawyer's most-used screen

Lists dominate legal work (services, laws, requests, law-changes). Spec:

- Container: `bg-paper border border-line rounded-card overflow-hidden`.
- Header: `bg-paperAlt`, section-label typography, **sticky** (`--z-sticky`), sortable columns show a `ChevronsUpDown`/`ChevronUp` in `text-inkMute`.
- Row: height **48px** (comfortable), `border-b border-line`, `hover:bg-paperAlt`. Prefer horizontal lines over zebra striping (calmer).
- Selected row: `bg-brand/5` + 2px left `border-brand`.
- Alignment: text left; **numbers/dates right** with `tabular-nums`; status centered.
- Empty table → EmptyState (§9.10) inside the body, not a blank grid.
- Density toggle optional; default is **comfortable** for the lawyer, not compact.

### 9.9 [v2] Skeleton & loading

- Skeleton blocks: `bg-paperAlt rounded-[8px]`, gentle shimmer (`--motion-slow`, disabled under reduced-motion). Mirror the real layout (card skeleton = card shape), never a generic spinner page.
- Inline pending: `Spinner` (Lucide `Loader2` spinning) 14–16px in `text-inkMute`.
- **AI generation state:** distinct from plain loading — `Sparkles` + progress copy «Готуємо документ…» / streaming text as it arrives, with a calm indeterminate bar. Never leave the lawyer staring at a frozen screen while the model works.

### 9.10 [v2] EmptyState

Large muted Lucide icon (28–32px, `text-inkMute`), a warm one-line title, an optional supporting line, a primary action. Tone example: «Ще немає послуг» / «Створіть першу — це швидко» / `[+ Нова послуга]`. Never "No data".

### 9.11 [v2] Toast / Alert

Toast: `--z-toast`, top-right, `shadow-pop`, auto-dismiss 4–6s (errors persist until dismissed), tone via left border + icon, max 1–2 at once. Alert (inline): tone tint background + icon + text, for page-level context.

### 9.12 Bootstrap set v0 — status

- **Base:** Button ✓ · Input ✓ · Textarea ✓ · **FormField [v2]** · Select · Checkbox · Radio · Switch · Label ✓
- **Structure:** Card ✓ · Tabs · Accordion · Sheet · Dialog ✓ · DropdownMenu · Tooltip · Separator
- **Data:** **Table [v2 spec]** · Badge ✓ · Avatar · **EmptyState [v2]** · **Skeleton [v2]** · Pagination
- **Feedback:** **Toast [v2]** · Alert · Spinner · ProgressBar
- **Trust [v2]:** Provenance · Confidence · Citation
- **Dashboard:** StatCard · ChartCard (Recharts wrapper)
- **Navigation:** AppShell (sidebar + topbar) · Breadcrumbs · LangSwitcher · ThemeToggle ✓

Source — shadcn/ui: components are **copied** into `packages/ui/src/components` and adapted to tokens (our code, not a dependency).

---

## 10. [v2] Voice & tone — the biggest lever for "pleasant to a lawyer"

The lawyer judges the tool by its _words_ more than its shadows. Copy is part of the design system.

**Principles**

1. **Plain Ukrainian of her domain.** No `id`, `slug`, `abstention rate`, `hybrid mode`, no UA/RU/EN mixing in visible text. Technical detail hides under an expandable «Технічні деталі».
2. **Address politely** («ви»), warm but not chatty.
3. **Say the consequence, not the mechanism.** Tell her what happens, in her terms.
4. **Errors are help, not blame.** Name the field, say the fix.
5. **Never a dead end.** Every error/empty screen offers a next step.

**Patterns**

| Situation           | ❌ Don't                    | ✅ Do (uk)                                                 |
| ------------------- | --------------------------- | ---------------------------------------------------------- |
| Validation error    | "Error 422: field required" | «Не вдалося зберегти: не заповнено „Дата шлюбу"»           |
| Empty screen        | "No data"                   | «Ще немає послуг. Створіть першу — це займе кілька хвилин» |
| Destructive confirm | "Are you sure?"             | «Вимкнути послугу? Клієнти більше не зможуть її замовити»  |
| Success             | "Success!"                  | «Збережено» (quiet, no exclamation)                        |
| AI working          | "Processing…"               | «Готуємо документ…»                                        |
| Unsourced fact      | (silent)                    | «Без джерела — потребує перевірки»                         |

Store all of this as dictionary keys (§13); microcopy is reviewed like code.

---

## 11. Discipline — Definition of Done for a component

- [ ] Works in **both themes** (screenshot both — dark breaks silently on shadows and overlays; carries a border per §4)
- [ ] All interactive states: default · hover · **focus-visible ring** · active · disabled · loading
- [ ] Keyboard accessible; interactive target **≥ 44×44** (§12)
- [ ] All text via the dictionary; tone follows §10; not a single string in JSX
- [ ] **No hardcoded colors, sizes, or durations** — semantic tokens only
- [ ] Has a usage example in `DesignKitPage`

**Do / Don't:**

| ✅ Do                               | ❌ Don't                                             |
| ----------------------------------- | ---------------------------------------------------- |
| `bg-paper text-ink border-line`     | `bg-white dark:bg-slate-900`                         |
| status color via `<Badge tone>`     | `style="color:#2E7D5B"`                              |
| duration `var(--motion-base)`       | `transition: 0.23s`                                  |
| hide jargon under "Технічні деталі" | emoji instead of Lucide; jargon in copy for a lawyer |

---

## 12. Accessibility (non-negotiable minimum)

Text contrast **≥ 4.5:1** (baked into ink/canvas pairs; status-on-tint verified per §1.3); focus always visible; dialogs trap focus and close on `Esc`; icon buttons have `aria-label`; forms wired `label ↔ input`; errors conveyed **not by color alone but with text + icon**; `prefers-reduced-motion` respected. In the EU some services make this a regulatory requirement (EAA).

> **[v2] Target size & legibility for the lawyer.** The primary user is non-technical and may be older, using a mouse. **Minimum interactive target 44×44px** (pad small icon buttons to a 44px hit area even if the visual is 40). Base body text stays **15px, never smaller than 12px** for any meta. Default to **comfortable** density, not compact — information density is a distant second to her being able to read and hit things calmly.

---

## 13. Localization · uk / ru / en

Single source of truth, default `uk`. "A language must be easy to remove": drop a string from the array + delete the folder; everything else derives programmatically.

```ts
// packages/i18n/src/locales.ts
export const LOCALES = ["uk", "en"] as const;
export const DEFAULT_LOCALE = "uk";
export type Locale = (typeof LOCALES)[number];
```

> Adding a locale (e.g. `ru`) is a one-line change to `LOCALES` plus a new dictionary folder — bootstrap scope and rationale are recorded in ADR-0006 (`docs/adr/0006-locales-uk-en-bootstrap.md`).

**Prohibitions:** no `'ru'/'en'` literals outside `locales.ts`; no `if (locale === 'uk')` (differences as data); switcher renders from `LOCALES.map(...)`; **no country flags** as language icons (language ≠ country; for uk/ru politically charged) — text codes only. Fallback: no translation → show `uk` + «переклад незабаром». Legal texts (offer, policy) live not in JSON but as versioned documents. Dates/currency use locale formatting (`toLocaleString('uk-UA')`, ₴ grouping).

---

## 14. The "Claude Design" pipeline (how to build)

1. **Reference canvas** (`.dc.html`) — a quick single-HTML mock; tokens are born from it.
2. **`frontend-design` skill** — sets aesthetic/typographic direction so it does not read as templated.
3. **Tokens → Tailwind preset** — CSS variables in `index.css` map to semantic classes.
4. **Components in `packages/ui/src/components`** — modeled on shadcn/ui, per the DoD in §11.
5. **Live gallery `DesignKitPage`** (`/design`) — the showcase; a new component goes here too.

**Roadmap:** UI inventory → base tokens → 5–7 core components → sync with code → pilot on one feature.

---

## 15. Code map (relative to repo root)

| File                                                     | What                                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/tokens.css`                             | token variables (light + `[data-theme="dark"]`), mapped into Tailwind via `@theme inline`                                   |
| `packages/ui/src/components/`                            | Button · IconButton · Badge · FormField · Label · Input · Textarea · Spinner (bootstrap set; the rest of §9.12 lands later) |
| `apps/console/src/app/ThemeToggle.tsx`                   | theme switching/persistence — sets `<html data-theme>`, localStorage                                                        |
| `apps/console/src/features/design-kit/DesignKitPage.tsx` | live gallery (`/design`)                                                                                                    |

---

## Appendix — v2 additions at a glance (build priority for lawyer delight)

1. **Voice & tone (§10)** — highest ROI, zero code. Plain Ukrainian, warm errors, no dead ends.
2. **HITL & citations (§8)** — the trust core: AI-suggested vs confirmed, two-level confidence, mandatory source.
3. **Empty / skeleton / AI-generation states (§9.9–9.10)** — spec them, don't defer.
4. **Motion · elevation · z-index (§4–5)** — small sections that prevent silent bugs and make it _feel_ calm.
5. **Table (§9.8)** — the screen the lawyer lives in.
6. **Target size & legibility (§12)** — 44px targets, comfortable density, for a non-technical/older user.

_End of specification v2._
