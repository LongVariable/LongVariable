// Generates assets/langs.svg: a monochrome bar chart of language usage
// aggregated across all public, non-fork repos of GITHUB_USER.
import { writeFile } from "node:fs/promises";

const USER = process.env.GITHUB_USER || "LongVariable";
const ICON_COLOR = "#8b949e"; // neutral grey, readable on light and dark background
const BAR_COLOR = "#8b949e";
const TEXT_COLOR = "#8b949e";
const MAX_LANGS = 8;

// GitHub language name -> simple-icons slug (github.com/simple-icons/simple-icons)
const ICON_SLUGS = {
  JavaScript: "javascript",
  TypeScript: "typescript",
  Python: "python",
  HTML: "html5",
  CSS: "css3",
  "C#": "csharp",
  C: "c",
  "C++": "cplusplus",
  Java: "openjdk",
  Shell: "gnubash",
  Go: "go",
  Rust: "rust",
  PHP: "php",
  Ruby: "ruby",
  Swift: "swift",
  Kotlin: "kotlin",
  Dart: "dart",
  Vue: "vuedotjs",
  Dockerfile: "docker",
  Lua: "lua",
};

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "langs-svg-generator", Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function fetchIconPath(slug) {
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`);
    if (!res.ok) return null;
    const svg = await res.text();
    const match = svg.match(/<path d="([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  const repos = await fetchJson(
    `https://api.github.com/users/${USER}/repos?per_page=100&type=owner`
  );

  const totals = {};
  for (const repo of repos) {
    if (repo.fork) continue;
    const langs = await fetchJson(repo.languages_url);
    for (const [lang, bytes] of Object.entries(langs)) {
      totals[lang] = (totals[lang] || 0) + bytes;
    }
  }

  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const rows = Object.entries(totals)
    .map(([lang, bytes]) => ({ lang, pct: (bytes / sum) * 100 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, MAX_LANGS);

  const icons = {};
  for (const { lang } of rows) {
    const slug = ICON_SLUGS[lang];
    if (slug) icons[lang] = await fetchIconPath(slug);
  }

  const rowHeight = 34;
  const paddingY = 12;
  const width = 480;
  const iconSize = 16;
  const labelX = 26;
  const labelWidth = 110;
  const barX = labelX + labelWidth;
  const maxBarWidth = 220;
  const pctX = barX + maxBarWidth + 12;
  const height = rows.length * rowHeight + paddingY * 2;
  const maxPct = rows[0]?.pct || 1;

  const rowsSvg = rows
    .map(({ lang, pct }, i) => {
      const y = paddingY + i * rowHeight;
      const cy = y + iconSize / 2;
      const barWidth = Math.max((pct / maxPct) * maxBarWidth, 3);
      const iconPath = icons[lang];
      const icon = iconPath
        ? `<g transform="translate(0, ${y})"><svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><path d="${iconPath}" fill="${ICON_COLOR}"/></svg></g>`
        : "";
      return `
    <g font-family="'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif">
      ${icon}
      <text x="${labelX}" y="${cy + 4}" font-size="13" fill="${TEXT_COLOR}">${lang}</text>
      <rect x="${barX}" y="${cy - 5}" width="${maxBarWidth}" height="10" rx="5" fill="${BAR_COLOR}" opacity="0.15"/>
      <rect x="${barX}" y="${cy - 5}" width="${barWidth}" height="10" rx="5" fill="${BAR_COLOR}"/>
      <text x="${pctX}" y="${cy + 4}" font-size="12" fill="${TEXT_COLOR}">${pct.toFixed(1)}%</text>
    </g>`;
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${rowsSvg}
</svg>`;

  await writeFile("assets/langs.svg", svg);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
