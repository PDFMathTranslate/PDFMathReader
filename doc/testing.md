# Test priorities

`bun run test` runs 29 automated cases through Node's built-in `node:test` runtime.
The suite is kept below 30 by retaining
checks whose failure can lose user data, expose credentials, break packaged
startup, corrupt translations or prevent a core interaction. Tests are removed
from the source rather than hidden behind a name filter or an alternate suite.

| Risk                                | Cases | Retained checks                                                                                                                                                              |
| ----------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential safety                   |     4 | OS-backed encryption, no plaintext persistence, overrides, clearing, concurrent profile saves                                                                                |
| PDF data integrity                  |     4 | Annotation round trips, native annotation migration, unchanged unannotated PDFs, page edits saved to source                                                                  |
| Desktop and packaging               |     2 | Private authenticated backend lifecycle, bundled startup and PDF extraction                                                                                                  |
| Work lifecycle                      |     3 | Worker and descendant shutdown, global translation limit, queued cancellation                                                                                                |
| Cache and provider isolation        |     4 | Cleanup protects active work and outside files, shared request cancellation, document invalidation, configured provider routing without fallback requests after cancellation |
| Kernel configuration                |     2 | Fast and Precise environment field mapping and secret-free cache identity, invalid configuration rejection                                                                   |
| Preferences, documents and sessions |     4 | Partial writes preserve settings, portable page coordinates, multiple-document restore, capacity never evicts active documents                                               |
| Information emphasis                |     3 | Category selection and unchanged text, phrases spanning PDF runs, persisted category preferences                                                                             |
| Translation languages               |     1 | Custom code validation, engine support and preference round trips                                                                                                            |
| Release updates                     |     2 | Correct release/error status and safe URLs, shared checks and cached release revalidation                                                                                    |

Removed coverage includes detailed telemetry counters, log presentation,
exhaustive language labels, static build metadata, duplicate preference boundary
checks, and upstream Python schema inventories dependent on local installations.
These behaviors can still be inspected when changing the relevant feature;
they no longer add permanent cases to the main suite. New tests should replace
lower-priority cases when possible rather than grow the suite by default.

The Node suite does not prove native macOS mouse hit testing or hardware behavior.
Keep desktop regression checks focused on the interaction being changed. For the
kernel popup, `electron . --smoke-test=kernel-menu-mouse` exercises pointer and
keyboard selection, checks the menu's exclusion from the draggable toolbar,
and verifies the custom source-language selector opens and saves a code.
The separate GitHub automation tests under `.github/scripts` belong to the README
update workflow and are not application tests.
