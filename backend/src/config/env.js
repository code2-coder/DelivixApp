import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env before any other module executes
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// Sanitize environment variables (handles common copy-paste mistakes in cloud dashboards e.g. Render)
for (const key of Object.keys(process.env)) {
  let val = process.env[key];
  if (typeof val === "string") {
    // If the value accidentally includes the key prefix (e.g. KEY=KEY=value or KEY=value)
    if (val.startsWith(`${key}=`)) {
      val = val.substring(`${key}=`.length).trim();
      process.env[key] = val;
    }
  }
}

// Special sanitization & validation for Cloudinary URL to prevent SDK initialization fatal crash
if (process.env.CLOUDINARY_URL) {
  let url = process.env.CLOUDINARY_URL.trim();
  while (url.startsWith("CLOUDINARY_URL=")) {
    url = url.substring("CLOUDINARY_URL=".length).trim();
  }
  // Strip surrounding quotes if present
  url = url.replace(/^['"](.*)['"]$/, "$1").trim();

  if (url.startsWith("cloudinary://")) {
    process.env.CLOUDINARY_URL = url;
  } else if (url === "" || url === "undefined" || url === "null") {
    delete process.env.CLOUDINARY_URL;
  } else {
    console.warn(`[Cloudinary Warning] Invalid CLOUDINARY_URL protocol. URL should begin with 'cloudinary://'. Ignoring invalid value to prevent server crash.`);
    delete process.env.CLOUDINARY_URL;
  }
}
