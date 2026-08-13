"use client";

import Link from "next/link";
import {
  FormEvent,
  KeyboardEvent,
  ClipboardEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import {
  AuthApiError,
  getPendingAuthEmail,
  getPendingDemoCode,
  requestEmailCode,
  verifyEmailCode,
} from "@/lib/api/auth";
import { privateReplayProps } from "@/lib/replay";

export default function VerifyLoginPage() {
  return (
    <Suspense fallback={null}>
      <VerifyLoginContent />
    </Suspense>
  );
}

function VerifyLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || getPendingAuthEmail();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(() =>
    getPendingDemoCode(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const code = useMemo(() => digits.join(""), [digits]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendAfterSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendAfterSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendAfterSeconds]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await verifyEmailCode(email, code);
      router.replace("/dashboard");
    } catch (caught) {
      if (caught instanceof AuthApiError) {
        setError(caught.message);
      } else {
        setError("We couldn't verify the code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email) {
      router.push("/login/email");
      return;
    }

    setError("");
    setIsResending(true);

    try {
      const response = await requestEmailCode(email);
      setDemoCode(response.demoCode ?? null);
      setResendAfterSeconds(response.resendAfterSeconds);
    } catch (caught) {
      if (caught instanceof AuthApiError) {
        setError(caught.message);
      } else {
        setError("We couldn't send a new code. Please try again.");
      }
    } finally {
      setIsResending(false);
    }
  }

  function updateDigit(index: number, value: string) {
    const nextDigit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = nextDigit;
      return next;
    });

    if (nextDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pastedCode = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedCode.length < 2) {
      return;
    }

    event.preventDefault();
    setDigits([
      ...pastedCode.padEnd(6, "").slice(0, 6),
    ]);
    inputRefs.current[Math.min(pastedCode.length, 6) - 1]?.focus();
  }

  return (
    <AuthShell
      subtitle="Just one more step to ensure your account remains safe."
      title="Secure your session."
      variant="secure"
    >
      <div>
        <h2 className="font-display text-3xl font-semibold leading-tight text-foreground">
          Enter verification code
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-semibold text-foreground" {...privateReplayProps()}>
            {email || "your email"}
          </span>
        </p>

        {demoCode ? (
          <p className="mt-5 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            Development code: <span className="font-semibold">{demoCode}</span>
          </p>
        ) : null}

        <form className="mt-10" onSubmit={handleSubmit}>
          <div className="grid grid-cols-6 gap-2.5" aria-label="Verification code">
            {Array.from({ length: 6 }, (_, index) => (
              <input
                aria-label={`Digit ${index + 1}`}
                className="h-14 rounded-md border border-border bg-card text-center font-display text-xl font-semibold text-foreground outline-none transition-colors focus:border-primary"
                inputMode="numeric"
                key={index}
                maxLength={1}
                placeholder="."
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                value={digits[index]}
                onChange={(event) => updateDigit(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                {...privateReplayProps()}
              />
            ))}
          </div>

          {error ? (
            <p className="mt-5 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary font-display text-sm font-bold text-primary-foreground transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || code.length !== 6 || !email}
            type="submit"
          >
            {isSubmitting ? "Verifying..." : "Verify and continue"}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-8 text-sm text-muted-foreground">
          Didn&apos;t receive the code?{" "}
          <button
            className="font-display font-semibold text-primary transition-colors hover:text-primary-accent"
            disabled={isResending || resendAfterSeconds > 0}
            type="button"
            onClick={handleResend}
          >
            {isResending
              ? "Sending..."
              : resendAfterSeconds > 0
                ? `Resend in ${resendAfterSeconds}s`
                : "Click to resend"}
          </button>
        </p>

        <Link
          className="mt-12 inline-flex items-center gap-2 font-display text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          href="/login"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Return to login
        </Link>
      </div>
    </AuthShell>
  );
}
