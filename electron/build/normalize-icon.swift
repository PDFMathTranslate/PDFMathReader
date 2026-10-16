import AppKit

// Match the opaque body of the local macOS Preview/Notes icons (206/256).
// Measure the body, not the translucent drop shadow; keep the entire original
// image when drawing so its shadow and antialiased edges remain intact.
let side = 1024
let bodyFraction = 206.0 / 256.0
let arguments = Array(CommandLine.arguments.dropFirst())
precondition(arguments.count > 0 && arguments.count % 2 == 0)
for index in stride(from: 0, to: arguments.count, by: 2) {
    let source = arguments[index]
    let destination = arguments[index + 1]
    guard let image = NSImage(contentsOfFile: source),
        let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
        let pixels = CGContext(
            data: nil, width: cgImage.width, height: cgImage.height,
            bitsPerComponent: 8, bytesPerRow: cgImage.width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else {
        fatalError("Cannot decode artwork: \(source)")
    }
    let width = cgImage.width
    let height = cgImage.height
    pixels.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
    let data = pixels.data!.assumingMemoryBound(to: UInt8.self)
    var left = width
    var top = height
    var right = 0
    var bottom = 0
    for y in 0..<height {
        for x in 0..<width {
            if data[(y * width + x) * 4 + 3] >= 128 {
                left = min(left, x)
                right = max(right, x + 1)
                top = min(top, y)
                bottom = max(bottom, y + 1)
            }
        }
    }
    precondition(right > left && bottom > top, "Artwork has no opaque body")
    let scale = Double(side) * bodyFraction / Double(max(right - left, bottom - top))
    let x = Double(side) / 2 - Double(left + right) / 2 * scale
    let y = Double(side) / 2 - Double(height - (top + bottom) / 2) * scale
    let output = CGContext(
        data: nil, width: side, height: side, bitsPerComponent: 8,
        bytesPerRow: side * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    output.interpolationQuality = .high
    output.draw(
        cgImage,
        in: CGRect(x: x, y: y, width: Double(width) * scale, height: Double(height) * scale))
    let png = NSBitmapImageRep(cgImage: output.makeImage()!).representation(
        using: .png, properties: [:])!
    try png.write(to: URL(fileURLWithPath: destination))
    print("\(source): body \(right-left)×\(bottom-top) → 824×824 on 1024px canvas")
}
