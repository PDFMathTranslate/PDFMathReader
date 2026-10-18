const previews = {
  mac: ["preview.png", "macOS", 1081, 1123],
  windows: ["preview-windows.png", "Windows", 1930, 2090],
  linux: ["preview-linux.png", "Linux", 915, 859],
};
for (const button of document.querySelectorAll("[data-platform]")) {
  button.addEventListener("click", () => {
    const [file, label, width, height] = previews[button.dataset.platform];
    const image = document.querySelector("#app-preview");
    image.src = `./media/${file}`;
    image.width = width;
    image.height = height;
    image.alt = document.body.dataset.readerTemplate.replace(
      "{platform}",
      label,
    );
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
      document.body.dataset.previewTemplate.replace(
        "{name}",
        button.textContent.trim(),
      );
  });
}
document.querySelector("#replay").addEventListener("click", () => {
  document.querySelector("#reader-demo").src =
    `./reader.html?locale=${document.documentElement.lang}&replay=${Date.now()}`;
});

const languages = new Set(["en", "zh-CN", "ja", "ko", "fr", "es", "hi", "bn"]);
document.querySelector("#site-language").addEventListener("change", (event) => {
  const language = event.target.value;
  if (!languages.has(language)) return;
  const page = language === "en" ? "index.html" : `index.${language}.html`;
  const destination = new URL(page, location.href);
  destination.hash = location.hash;
  location.assign(destination.href);
});
