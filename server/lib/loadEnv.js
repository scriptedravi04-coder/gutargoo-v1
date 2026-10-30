// All server settings can come from ONE secret: GG_ENV.
// Paste the whole list into GG_ENV (one KEY=value per line, like a .env file — JSON {"KEY":"value"} also works).
// Order: .env file → separate env variables → GG_ENV (GG_ENV wins, so it is the one place to change things).
const path = require("path");

const NEVER = new Set(["PORT", "K_SERVICE", "K_REVISION", "K_CONFIGURATION", "NODE_ENV", "GG_ENV"]); // set by the host

function parse(raw) {
  let text = String(raw || "").replace(/^\uFEFF/, "").trim();
  // whole value pasted inside quotes → drop them
  const q = text[0];
  if (text.length > 1 && (q === '"' || q === "'") && text.endsWith(q)) text = text.slice(1, -1).trim();
  // some secret boxes store new lines as the two characters \n
  if (!/\r?\n/.test(text) && text.includes("\\n")) text = text.split("\\r\\n").join("\n").split("\\n").join("\n");
  if (!text) return {};
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text);
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v == null ? "" : String(v)]));
    } catch {
      /* not JSON — read as lines */
    }
  }
  let lines = text.split(/\r?\n/);
  // the secret box squashed everything onto one line → split before each KEY=
  if (lines.length === 1) lines = text.split(/[\s;]+(?=[A-Z][A-Z0-9_]*=)/);
  const out = {};
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    line = line.replace(/^export\s+/, "");
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    else val = val.replace(/\s+#.*$/, ""); // trailing comment
    out[key] = val;
  }
  return out;
}

function loadEnv() {
  require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });
  const vals = parse(process.env.GG_ENV);
  let n = 0;
  for (const [k, v] of Object.entries(vals)) {
    if (NEVER.has(k) || v === "") continue;
    process.env[k] = v;
    n++;
  }
  if (process.env.GG_ENV) console.log(n ? `✅ GG_ENV: ${n} settings loaded` : "⚠️  GG_ENV is set but no KEY=value lines were found in it");
  return n;
}

module.exports = { loadEnv, parse };
