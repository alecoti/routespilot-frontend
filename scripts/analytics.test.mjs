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

const events = read("lib/analytics/events.ts");
const wrapper = read("lib/analytics/index.ts");
const layout = read("app/layout.tsx");
const landing = read("components/landing/landing-page.tsx");
const landingCta = read("components/landing/landing-cta.tsx");
const trial = read("components/trial/trial-page.tsx");

[
  "landing_primary_cta_clicked",
  "trial_started",
  "trial_source_selected",
  "trial_description_submitted",
  "trial_file_selected",
  "trial_file_inspected",
  "trial_value_reached",
  "auth_gate_shown",
  "auth_method_selected",
  "auth_started",
  "auth_completed",
  "trial_converted",
  "trial_failed",
  "trial_file_inspection_failed",
  "auth_failed",
  "trial_conversion_failed",
].forEach((eventName) => {
  assert(events.includes(`"${eventName}"`), `Missing event ${eventName}`);
});

["email", "file", "conversation", "message", "token", "address"].forEach(
  (pattern) => {
    assert(
      wrapper.includes(`/${pattern}/i`),
      `Analytics sanitizer must block ${pattern}`,
    );
  },
);

assert(
  layout.match(/NEXT_PUBLIC_UMAMI_SCRIPT_URL/g)?.length === 1,
  "Umami script URL should be loaded once in root layout",
);
assert(
  layout.includes("data-do-not-track=\"true\""),
  "Umami script should respect browser Do Not Track",
);

["navbar", "hero", "mid_page", "final"].forEach((location) => {
  assert(
    landing.includes(`ctaLocation="${location}"`),
    `Landing CTA location ${location} is not tracked`,
  );
});

assert(
  landingCta.includes("landing_primary_cta_clicked") &&
    landingCta.includes("captureAttribution"),
  "Landing CTA must track click and capture attribution",
);

assert(
  !trial.includes("conversationId: conversion.conversationId"),
  "Trial conversion analytics must not include conversation id",
);
assert(
  !trial.includes("fileName: file.name"),
  "Trial analytics must not include uploaded file name",
);
assert(
  trial.includes("dedupeKey: \"trial_value_reached\"") &&
    trial.includes("dedupeKey: \"auth_gate_shown\"") &&
    trial.includes("dedupeKey: \"trial_converted\""),
  "Important trial events must be deduplicated",
);
assert(
  trial.includes("auth_method: \"email_otp\"") &&
    trial.includes("onSocialAuthStart(\"google\")") &&
    trial.includes("onSocialAuthStart(\"microsoft\")"),
  "Auth method analytics must be constrained to supported methods",
);

console.log("Analytics funnel checks passed.");
