# Zero-Proof — Session Summary

## Goal
Deploy a Docusaurus documentation site to Vercel and fix CI build errors in a RISC Zero ZK prover Rust monorepo.

## Progress

### Done
- Docusaurus site live at **https://zero-proof-pearl.vercel.app** (HTTP 200, v3.10.1)
- Vercel project `zero-proof` configured with `framework: docusaurus-2`, `buildCommand: npm run build`, `outputDirectory: build`, `rootDirectory: null`
- `website/vercel.json` removed (was causing parser errors)
- Root `.vercelignore` removed (not needed)
- Vercel GitHub integration unlinked (was auto-deploying from root and failing)
- CI deploys via `vercel deploy website --prod` — uploads only the `website/` subdirectory
- Added `cxx/rv32im/ffi_stubs.cpp` to `kernel_build.manifest` (fixed Rust sandbox build panic)

### Key Decisions
- Deploy from `website/` directory using `vercel deploy website --prod`
- Project settings via Vercel API, not local config files
- No `rootDirectory` in project settings (avoid double-pathing)
- No Vercel GitHub integration (CI-only deployment)

### CI
- Workflow: `.github/workflows/website.yml` — triggers on push to `main`
- Command: `npx vercel deploy website --prod --token=${{ secrets.ZEROTOKEN }} --scope=${{ secrets.VERCELID }}`
- Secrets needed: `ZEROTOKEN` (Vercel token), `VERCELID` (Vercel team ID)
