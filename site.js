const previews = {
  mac: ["preview.png", "macOS"],
  windows: ["preview-windows.png", "Windows"],
  linux: ["preview-linux.png", "Linux"],
};
for (const button of document.querySelectorAll("[data-platform]")) {
  button.addEventListener("click", () => {
    const [file, label, width, height] = previews[button.dataset.platform];
    const image = document.querySelector("#app-preview");
    image.src = `./media/${file}`;
    image.width = width;
    image.height = height;
    image.alt = `PDFMathReader ${label} 阅读器界面`;
    for (const choice of document.querySelectorAll("[data-platform]"))
      choice.setAttribute("aria-pressed", String(choice === button));
  });
}
for (const button of document.querySelectorAll("[data-icon]")) {
  button.addEventListener("click", () => {
    for (const image of document.querySelectorAll(".brand-icon"))
      image.src = `./media/${button.dataset.icon}.png`;
    for (const choice of document.querySelectorAll("[data-icon]"))
      choice.setAttribute("aria-pressed", String(choice === button));
    document.querySelector(".icon-status").textContent =
      `正在预览：${button.textContent.trim()}。此选择仅改变网页预览。`;
  });
}
document.querySelector("#replay").addEventListener("click", () => {
  document.querySelector("#reader-demo").src =
    `./reader.html?replay=${Date.now()}`;
});
