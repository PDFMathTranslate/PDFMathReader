# Build, launch, and release CI

`package.json` → `version` is the manually maintained application/release version.
It also supplies the packaged application metadata. CI never increments it.

## Test workflow

`.github/workflows/electron-build.yml` (`Electron test`) runs on code pushes,
pull requests, and manual dispatch. Commit prefixes do not control whether it runs.
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

`.github/workflows/release.yml` (`Electron release`) follows a successful test run.
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

To ship a release, manually update the version, for example:

```sh
npm version 0.1.1 --no-git-tag-version
```

This updates `package.json` and `package-lock.json`. Commit and push them to the
default branch. Once every build and launch job passes, CI creates `v0.1.1` at the
tested commit and publishes all six installation packages. No separate tag push
or manual Release creation is needed. A failed test run cannot publish; a later
successful run with the same increased version can publish it. Published versions
are not replaced by subsequent fixes; bump the version again to release a fix.

The packages retain the existing CI signing policy: macOS builds are unsigned
and are not notarized. This workflow does not introduce signing credentials.
