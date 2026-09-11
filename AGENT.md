# AGENT.md — HawkerFlow POS & Kitchen System Guidelines

This document provides instructions, technical specifications, and guardrails for AI coding agents working on the **HawkerFlow POS (`hawkerflow-ui`)** codebase.

---

## 1. Tech Stack & Libraries

- **Framework**: Angular 22 (Modern Standalone Components, Signal-based reactivity)
- **Language**: TypeScript 6.0+ (Target: `ES2022`, strict typing, `module: preserve`)
- **Styling**: Tailwind CSS (with `@tailwindcss/postcss`, custom `hawker-*` color palette, Plus Jakarta Sans & JetBrains Mono typography)
- **Icons**: Lucide Icons (`@lucide/angular` / `lucide-angular` wrapped via `<app-icon>`)
- **Build System**: Angular Application Builder (`@angular/build:application` via Vite / esbuild)
- **State Management**: Angular Signals (`signal`, `computed`, `effect`) with `localStorage` persistence
- **Testing**: Vitest (`vitest: ^4.0.8`) with `@angular/build:unit-test` / JSDOM runner
- **Default Port**: `4200` (`http://localhost:4200`)

---

## 2. Architecture & Directory Layout

```
src/app/
├── core/
│   ├── guards/         # Route activation guards (e.g., authGuard)
│   ├── mock/           # Initial mock data (preset stalls, default menus, modifier groups)
│   ├── models/         # TypeScript interfaces & types (auth, menu, order, settings)
│   └── services/       # Signal-based singletons (AuthService, MenuService, OrderService, SettingsService, AudioService)
├── shared/
│   └── components/     # Reusable UI widgets (IconComponent, ReceiptModalComponent)
└── features/
    ├── auth/           # Stall merchant login & multi-stall registration
    ├── pos/            # Cashier register, category filters, cart & modifier modals
    ├── kds/            # Kitchen Display System with live tickets & bump progression
    ├── orders/         # Order log, search filters & printable thermal receipts
    ├── menu-admin/     # Menu item editor, category manager & "86" (Sold Out) toggles
    └── analytics/      # Daily sales stats, hourly trends, shift summaries & Z-reports
```

---

## 3. Coding Standards & Style Guide

### A. Template Isolation Rule (Strict)
- **Every Angular component template must be in its own dedicated `.html` file** (linked via `templateUrl: './component-name.component.html'`).
- **Never** write inline templates (`template: \`...\``).

### B. Modern Angular & Reactive Signals
- Use **Standalone Components** (`standalone: true`) exclusively.
- Use `inject()` function for dependency injection; avoid legacy constructor parameter injection where possible.
- Use Angular's built-in control flow syntax:
  - `@if (condition) { ... } @else { ... }` (Do not use `*ngIf`)
  - `@for (item of items(); track item.id) { ... }` (Do not use `*ngFor`)
  - `@switch (status) { @case ('ready') { ... } }` (Do not use `*ngSwitch`)
- State must be exposed as Signals (`signal<T>()`, `computed<T>()`). Component methods should mutate state via `signal.set()` or `signal.update()`.

### C. Naming Conventions
- **Files & Folders**: `kebab-case` with descriptive suffixes:
  - Components: `order-card.component.ts`, `order-card.component.html`
  - Services: `order.service.ts`
  - Models: `order.model.ts`
  - Guards: `auth.guard.ts`
- **Classes / Types / Interfaces**: `PascalCase` (`OrderItem`, `StallAccount`, `MenuService`).
- **Methods, Variables & Signals**: `camelCase` (`cartItems`, `activeOrders`, `onBumpStatus()`).
- **Constants**: `UPPER_SNAKE_CASE` (`PRESET_STALLS`, `STORAGE_KEY_PREFIX`).

### D. Singapore Hawker Localization
- **Currency**: Display prices in Singapore Dollars formatted to 2 decimals (e.g., `\$6.50`). Always escape literal dollar signs in markdown.
- **Taxes & Fees**: Follow local hawker economics (optional 9% GST, optional takeaway container packaging fee, e.g., `\$0.30`).
- **Payment Types**: Support Singapore-standard payment methods: `cash`, `paynow` (SGQR simulated reference), `nets`, and `card`.
- **Terminologies**:
  - `86` / `86'd`: Kitchen slang for marking an item **Sold Out**.
  - `Dine-In` (with Table / Buzzer #) vs. `Takeaway` (Dabao).

---

## 4. Testing Guidelines

### A. Test Runner & Commands
- Run all unit tests once (headless/CI mode):
  ```bash
  npm test -- --watch=false
  ```
- Run tests in watch mode during development:
  ```bash
  npm test
  ```

### B. Writing Unit Tests
- Test specs must be located alongside code or in `src/app/app.spec.ts` using `*.spec.ts` naming.
- Follow the **Arrange-Act-Assert (AAA)** structure.
- When configuring `TestBed`, include necessary providers (`provideRouter(routes)`):
  ```typescript
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)]
    }).compileComponents();
  });
  ```
- Test Signal reactivity by executing service methods and checking the signal getter `service.signalName()`.

---

## 5. Workflow & Guardrails for AI Agents

1. **Verify Before Declaring Done**:
   - Always run `npm test -- --watch=false` to ensure all existing and new unit tests pass.
   - Always run `npm run build` to verify there are 0 TypeScript, Angular compiler, or Tailwind CSS errors.
2. **Preserve Repository Separation**:
   - **`hawkerflow-ui`** is dedicated strictly to the **Stall Owner POS, Kitchen KDS, Menu Admin, and Analytics**.
   - Do not re-add diner/customer portal code here; customer self-ordering logic belongs in `~/Documents/Development/hawkerflow-diner-ui`.
3. **No Unnecessary Dependencies**:
   - Do not install heavy external component libraries (e.g., Angular Material, Bootstrap). The UI is custom-tailored with Tailwind CSS and Lucide icons.
4. **Preserve Comments & Rationale**:
   - Maintain existing comments and business logic explanations when refactoring.
5. **Concise Communication**:
   - Keep chat responses concise and clear, linking directly to affected files and line ranges.
