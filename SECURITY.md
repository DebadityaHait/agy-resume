# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in `agy-resume`, please do not open a public issue.

Instead, please report security concerns via GitHub Private Vulnerability Reporting or by contacting the maintainers directly.

## Security Principles

- `agy-resume` is a local-only utility with **zero telemetry** and **zero network calls**.
- All local transcripts and session data are treated as untrusted input.
- Session IDs and arguments are passed as structured arrays to `crossSpawn` rather than interpolated into shell strings.
