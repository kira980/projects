# Installed design and context tools

Verified 2026-09-10. Installed for this user's Codex environment; these are not application dependencies.

- `frontend-design`: `/Users/ahmedhosh/.codex/skills/frontend-design/SKILL.md`, from `anthropics/skills`. Use for design direction, deliberate typography, real content, and screenshot critique.
- `playwright`: `/Users/ahmedhosh/.codex/skills/playwright/SKILL.md`, from `openai/skills`. The CLI dependency is available through its wrapper. Browser launch was verified using existing Chromium.
- `vexp-cli` 3.1.2: installed globally and registered as Codex MCP server `vexp`, scoped to `/Users/ahmedhosh/Desktop/saas`. Daemon socket and an actual MCP `run_pipeline` call verified. Current index: 303 files, 1,877 nodes. Counts change with the codebase.

## Efficient workflow

Follow the project's vexp instructions. Start with one focused `run_pipeline` task, use returned file ranges, and read full implementations only when editing them. Reuse context within a task. The verified free plan permits 20 daily calls and 2,000 nodes; do not assume unlimited usage or complete impact coverage, particularly for CSS.

For design work, read the frontend-design skill, form a concise visual direction grounded in the business, implement with existing components, then inspect representative desktop and mobile screenshots. Use real tenant data and cover empty/error states. Use targeted browser snapshots rather than returning complete page trees repeatedly. Token savings are task-dependent, not guaranteed.

## Browser command

The machine does not have Google Chrome at Playwright's default location. Use the verified Chromium configuration:

```sh
bash /Users/ahmedhosh/.codex/skills/playwright/scripts/playwright_cli.sh -s=booklyt open http://localhost:3100 --config /Users/ahmedhosh/.codex/tools/playwright/cli.config.json
```

The configuration references the installed Chromium executable and stores artifacts under `output/playwright/`. Follow the skill's snapshot/ref workflow. Close only your own browser session when finished.

## Vexp health

```sh
vexp daemon-cmd status
vexp daemon-cmd start
```

The configured MCP connection uses stdio. Its HTTP endpoint does not need to listen for Codex's MCP tools to work. Do not repeatedly run `setup` or add duplicate MCP servers. Existing image-generation tools are already available; no additional image plugin was installed.
