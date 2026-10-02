#!/bin/zsh -l
app_directory="${0:A:h}"
exec "$app_directory/release/PDFMathReader-darwin-arm64/PDFMathReader.app/Contents/MacOS/PDFMathReader"
