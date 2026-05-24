/**
 * Downloads RegularPrakim.pdf (תשפ"ו) and RegularPrakim2.pdf (תשפ"ז),
 * extracts raw text, and saves it for inspection so we can write the parser.
 *
 * Usage: node scripts/inspect-pdf.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const FILES = [
  { name: "RegularPrakim.pdf", year: "5786" },
  { name: "prakim.pdf",        year: "sequence" },
];

async function fetchPdf(filename) {
  const url = `https://www.tanachyomi.co.il/PDFFiles/${filename}`;
  console.log("Fetching", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  mkdirSync(join(ROOT, "data"), { recursive: true });

  for (const { name, year } of FILES) {
    const buf = await fetchPdf(name);
    const { text } = await pdfParse(buf);
    const outPath = join(ROOT, `data/raw-${year}.txt`);
    writeFileSync(outPath, text, "utf8");
    console.log(`\n=== ${name} (first 800 chars) ===`);
    console.log(text.slice(0, 800));
    console.log(`\nFull text saved → data/raw-${year}.txt`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
