import { readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";

const source = readFileSync(new URL("../public/review-assistant/app.css", import.meta.url), "utf8");
const root = postcss.parse(source);
const prefix = ".gta-review-app";

function scopeSelector(selector) {
  return selector
    .split(",")
    .map((part) => {
      let next = part.trim();
      if (!next || next.startsWith(prefix)) return next;
      next = next.replaceAll(":root", prefix);
      next = next.replaceAll(/\bhtml\b/g, prefix);
      next = next.replaceAll(/\bbody\b/g, prefix);
      next = next.replaceAll(new RegExp(`${prefix}((?:\\[[^\\]]+\\])*) ${prefix}\\b`, "g"), `${prefix}$1`);
      if (!next.startsWith(prefix)) next = `${prefix} ${next}`;
      return next;
    })
    .join(",");
}

root.walkRules((rule) => {
  if (rule.parent?.type === "atrule" && rule.parent.name === "keyframes") return;
  rule.selectors = rule.selectors.map(scopeSelector);
});

root.append(postcss.parse(`${prefix} .app-nav{display:none !important}`));
writeFileSync(new URL("../public/review-assistant/app.scoped.css", import.meta.url), root.toString());
