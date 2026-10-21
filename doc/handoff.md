# Native Apple Handoff

Both apps register `org.pdfmathreader.reading` as an `NSUserActivity` type. The
version 1 payload is deliberately small and contains no credentials or local
paths:

```json
{
  "version": 1,
  "documentID": "shared-document-id",
  "page": 3,
  "serverURL": "http://mac.local:3000"
}
```

`documentID` is the authenticated companion document identity and `page` is
one-based. A revision may be included when the sender has one. The receiving
app matches `serverURL` to an already paired computer and uses its stored
pairing credentials; Handoff itself does not authorize document access.

On macOS, the active shared document is advertised only while Companion is
enabled and running. A Mac continuation resolves the ID from its recent
document catalog, restores the requested page, and waits up to 30 seconds when
the iOS session is still saving. The retry never force-takes a paired lock. An
iOS-to-Mac continuation therefore preserves the PDF and the committed
annotations, comments, quick links, and reading state.

When iOS continues a Mac activity, Electron's
`activity-was-continued` event first saves the active Mac reading view, flushes
annotation, quick-link, and recent-document stores, releases the desktop claim,
and closes the source window. This lets iOS acquire the same document without
competing with the Mac claim.

An iOS-local PDF uses the authenticated
`POST /companion/v1/documents/import` endpoint. The request carries the PDF,
SHA-256, byte count, page count, title, and a stable source ID. A new source ID
creates a new recent PDF under the desktop companion-imports directory; retries
with the same source ID and bytes return the same document ID, while a different
payload is rejected. The iOS side then acquires, saves its portable snapshot,
and releases the session before publishing Handoff. This keeps the original
desktop document create-only during import and preserves annotations, comments,
quick links, and reading state in the normal authenticated save flow.

The package declares the activity type in `NSUserActivityTypes`. The macOS and
iOS targets must be signed by the same Apple Developer Team ID. Apple controls
whether the Handoff suggestion appears in the Dock; the app cannot force that
indicator. End-to-end verification requires physical devices with the same
Apple Account, Bluetooth, Wi-Fi, and Handoff enabled. A signed build and local
activity publication do not by themselves prove that the Dock entry appeared.
