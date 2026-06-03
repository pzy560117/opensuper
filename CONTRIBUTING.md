# Contributing to OpenSuper

## Development Setup

```bash
git clone https://github.com/pzy560117/opensuper
cd opensuper
pnpm install
pnpm build
```

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Watch mode (TypeScript) |
| `pnpm build` | Compile TypeScript |
| `pnpm test` | Run unit tests |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm test:shell` | Run shell script tests (requires bash + bats) |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Run Prettier |
| `pnpm format:check` | Verify source formatting |

## Windows Notes

- `pnpm test:shell` now prefers Git Bash automatically when `bash` points at the WSL launcher.
- If your Git Bash lives in a custom path, set `OPENSUPER_BASH` before running shell tests.
- Example (PowerShell): `$env:OPENSUPER_BASH='D:\Program Files\Git\bin\bash.exe'`

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

## PR Process

1. Create a feature branch from `main`
2. Implement with tests (80%+ coverage)
3. Run `pnpm build && pnpm lint && pnpm format:check && pnpm test`
4. Open a PR against `main`

## Project Structure

```
src/
├── cli/index.ts       # Commander registration
├── commands/          # Command orchestrators
│   ├── init.ts        # opensuper init
│   ├── status.ts      # opensuper status
│   ├── doctor.ts      # opensuper doctor
│   └── update.ts      # opensuper update
├── core/              # Business logic (platform-agnostic)
│   ├── platforms.ts   # Platform definitions
│   ├── detect.ts      # Platform detection
│   ├── skills.ts      # Skill file operations
│   ├── openspec.ts    # OpenSpec installation
│   └── superpowers.ts # Superpowers installation
└── utils/
    └── file-system.ts # File I/O utilities
```

## Adding a New Platform

1. Add an entry to `PLATFORMS` in `src/core/platforms.ts`
2. Add the mapping to `SKILLS_AGENT_MAP` in `src/core/superpowers.ts` if it differs

## Adding a New Skill

1. Create the SKILL.md under `assets/skills/<skill-name>/SKILL.md`
2. Add it to `assets/manifest.json` `skills` array
3. Create the Chinese version under `assets/skills-zh/<skill-name>/SKILL.md`

## Skill Design

- **Decision Core first**: Agent-facing instructions go at the top (phase detection, dispatch logic, error handling)
- **Reference Appendix**: Field reference, script locations, best practices go at the bottom
- **Write Chinese version first**, get approval, then sync to English
