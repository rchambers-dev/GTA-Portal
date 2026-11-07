try {
  const appearance = JSON.parse(localStorage.getItem("review-assistant-appearance") || "{}");
  if (appearance.theme) document.documentElement.dataset.theme = appearance.theme;
  if (appearance.text) document.documentElement.dataset.text = appearance.text;
  if (appearance.font) document.documentElement.dataset.font = appearance.font;
} catch {
  // A bad stored value must not stop the page. The default appearance still applies.
}
