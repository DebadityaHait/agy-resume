# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-02

### Added
- Initial release of `agy-resume` (`agyr`).
- Interactive terminal picker with keyboard navigation and fuzzy search.
- Cross-platform exact directory scoping (`--scope exact`, default).
- Support for `--scope tree`, `--scope repo`, and `--all`.
- Cross-platform path normalization for Windows, POSIX, macOS, Linux, and WSL.
- Fast multi-tier Antigravity session discovery via `history.jsonl`, `conversation_metadata.json`, and `transcript.jsonl`.
- Machine-readable `--json` output mode and `--print-id` flag.
- Diagnostic environment verification via `--doctor`.
- Safe Antigravity session resumption with `agy --conversation <id>`.
- Local metadata caching for sub-second startup times.
- Full read-only safety guarantees: zero modification of Antigravity session files.
