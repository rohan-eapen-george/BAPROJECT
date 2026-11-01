# Daywell

A browser-based educational app for exploring clinic appointment no-show risk,
contact recommendations, and day-level booking plans.

## Run locally

Install Node.js and pnpm, then run:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000.

To build and run the production app:

```sh
pnpm build
pnpm start
```

## Included features

- Patient risk calculator with a bundled calibrated decision-tree model.
- Day planner using sample appointments or an uploaded CSV for one calendar day.
- Contact recommendations, booking scenarios, and CSV export.
- Insights dashboard with bundled analysis tables and figures.
- Shared assumptions and light/dark themes.

The model and analysis assets are included in `public/`. Patient inputs and uploaded
CSVs are processed in the browser. No database, API key, or environment variables
are required.

## Deploy on Vercel

Import this repository, choose the Next.js framework, and use the repository root.
The build command is `pnpm build`; dependencies are declared in `package.json` and
locked in `pnpm-lock.yaml`.

## Verification and limitations

The production build and main browser workflows have been checked. The project
defines a Vitest command, but no automated test files are currently included.

This is an educational prototype using a public dataset. It is not intended for
real patient care or clinical decision-making. Contact effectiveness and financial
values are scenario assumptions.
