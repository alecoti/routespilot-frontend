import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";

const root = cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const openReplay = read("lib/replay/openreplay.ts");
const privacy = read("lib/replay/privacy.ts");
const provider = read("components/replay/replay-provider.tsx");
const layout = read("app/layout.tsx");
const trial = read("components/trial/trial-page.tsx");
const emailLogin = read("app/(auth)/login/email/page.tsx");
const verifyLogin = read("app/(auth)/login/verify/page.tsx");
const vercel = read("vercel.json");

assert(
  openReplay.includes("NEXT_PUBLIC_OPENREPLAY_ENABLED") &&
    openReplay.includes("return false"),
  "OpenReplay must be config gated and disabled safely",
);
assert(
  openReplay.includes("try {") && openReplay.includes("catch {"),
  "OpenReplay failures must be swallowed safely",
);
assert(
  openReplay.includes("privateMode: true"),
  "OpenReplay must use privateMode by default",
);
assert(
  openReplay.includes("capturePayload: false") &&
    openReplay.includes("ignoreHeaders: true") &&
    openReplay.includes("sessionTokenHeader: false"),
  "Network payloads, headers and session token capture must be disabled",
);
assert(
  openReplay.includes("setUserID") === false &&
    openReplay.includes("identify(") === false,
  "Replay must not identify users with email/name or direct identity",
);
[
  "/\\/auth(\\/|$)/i",
  "/\\/chat(\\/|$)/i",
  "/\\/agentic(\\/|$)/i",
  "/\\/planning(\\/|$)/i",
  "/\\/attachments(\\/|$)/i",
  "/\\/optimizations(\\/|$)/i",
  "/\\/geocode(\\/|$)/i",
  "/\\/exports(\\/|$)/i",
].forEach((pattern) => {
  assert(privacy.includes(pattern), `Missing sensitive route sanitizer ${pattern}`);
});
["code", "state", "token", "email", "otp", "signature"].forEach((key) => {
  assert(privacy.includes(`"${key}"`), `Missing sensitive query key ${key}`);
});
assert(
  trial.includes("privateReplayProps") &&
    emailLogin.includes("privateReplayProps") &&
    verifyLogin.includes("privateReplayProps"),
  "Trial and auth inputs/content must be marked private",
);
assert(
  provider.includes('pathname === "/"') &&
    provider.includes('pathname === "/try"') &&
    provider.includes('startsWith("/login")'),
  "Replay provider must initially cover landing, try and auth surfaces only",
);
assert(
  layout.includes("<ReplayProvider />"),
  "Replay provider must be initialized once from root layout",
);
assert(
  vercel.includes('"value": "routesplan.it"') &&
    vercel.includes('"destination": "https://routespilot.eu/$1"') &&
    vercel.includes('"permanent": true'),
  "routesplan.it must permanently redirect to routespilot.eu",
);

console.log("Replay privacy checks passed.");
