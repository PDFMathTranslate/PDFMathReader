# Code style and automatic formatting

Run `bun install --frozen-lockfile` after cloning. Its `prepare` step installs the Husky Git hooks.
Use Bun 1.3.14, Node.js 22.22.1 or newer (Node 24 also works), `uv` for Python helpers, and
Xcode 27's `swift-format` on macOS (or `swift-format` on PATH on other systems).
Ruff is pinned to 0.15.7 and provisioned through `uv tool run`.

- `bun run style:fix`: fix ESLint findings, format supported files with Prettier,
  then check and format Python and Swift helpers.
- `bun run style:check`: check everything without writing files.
- `bun run format` / `bun run format:check`: Prettier only.
- `bun run lint` / `bun run lint:fix`: JavaScript and Vue checks only.

Prettier owns JavaScript, Vue, CSS, HTML, JSON, YAML and Markdown formatting:
2 spaces, single quotes in JavaScript, semicolons, a 100-column wrap target,
trailing commas and LF line endings. It does not rename identifiers or limit
function length. ESLint uses recommended correctness rules and Vue essential
rules; unused variables, redundant assignments and mandatory error causes are
not blockers in this initial rollout. Empty catch blocks are allowed for
intentional fallbacks. Control-character regexes are allowed for sanitizers.

Ruff uses its minimal recommended correctness families, with unused imports and
variables and import placement excluded (the kernel measures startup before imports), and formats Python with 4 spaces and a 100-column target.
Swift uses Apple's `swift-format` with 4 spaces and a 100-column target; only
formatting is enforced, without additional Swift lint restrictions.
Generated assets, build output, local caches, the `bun.lock` lockfile and selected
benchmark outputs are excluded from Prettier; `.prettierignore` is authoritative.
Shell launch scripts and binary assets are outside this formatter setup.

Every normal `git commit` runs lint-staged: only staged files are fixed and
checked, and successful fixes are staged automatically. Partially staged files
keep their unstaged edits through lint-staged's default backup/hiding behavior.
Remaining lint errors, parse errors or missing required tools fail the hook and
block the commit. Do not add `git add .` inside the hook.

The Code style GitHub workflow uses the `xcode-27` runner to match the local Swift
formatter version and repeats the whole-repository checks on pushes
and pull requests. Local hooks can be bypassed with Git's `--no-verify` or
`HUSKY=0`; to enforce this for remote merges, require the `style` status check in
GitHub branch protection. That repository setting is separate from local hooks.
