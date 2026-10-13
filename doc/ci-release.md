# Build, launch, and release CI

`package.json` → `version` is the manually maintained application/release version.
It also supplies the packaged application metadata. CI never increments it.

## Test workflow

`.github/workflows/electron-build.yml` (`Packaging`) runs on code pushes,
pull requests, and manual dispatch. Commit prefixes do not control whether it runs.
Push workflows intentionally have no file-path filter so empty release commits
also run Packaging and the required README check.
It builds macOS ARM64 and Intel, Windows x64 and ia32, and Linux x64 and ARMv7 packages.

The actual packaged application must launch on macOS (both architectures),
Windows x64, and Linux x64. The check uses a temporary user-data directory,
waits for a visible main window and the real renderer's startup-ready marker,
then exits cleanly. Startup failures, renderer crashes, early exits, and timeouts
fail the workflow. It does not test translation, PDF interaction, or other features.
Windows launches the bundled main executable directly because the portable
launcher does not forward its child process stdout. Linux uses Xvfb. The cross-built ia32 and ARMv7 packages are compiled but are not
separately launched on the x64 runners.

## Release workflow

`.github/workflows/release.yml` (`Release`) follows a successful test run.
The exact tested commit message must start with `release` (case-sensitive), and
`Packaging`, `Code style`, and `Update README recent features` must all succeed
at that same commit before publication. The release job waits for pending checks
and rejects failed, cancelled, or skipped checks.
Only this repository's default-branch push/manual runs may publish; PRs and forks
cannot publish. The workflow reads `package.json` from the exact tested commit
and downloads the six archives from that same test run. It does not rebuild them.

A version must be higher under semantic version ordering than both:

- The initial rollout baseline, `0.1.0` in `.github/scripts/release-version.mjs`.
- Every existing published version, including prereleases (drafts are excluded).

The baseline prevents installing this workflow from publishing the existing
`0.1.0` package automatically. Keep the baseline unchanged when bumping versions.
Unchanged versions, version decreases, and build-metadata-only changes do not
publish. A version with a prerelease suffix produces a GitHub prerelease.

To ship a release, manually edit the `version` field in `package.json`, then refresh the
Bun lockfile, for example:

```sh
# Set "version" in package.json to 0.1.1, then run:
bun install --lockfile-only
```

The manual edit updates `package.json`, and `bun install --lockfile-only`
refreshes `bun.lock` when needed. Commit and push to the default branch using
`git commit -m "release: 0.1.1"`. Ordinary `fix:` and `ci:` commits do not publish,
even when the version increases. Once every
build and launch job passes, CI creates `v0.1.1` at the tested commit and publishes
all six installation packages. No separate tag push or manual Release creation is
needed. A failed test run cannot publish; a later successful run with the same
increased version can publish it. Published versions are not replaced by subsequent
fixes; bump the version again to release a fix.

CI packages macOS builds unsigned, and the release gate only accepts macOS apps
signed with the pinned local identity (`local.previewtranslate.reader`, team
`XUG85B2S2L`). CI holds no signing credentials, so when the macOS packages are not
signed with that identity the Release workflow publishes nothing, exits successfully,
and leaves a warning in the run summary telling you to run `bun run release` on a Mac
with the script below.
Builds are not notarized.

## Publishing from a Mac

`scripts/release.mjs` publishes a release in one command on a Mac that holds the
pinned signing certificate:

```sh
bun run release 0.1.11   # bump, commit "release: 0.1.11", push, then publish
bun run release          # publish the latest pushed release commit (resume)
bun run release --dry-run  # rehearse everything except creating the release
```

It requires a clean default branch and an authenticated `gh`. With a version, it
updates `package.json` and `bun.lock`, commits, and pushes. It then:

1. Builds and signs the two macOS packages locally and checks them with the same
   verifier the Release workflow uses.
2. Waits until `Packaging`, `Code style`, and `Update README recent features`
   succeed at the release commit, and stops if any of them fails or is cancelled.
3. Downloads the Windows and Linux packages from that Packaging run, with retries,
   and runs the same package checks as CI.
4. Generates the release notes with the CI script, uploads a draft, confirms every
   upload, then publishes it as the latest release at the release commit.

Without a version it resumes from the most recent `release` commit, provided only
the README bot has committed since. Rerun it after an interruption or a failed check;
it reuses an existing draft and exits when the version is already published. Work
files are kept in `release/publish-v<version>/` until publication succeeds.

## Automatic release notes

CI writes the release description from commits between the highest earlier
published semantic-version release and the exact tested commit. Draft releases
are excluded from the baseline. The first release uses the commit history up to
that tested commit. All history pages are included.

The description contains the version, a change-count summary, **New features**
(`feat:`), **Fixes and improvements** (`fix:`, `perf:`, `ux:`, `ui:`), update
instructions, links to the six validated installation packages, and a full
changelog link. Scoped prefixes such as `feat(reader):` are supported. Each
change has a bold title and includes its commit body when provided; write
user-facing titles and bodies to produce useful descriptions. Internal commits
such as `ci:`, `docs:`, `chore:`, and release markers stay in the full changelog.
No AI service or additional credentials are required.

The generated description is applied both to new drafts and when retrying an
existing draft, before making the release public. Published releases are not
rewritten. Regression tests run as part of the release gate.
