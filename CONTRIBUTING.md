# Contributing to `agy-resume`

Thank you for your interest in contributing to `agy-resume`!

## Development Setup

Requirements:
- Node.js 22+ LTS
- npm 10+

Clone the repository and install dependencies:

```bash
git clone https://github.com/example/agy-resume.git
cd agy-resume
npm install
```

## Available Scripts

- `npm run build`: Compile TypeScript and bundle ESM output into `dist/`
- `npm run dev`: Build and watch for source changes
- `npm run typecheck`: Run TypeScript compiler checks without emitting files
- `npm test`: Run the full test suite with Vitest
- `npm run test:watch`: Run tests in watch mode
- `npm pack`: Create a distributable npm tarball

## Guidelines

1. **Safety First**: `agy-resume` must **never** modify Antigravity conversation files or transcripts.
2. **Cross-Platform Compatibility**: Code and tests must work reliably across Windows (PowerShell/CMD), macOS, Linux, and WSL.
3. **Strict TypeScript**: Avoid `any` types; all JSON parsing must use safe schema guards.
4. **Performance**: Avoid eager global transcript parsing. Filter by workspace first.

## Submitting Pull Requests

1. Create a feature branch from `main`.
2. Ensure `npm run typecheck`, `npm run build`, and `npm test` pass.
3. Open a Pull Request with a clear description of the change.
