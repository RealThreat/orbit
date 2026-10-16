# Orbit desktop interface

The desktop uses charcoal surfaces, restrained sage/lime accents, Space Grotesk headings and Noto Sans body text. Shared navigation, inputs, buttons and dialogs use consistent spacing and corner radii. Provider identities, danger states and service branding retain their existing meanings.

`src/renderer/src/scss/orbit-theme.scss` is the desktop presentation layer, loaded by app.scss. Component state classes and layouts remain in their existing files. The shared Sass palette also updates surfaces that use the original tokens. No routes, controls, integrations, data or existing assets are removed. The theme editor and custom stylesheet loader remain present; custom themes may need selector adjustments because the desktop presentation layer uses body-scoped selectors.

Page-specific treatments cover the home dashboard, library cards and controls, settings, downloads, achievement rows, game description area, console trophy cards and per-platform progress. This does not constitute a separate redesign of the controller-oriented Big Picture layout or detached windows.

Validation: renderer TypeScript check, ESLint for the entry point, production Electron/Vite build, Sass compilation after the narrow-settings adjustment, and browser fixtures rendering the real home, button, text field and select components. Fixtures use synthetic data and simplified surrounding navigation. Inputs, select changes, disabled/error states and the 620px settings layout were inspected. Full authenticated Electron navigation, installers, console authentication and all existing custom themes were not exercised.
