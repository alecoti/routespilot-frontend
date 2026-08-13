"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthApiError, requestEmailCode } from "@/lib/api/auth";
import { privateReplayProps } from "@/lib/replay";

export default function EmailLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await requestEmailCode(email);
      const searchParams = new URLSearchParams({ email: response.email });
      router.push(`/login/verify?${searchParams.toString()}`);
    } catch (caught) {
      if (caught instanceof AuthApiError) {
        setError(caught.message);
      } else {
        setError("We couldn't send the code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      subtitle="No password required. We'll send a short-lived code to confirm this session."
      title="Secure your session."
      variant="secure"
    >
      <div>
        <h2 className="font-display text-3xl font-semibold leading-tight text-foreground">
          Login with email
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Enter your work email and we&apos;ll send a verification code.
        </p>

        <form className="mt-10 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="font-display text-sm font-semibold text-foreground">
              Email address
            </span>
            <span className="mt-2 flex h-12 items-center gap-3 rounded-md border border-border bg-card px-4 focus-within:border-primary">
              <Mail aria-hidden className="h-4 w-4 text-muted-foreground" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                inputMode="email"
                name="email"
                placeholder="marco@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                {...privateReplayProps()}
              />
            </span>
          </label>

          {error ? (
            <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary font-display text-sm font-bold text-primary-foreground transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Sending code..." : "Send verification code"}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </button>
        </form>

        <Link
          className="mt-10 inline-flex items-center gap-2 font-display text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          href="/login"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Return to login
        </Link>
      </div>
    </AuthShell>
  );
}
