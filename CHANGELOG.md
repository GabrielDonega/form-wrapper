# Changelog

All notable changes to `@donega/form-wrapper` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com) and versioning follows [semver](https://semver.org) (pre-1.0: minor versions may add features, patch versions fix bugs).

## [0.2.0] — 2026-10-06

### Added — core

- Documentation overhaul: onboarding README, guides (`docs/getting-started`, `concepts`, `api`, `nested-forms`, `arrays`, `validation`, `server-errors`, `framework-integration`) and recipes (`login`, `registration`, `dynamic-fields`, `async-validation`, `multi-step`).
- New behavioral tests: stale `validateField` results, submit retry when values change during async validation, `resetField` on array paths, `setErrors(null)`, `clearError` across both channels, server-error precedence.

### Added — workspace

- `@donega/form-wrapper-vue` 0.1.0 — Vue 3 adapter: `useForm`, `useFormState`, `useField` (writable computeds for `v-model`, per-field subscriptions, SSR-safe disposal).
- `@donega/form-wrapper-zod` 0.1.0 — Zod adapter (`zodValidator`, `errorsFromZod`), supporting Zod v3 and v4.
- `examples/vanilla` — plain DOM, no build step.
- `examples/vue` — Vue 3 + Composition API + TypeScript + Vite: nested values, dynamic arrays, Zod validation, server errors.
- CI workflow: typecheck, tests, build and smoke for the core and both adapters.

### Changed

- Core version bumped to 0.2.0 to match the release that introduces the workspace packages (no API changes).

## [0.1.0] — initial release

- `createForm` headless controller: values, errors, touched, dirty, validation, submission.
- Type-safe nested paths (`Path`, `PathValue`, `ArrayPath`).
- `field()` / `array()` controllers with automatic error/touched index remapping.
- Two error channels (validation + external/server) with server precedence.
- Race-protected async validation; `submit()` returning a typed `SubmitOutcome`; concurrent-submit guard.
- Reference-stable `state` snapshot for `useSyncExternalStore`-style integrations.
