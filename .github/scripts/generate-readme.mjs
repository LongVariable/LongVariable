// Rewrites README.md stats block with live GitHub data for USER.
// Plain text output (no generated images) — only numbers change on each run.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const USER = process.env.GITHUB_USER || "LongVariable";
const START_MARK = "<!-- STATS:START -->";
const END_MARK = "<!-- STATS:END -->";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "readme-stats-generator" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "readme-stats-generator" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

const ICON_COLOR = "#8b949e";

async function saveOcticon(name) {
  const svg = await fetchText(`https://cdn.jsdelivr.net/npm/@primer/octicons/build/svg/${name}-16.svg`);
  const colored = svg.replace("<path ", `<path fill="${ICON_COLOR}" `);
  await mkdir("assets/icons", { recursive: true });
  await writeFile(`assets/icons/${name}.svg`, colored);
  return `<img src="assets/icons/${name}.svg" width="16" align="absmiddle"/>`;
}

function yearsAgo(fromDate, toDate) {
  let years = toDate.getUTCFullYear() - fromDate.getUTCFullYear();
  const anniversary = new Date(Date.UTC(toDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
  if (toDate < anniversary) years -= 1;
  return Math.max(years, 0);
}

async function fetchYearCounts(year) {
  const html = await fetchText(
    `https://github.com/users/${USER}/contributions?from=${year}-01-01&to=${year}-12-31`
  );
  const dates = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
  const tooltips = [...html.matchAll(/(No|\d+) contributions? on [A-Za-z]+ \d+/g)].map((m) => m[0]);
  const counts = new Map();
  for (let i = 0; i < dates.length && i < tooltips.length; i++) {
    const n = tooltips[i].startsWith("No") ? 0 : parseInt(tooltips[i], 10);
    counts.set(dates[i], n);
  }
  return counts;
}

function currentStreak(counts, today) {
  const toKey = (d) => d.toISOString().slice(0, 10);
  let cursor = new Date(today);
  if ((counts.get(toKey(cursor)) || 0) === 0) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while ((counts.get(toKey(cursor)) || 0) > 0) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

async function main() {
  const user = await fetchJson(`https://api.github.com/users/${USER}`);
  const created = new Date(user.created_at);
  const today = new Date();

  const repos = await fetchJson(`https://api.github.com/users/${USER}/repos?per_page=100`);
  const totalSizeKb = repos.reduce((sum, r) => sum + (r.size || 0), 0);
  const gbUsed = totalSizeKb / (1024 * 1024);

  const startYear = created.getUTCFullYear();
  const endYear = today.getUTCFullYear();
  let allCounts = new Map();
  for (let y = startYear; y <= endYear; y++) {
    const yearCounts = await fetchYearCounts(y);
    for (const [date, count] of yearCounts) allCounts.set(date, count);
  }

  const totalCommits = [...allCounts.values()].reduce((a, b) => a + b, 0);
  const streak = currentStreak(allCounts, today);
  const years = yearsAgo(created, today);
  const yearLabel = years === 1 ? "year" : "years";

  const [calendarIcon, repoIcon, databaseIcon, commitIcon, flameIcon] = await Promise.all([
    saveOcticon("calendar"),
    saveOcticon("repo"),
    saveOcticon("database"),
    saveOcticon("git-commit"),
    saveOcticon("flame"),
  ]);

  const lines = [
    `${calendarIcon} Joined GitHub ${years} ${yearLabel} ago`,
    `${repoIcon} ${user.public_repos} Repositories`,
    `${databaseIcon} ${gbUsed.toFixed(2)} GB used`,
    `${commitIcon} ${totalCommits} commits`,
    `${flameIcon} ${streak} day streak of commits`,
  ];

  const block = `${START_MARK}\n${lines.join("<br/>\n")}\n${END_MARK}`;

  const readme = await readFile("README.md", "utf8");
  const re = new RegExp(`${START_MARK}[\\s\\S]*?${END_MARK}`);
  const updated = re.test(readme) ? readme.replace(re, block) : `${readme.trimEnd()}\n\n${block}\n`;
  await writeFile("README.md", updated);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
