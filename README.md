# agy-resume (`agyr`)

> **Cross-Platform Workspace-Scoped Conversation Picker for Google Antigravity CLI**

[![CI](https://github.com/DebadityaHait/agy-resume/actions/workflows/ci.yml/badge.svg)](https://github.com/DebadityaHait/agy-resume/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)

**agy-resume** is an independent, fast, and polished developer utility that allows you to browse, search, and resume Antigravity CLI conversations scoped strictly to your current directory or project workspace.

> [!NOTE]
> **Disclaimer:** `agy-resume` is an independent open-source community utility and is not affiliated with, endorsed by, or sponsored by Google.

---

## ⚡ The Problem

By default, the Antigravity CLI displays a global list of conversations from across all directories on your machine:

```text
  Conversations
  Type to search conversations...
> Implement Authentication Service                                              auth-service     402 steps        3m ago
  Database Migration Scripts                                                      db-service      51 steps        9m ago
  Frontend Navigation Redesign                                                       web-app     590 steps       44m ago
  Payment Gateway Integration                                                        billing      89 steps       55m ago
  API Documentation Update                                                          api-docs       3 steps        1h ago
  Optimize Postgres Connection Pool                                               db-service      46 steps        5h ago
  Refactor OAuth Token Store                                                    auth-service      22 steps        1d ago
  [1-7 of 42 items]

Keyboard: ↑/↓ Navigate  ←/→ Page  enter Select  f2 Rename  f4 Delete  tab Switch Tab  esc Go back / Clear search
```

When you are working inside `~/projects/auth-service` (or `C:\projects\auth-service`), browsing through dozens of unrelated global projects creates unnecessary friction.

With **`agyr`**, you get immediate, directory-scoped session discovery:

```text
  Antigravity Sessions
  /home/user/projects/auth-service

  Search: _

> Implement Authentication Service                                              auth-service     402 steps        3m ago
  Refactor OAuth Token Store                                                    auth-service      22 steps        1d ago
  Fix JWT Signature Verification                                                auth-service       5 steps        2d ago
  Add Auth Unit Test Coverage                                                   auth-service       8 steps        5d ago

  4 conversations

  ↑↓ navigate   type search   enter resume   esc quit
```

Select a conversation, press <kbd>Enter</kbd>, and `agyr` immediately resumes your session in Antigravity:

```bash
agy --conversation <conversation-id>
```

---

## 🚀 Installation

### Global Installation

```bash
npm install -g agy-resume
```

Then run anywhere:

```bash
agyr
```

*(or `agy-resume`)*

### Run Directly via `npx`

```bash
npx agy-resume
```

---

## 📖 Quick Start

Navigate to any project workspace and run:

```bash
cd ~/projects/my-app
agyr
```

### Initial Search Query

Pass keywords directly to start with a pre-filtered list:

```bash
agyr auth token
```

---

## 🎛️ CLI Options & Scoping Modes

```text
Usage: agyr [options] [query...]

Cross-platform workspace-scoped conversation picker for Google Antigravity CLI

Arguments:
  query                   initial search query terms

Options:
  -v, --version           output the current version
  -a, --all               show sessions from all workspaces
  -s, --scope <scope>     scoping mode: exact (default), repo, tree, all
  --cwd <path>            evaluate workspace scope from specific directory
  --json                  output session list as JSON
  --print-id              output only conversation ID without launching
  --no-launch             display selected session metadata without launching
  --refresh               force metadata cache refresh
  --no-cache              bypass reading and writing local cache
  --data-dir <path>       custom Antigravity data directory
  --agy-path <path>       custom path to Antigravity CLI executable
  --limit <number>        limit number of sessions returned
  --doctor                run diagnostic checks and exit
  --debug                 enable diagnostic debug logging
  -h, --help              display help for command
```

### Scoping Modes

| Mode | Command | Description |
| ---- | ------- | ----------- |
| **`exact`** *(default)* | `agyr` or `agyr --scope exact` | Matches sessions recorded for the exact current working directory. |
| **`tree`** | `agyr --scope tree` | Matches sessions in the current directory and all its subdirectories. |
| **`repo`** | `agyr --scope repo` | Automatically locates the Git root and scopes sessions to the entire repository. |
| **`all`** | `agyr --all` or `agyr --scope all` | Displays sessions across all workspaces on your system. |

---

## 🛠️ Diagnostics (`--doctor`)

Run diagnostic checks to verify your Antigravity installation and session metadata:

```bash
agyr --doctor
```

Example output:

```text
agy-resume doctor

  Node.js             OK         22.12.0
  Platform            OK         linux x64
  Current directory   OK         /home/user/projects/auth-service (git: auth-service)
  Antigravity CLI     OK         /usr/local/bin/agy (agy 1.1.23)
  Antigravity data    OK         /home/user/.gemini/antigravity-cli
  history.jsonl       OK         148 records across 143 sessions
  Session metadata    OK         143 cached conversations
  Workspace matches   OK         4 conversation(s) matching scope: exact
  Local cache         OK         /home/user/.cache/agy-resume/sessions.json

No problems detected.
```

---

## 🤖 Scripting & Automation

### JSON Output (`--json`)

Export conversations in clean, ANSI-free machine-readable JSON:

```bash
agyr --json
```

```json
[
  {
    "id": "055a398f-db14-4c5f-abbb-1bf03f8120a7",
    "workspace": "/home/user/projects/auth-service",
    "title": "Implement Authentication Service",
    "firstPrompt": "Implement OAuth2 token verification and password hashing...",
    "createdAt": "2026-09-01T18:20:30.000Z",
    "updatedAt": "2026-09-01T19:14:55.000Z",
    "messageCount": 25
  }
]
```

### Print ID Only (`--print-id`)

In interactive mode or with deterministic search queries, print only the conversation ID:

```bash
CONV_ID=$(agyr "auth token" --print-id)
echo "Selected: $CONV_ID"
```

---

## 🔒 Safety & Read-Only Guarantee

`agy-resume` is strictly **read-only** with respect to Antigravity's storage:

- **Zero modifications:** `agy-resume` will never write to or modify `~/.gemini/antigravity-cli/history.jsonl`, `cache/last_conversations.json`, or `brain/`.
- Resuming sessions is performed cleanly via Antigravity's native command:
  ```bash
  agy --conversation <conversation-id>
  ```
- Fast package caching is kept in your OS user cache directory (e.g. `%LOCALAPPDATA%\agy-resume\cache` or `~/.cache/agy-resume`) and can be safely deleted at any time.

---

## 🌐 Privacy

- **100% Local-First:** No telemetry, no analytics, no external network requests.
- **Private Data Protection:** Prompts and session transcripts never leave your local machine.

---

## 🖥️ Platform Support

- **Windows:** Native PowerShell, Windows Terminal, CMD, Git Bash.
- **macOS:** Terminal, iTerm2, zsh, bash.
- **Linux:** All standard Linux terminal emulators.
- **WSL:** Fully supported inside WSL environments (WSL and native Windows storage are treated as distinct environments in v1).

---

## 📄 License

MIT © [agy-resume Contributors](LICENSE)
