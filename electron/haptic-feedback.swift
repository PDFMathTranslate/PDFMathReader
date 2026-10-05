import AppKit

// Keep the process warm; one line requests one alignment detent.
while let line = readLine() {
    if line == "tick" {
        NSHapticFeedbackManager.defaultPerformer.perform(.alignment, performanceTime: .now)
    }
}
