import AppKit
import Foundation
let output=CommandLine.arguments[1]
try FileManager.default.createDirectory(atPath:output,withIntermediateDirectories:true)
for name in ["sidebar.left","minus.magnifyingglass","plus.magnifyingglass","gearshape","doc.badge.plus","xmark","character.book.closed","doc.text","checkmark.circle","trash","arrow.left.and.right","arrow.up.and.down","chevron.up","chevron.down"] {
 guard let image=NSImage(systemSymbolName:name,accessibilityDescription:nil)?.withSymbolConfiguration(NSImage.SymbolConfiguration(pointSize:22,weight:.regular)) else { fatalError("Missing system symbol: \(name)") }
 let canvas=NSImage(size:NSSize(width:28,height:28))
 canvas.lockFocus()
 let size=image.size,scale=min(26/size.width,26/size.height)
 image.draw(in:NSRect(x:(28-size.width*scale)/2,y:(28-size.height*scale)/2,width:size.width*scale,height:size.height*scale))
 canvas.unlockFocus()
 guard let tiff=canvas.tiffRepresentation,let bitmap=NSBitmapImageRep(data:tiff),let png=bitmap.representation(using:.png,properties:[:]) else {fatalError("Symbol rasterization failed")}
 try png.write(to:URL(fileURLWithPath:output).appendingPathComponent(name+".png"))
}
print("Exported macOS system symbols")
