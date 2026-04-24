#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const _root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Points hellokiyo.com and www.hellokiyo.com at the Cloudflare Pages project via proxied CNAMEs.
 * Token: Dashboard → My Profile → API Tokens → "Edit zone DNS" → limit zone to hellokiyo.com
 * Pass token via env CLOUDFLARE_API_TOKEN=... or a project file .env.cf (one line, gitignored by .env.*)
 */
function loadToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN.trim();
  const f = join(_root, ".env.cf");
  if (!existsSync(f)) return "";
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^CLOUDFLARE_API_TOKEN\s*=\s*(.+)$/);
    if (m) return m[1].replace(/^["']|["']$/g, "").trim();
  }
  return "";
}

const token = loadToken();
if (!token) {
  console.error("Add CLOUDFLARE_API_TOKEN to the environment, or create .env.cf in the repo root:");
  console.error("  CLOUDFLARE_API_TOKEN=your_token");
  process.exit(1);
}

const ZONE_ID = "b2590f2d0d70596aa421ea7b512eb41a";
const ACCOUNT_ID = "1df463f78529f0cc41538126db883495";
const PROJECT = "hellokiyo";
const PAGES_TARGET = "hellokiyo.pages.dev";

async function cloudflare(path, { method = "GET", body } = {}) {
  const r = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    const err = data.errors?.[0]?.message || data.error_chain || text || r.status;
    throw new Error(`${method} ${path} → ${r.status}: ${err}`);
  }
  return data;
}

function dnsBase() {
  return `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records`;
}

async function listAll() {
  const u = new URL(dnsBase());
  u.searchParams.set("per_page", "100");
  const d = await cloudflare(u, { method: "GET" });
  return d.result || [];
}

async function deleteRecord(id) {
  return cloudflare(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${id}`, {
    method: "DELETE",
  });
}

async function ensureCname(relativeName) {
  const existing = await listAll();
  const wantFqdn = relativeName === "@" ? "hellokiyo.com" : `${relativeName}.hellokiyo.com`;
  for (const rec of existing) {
    if (rec.name.toLowerCase() !== wantFqdn.toLowerCase()) continue;
    if (rec.type === "CNAME" && rec.content === PAGES_TARGET) {
      console.log("Already OK:", wantFqdn, "→", PAGES_TARGET);
      return;
    }
    await deleteRecord(rec.id);
    console.log("Removed:", rec.type, rec.name, "→", rec.content);
  }
  await cloudflare(dnsBase(), {
    method: "POST",
    body: { type: "CNAME", name: relativeName, content: PAGES_TARGET, proxied: true, ttl: 1 },
  });
  console.log("Created CNAME:", wantFqdn, "→", PAGES_TARGET);
}

async function revalidatePagesDomain(hostname) {
  const path = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/domains/${encodeURIComponent(hostname)}`;
  return cloudflare(path, { method: "PATCH" });
}

async function main() {
  await ensureCname("www");
  await ensureCname("@");
  for (const host of ["www.hellokiyo.com", "hellokiyo.com"]) {
    try {
      const d = await revalidatePagesDomain(host);
      console.log("Pages domain status", host, d.result?.status, d.result?.validation_data?.status || "");
    } catch (e) {
      console.warn("Pages PATCH", host, e.message);
    }
  }
  console.log("\nDone. SSL may take a few minutes. Check: Workers & Pages → hellokiyo → Custom domains");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
