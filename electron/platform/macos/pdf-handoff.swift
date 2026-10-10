import AppKit

// Launch Services delivers the document to the selected application. Keep the
// reader open until the request succeeds and that application is foreground.
func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

let arguments = CommandLine.arguments
guard arguments.count == 4 else { fail("Expected an application, PDF path and caller PID.") }
let applicationURL = URL(fileURLWithPath: arguments[1])
let documentURL = URL(fileURLWithPath: arguments[2])
guard FileManager.default.fileExists(atPath: documentURL.path) else {
    fail("The PDF is no longer available.")
}
let source = Int32(arguments[3]).flatMap { NSRunningApplication(processIdentifier: $0) }
let configuration = NSWorkspace.OpenConfiguration()
configuration.activates = true
configuration.hides = false
configuration.createsNewApplicationInstance = false
var completed = false
var recipient: NSRunningApplication?
var launchError: Error?
NSWorkspace.shared.open(
    [documentURL], withApplicationAt: applicationURL,
    configuration: configuration
) { application, error in
    recipient = application
    launchError = error
    completed = true
}
let deadline = Date().addingTimeInterval(8)
while !completed && Date() < deadline {
    RunLoop.current.run(until: Date().addingTimeInterval(0.02))
}
if let error = launchError { fail(error.localizedDescription) }
guard completed, let application = recipient else {
    fail("The selected PDF application did not finish opening in time.")
}
if !application.isActive {
    application.unhide()
    if #available(macOS 14.0, *), let source {
        _ = application.activate(from: source, options: [])
    } else {
        _ = application.activate(options: [])
    }
}
while !application.isActive && !application.isTerminated && Date() < deadline {
    RunLoop.current.run(until: Date().addingTimeInterval(0.02))
}
guard application.isActive else {
    fail("Could not bring the selected PDF application to the foreground. The reader remains open.")
}
