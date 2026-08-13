import Link from "next/link";
import { Mail } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import {
  getGoogleAuthStartUrl,
  getMicrosoftAuthStartUrl,
} from "@/lib/api/auth";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const authError = Array.isArray(params.authError)
    ? params.authError[0]
    : params.authError;
  const googleEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED?.trim().toLowerCase() === "true";
  const microsoftEnabled =
    process.env.NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED?.trim().toLowerCase() ===
    "true";

  return (
    <AuthShell
      subtitle="Intelligent routing algorithms that reduce fuel costs, improve delivery times, and maximize your fleet's potential."
      title="Optimize every mile."
      variant="login"
    >
      <div>
        <h2 className="font-display text-3xl font-semibold leading-tight text-foreground">
          Welcome back
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Log in to manage your fleet
        </p>

        <div className="mt-10 space-y-3">
          {googleEnabled ? (
            <a
              className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 font-display text-sm font-semibold text-foreground transition-colors hover:bg-surface-low"
              href={getGoogleAuthStartUrl("/dashboard")}
            >
              <GoogleGlyph />
              Continue with Google
            </a>
          ) : (
            <button
              className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-3 rounded-md border border-border bg-surface-low px-4 font-display text-sm font-semibold text-muted-foreground"
              disabled
              type="button"
            >
              <GoogleGlyph />
              Google coming soon
            </button>
          )}
          {microsoftEnabled ? (
            <a
              className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 font-display text-sm font-semibold text-foreground transition-colors hover:bg-surface-low"
              href={getMicrosoftAuthStartUrl("/dashboard")}
            >
              <MicrosoftGlyph />
              Continue with Microsoft
            </a>
          ) : (
            <button
              className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-3 rounded-md border border-border bg-surface-low px-4 font-display text-sm font-semibold text-muted-foreground"
              disabled
              type="button"
            >
              <MicrosoftGlyph />
              Microsoft coming soon
            </button>
          )}
        </div>

        {authError ? (
          <p className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {friendlyAuthProviderError(authError)}
          </p>
        ) : null}

        <div className="my-8 flex items-center gap-4">
          <span className="h-px flex-1 bg-border" />
          <span className="font-display text-xs font-semibold uppercase text-muted-foreground">
            Or
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Link
          className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 font-display text-sm font-semibold text-foreground transition-colors hover:bg-surface-low"
          href="/login/email"
        >
          <Mail aria-hidden className="h-4 w-4 text-muted-foreground" />
          Login with email
        </Link>

        <Link
          className="mt-14 inline-flex font-display text-xs font-semibold text-foreground/80 transition-colors hover:text-primary"
          href="/login/email"
        >
          Trouble logging in?
        </Link>
      </div>
    </AuthShell>
  );
}

function friendlyAuthProviderError(code: string) {
  if (code === "google_cancelled") {
    return "Google sign-in was cancelled.";
  }

  if (code === "google_email_unverified") {
    return "Google has not verified that email address. Try email login instead.";
  }

  if (code === "google_expired") {
    return "Google sign-in expired. Please try again.";
  }

  if (code === "microsoft_cancelled") {
    return "Microsoft sign-in was cancelled.";
  }

  if (code === "microsoft_email_unavailable") {
    return "Microsoft did not provide a usable email address. Try email login instead.";
  }

  if (code === "microsoft_expired") {
    return "Microsoft sign-in expired. Please try again.";
  }

  if (code === "microsoft_failed") {
    return "We couldn't sign you in with Microsoft. Please try again.";
  }

  return "We couldn't sign you in with Google. Please try again.";
}

function GoogleGlyph() {
  return (
    <span
      aria-hidden
      className="flex h-4 w-4 items-center justify-center font-display text-sm font-bold"
    >
      <span className="text-[#4285f4]">G</span>
    </span>
  );
}

function MicrosoftGlyph() {
  return (
    <span aria-hidden className="grid h-4 w-4 grid-cols-2 gap-0.5">
      <span className="bg-[#f25022]" />
      <span className="bg-[#7fba00]" />
      <span className="bg-[#00a4ef]" />
      <span className="bg-[#ffb900]" />
    </span>
  );
}
