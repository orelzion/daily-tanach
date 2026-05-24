import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Sun rising over open book icon
// Colors match the provided asset: warm cream bg, navy book, gold sun + rays
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <radialGradient id="sg" cx="40%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#F7D060"/>
      <stop offset="100%" stop-color="#D08818"/>
    </radialGradient>
  </defs>

  <!-- Warm cream background -->
  <rect width="1024" height="1024" rx="190" ry="190" fill="#FAF8F1"/>

  <!-- Sun rays drawn under sun; sun circle covers their inner ends -->
  <g fill="#C8861A">
    <rect transform="rotate(-64, 512, 555)" x="501" y="305" width="22" height="250" rx="11"/>
    <rect transform="rotate(-48, 512, 555)" x="501" y="305" width="22" height="250" rx="11"/>
    <rect transform="rotate(-32, 512, 555)" x="501" y="305" width="22" height="250" rx="11"/>
    <rect transform="rotate(-16, 512, 555)" x="501" y="305" width="22" height="250" rx="11"/>
    <rect transform="rotate(0,   512, 555)" x="501" y="305" width="22" height="250" rx="11"/>
    <rect transform="rotate(16,  512, 555)" x="501" y="305" width="22" height="250" rx="11"/>
    <rect transform="rotate(32,  512, 555)" x="501" y="305" width="22" height="250" rx="11"/>
    <rect transform="rotate(48,  512, 555)" x="501" y="305" width="22" height="250" rx="11"/>
    <rect transform="rotate(64,  512, 555)" x="501" y="305" width="22" height="250" rx="11"/>
  </g>

  <!-- Sun (covers inner ray ends, bottom half hidden by book) -->
  <circle cx="512" cy="555" r="112" fill="url(#sg)"/>

  <!-- Book: left page -->
  <path d="M 512,555 C 455,618 265,705 100,782 Q 62,862 115,938 Q 312,988 512,988 Z" fill="#1B2C4C"/>
  <!-- Book: right page -->
  <path d="M 512,555 C 569,618 759,705 924,782 Q 962,862 909,938 Q 712,988 512,988 Z" fill="#1B2C4C"/>
</svg>`;

async function run() {
  mkdirSync(join(root, "public/icons"), { recursive: true });

  const svgBuf = Buffer.from(SVG);

  const sizes = [
    { size: 512,  out: "public/icons/icon-512.png" },
    { size: 192,  out: "public/icons/icon-192.png" },
    { size: 180,  out: "public/icons/apple-touch-icon.png" },
    { size: 32,   out: "app/icon.png" },
  ];

  for (const { size, out } of sizes) {
    await sharp(svgBuf).resize(size, size).png().toFile(join(root, out));
    console.log(`✓ ${out} (${size}×${size})`);
  }

  // Also save the source SVG for reference
  writeFileSync(join(root, "public/icons/icon.svg"), SVG);
  console.log("✓ public/icons/icon.svg");
}

run().catch((err) => { console.error(err); process.exit(1); });
