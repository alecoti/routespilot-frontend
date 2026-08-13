"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Mail,
  Send,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  AuthApiError,
  fetchCurrentAuthSession,
  getGoogleAuthStartUrl,
  getMicrosoftAuthStartUrl,
  requestEmailCode,
  verifyEmailCode,
} from "@/lib/api/auth";
import { clearStoredConversationId, storeConversationId } from "@/lib/api/conversations";
import {
  convertTrialSession,
  fetchCurrentTrial,
  sendTrialMessage,
  startTrialSession,
  TrialApiError,
  uploadTrialFile,
  type TrialAttachment,
  type TrialPayload,
} from "@/lib/api/trial";
import {
  captureAttribution,
  isAuthMethod,
  trackEvent,
  type AuthMethod,
  type ErrorCategory,
  type TrialSource,
} from "@/lib/analytics";
import { privateReplayProps } from "@/lib/replay";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/ui/logo-mark";

type TrialState =
  | "START"
  | "DESCRIBING"
  | "UPLOADING"
  | "PLAN_STARTED"
  | "AUTH_REQUIRED"
  | "AUTHENTICATING"
  | "CONVERTING"
  | "CONTINUING"
  | "ERROR";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const examplePrompt =
  "I have 3 vans and 24 deliveries around Milan tomorrow. Some customers need morning delivery, and vans have limited pallet capacity.";

export function TrialPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<TrialState>("START");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [payload, setPayload] = useState<TrialPayload>({});
  const [attachments, setAttachments] = useState<TrialAttachment[]>([]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [authEmailSent, setAuthEmailSent] = useState(false);
  const [trialSource, setTrialSource] = useState<TrialSource>("describe");
  const oauthMethodParam = searchParams.get("authMethod");
  const [authMethod, setAuthMethod] = useState<AuthMethod | undefined>(
    isAuthMethod(oauthMethodParam) ? oauthMethodParam : undefined,
  );
  const [googleEnabled] = useState(
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED?.trim().toLowerCase() === "true",
  );
  const [microsoftEnabled] = useState(
    process.env.NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED?.trim().toLowerCase() ===
      "true",
  );

  const continueAfterAuth = searchParams.get("continueTrial") === "1";

  const hydrateTrial = useCallback(
    (nextPayload: TrialPayload, nextAttachments: TrialAttachment[]) => {
      setPayload(nextPayload);
      setAttachments(nextAttachments);
      setMessages(
        (nextPayload.messages ?? []).filter(
          (message): message is ChatMessage =>
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string",
        ),
      );
    },
    [],
  );

  const convertAndContinue = useCallback(async () => {
    setError("");
    setState("CONVERTING");

    try {
      const conversion = await convertTrialSession();
      storeConversationId(conversion.conversationId);
      trackEvent(
        "trial_converted",
        {
          trial_source: trialSource,
          auth_method: authMethod,
          conversion_status: conversion.alreadyConverted
            ? "already_converted"
            : "new",
        },
        { dedupeKey: "trial_converted" },
      );
      setState("CONTINUING");
      router.replace("/optimize");
    } catch (caught) {
      setState("AUTH_REQUIRED");
      trackEvent("trial_conversion_failed", {
        error_category: errorCategory(caught),
      });
      setError(friendlyTrialError(caught));
    }
  }, [authMethod, router, trialSource]);

  useEffect(() => {
    captureAttribution();

    if (continueAfterAuth) {
      if (authMethod) {
        trackEvent(
          "auth_completed",
          { auth_method: authMethod },
          { dedupeKey: `auth_completed_${authMethod}` },
        );
      }
      trackEvent(
        "auth_gate_shown",
        { trial_source: trialSource, gate_reason: "continue_trial" },
        { dedupeKey: "auth_gate_continue_trial" },
      );
      const timer = window.setTimeout(() => {
        void convertAndContinue();
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    async function boot() {
      try {
        await fetchCurrentAuthSession();
        if (!cancelled) {
          clearStoredConversationId();
          router.replace("/optimize");
        }
      } catch {
        try {
          await startTrialSession();
          trackEvent(
            "trial_started",
            { trial_source: trialSource },
            { dedupeKey: "trial_started" },
          );
          const current = await fetchCurrentTrial();
          if (!cancelled) {
            hydrateTrial(current.payload, current.attachments);
            setState(current.authRequired ? "AUTH_REQUIRED" : "START");
          }
        } catch (caught) {
          if (!cancelled) {
            setState("ERROR");
            trackEvent("trial_failed", {
              error_category: errorCategory(caught),
            });
            setError(friendlyTrialError(caught));
          }
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [authMethod, continueAfterAuth, convertAndContinue, hydrateTrial, router, trialSource]);

  const insightLabels = useMemo(
    () => (payload.insights ?? []).map((insight) => insight.label),
    [payload.insights],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message) {
      return;
    }

    setError("");
    setPrompt("");
    setState("DESCRIBING");
    setMessages((current) => [...current, { role: "user", content: message }]);
    setTrialSource((current) => current || "describe");
    trackEvent("trial_description_submitted", {
      trial_source: trialSource,
    });

    try {
      const response = await sendTrialMessage(message);
      setPayload(response.payload);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.assistantMessage },
      ]);
      trackEvent(
        "trial_value_reached",
        {
          trial_source: trialSource,
          value_type: "description_interpreted",
        },
        { dedupeKey: "trial_value_reached" },
      );
      if (response.authRequired) {
        trackEvent(
          "auth_gate_shown",
          { trial_source: trialSource, gate_reason: "message" },
          { dedupeKey: "auth_gate_shown" },
        );
        setState("AUTH_REQUIRED");
      } else {
        setState("PLAN_STARTED");
      }
    } catch (caught) {
      setState("ERROR");
      trackEvent("trial_failed", {
        error_category: errorCategory(caught),
      });
      setError(friendlyTrialError(caught));
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    setError("");
    setState("UPLOADING");
    setTrialSource("upload");
    trackEvent("trial_file_selected", { trial_source: "upload" });

    try {
      const response = await uploadTrialFile(file);
      setPayload(response.payload);
      setAttachments((current) => [...current, response.attachment]);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.assistantMessage },
      ]);
      trackEvent("trial_file_inspected", { trial_source: "upload" });
      trackEvent(
        "trial_value_reached",
        {
          trial_source: "upload",
          value_type: "file_inspected",
        },
        { dedupeKey: "trial_value_reached" },
      );
      trackEvent(
        "auth_gate_shown",
        { trial_source: "upload", gate_reason: "upload" },
        { dedupeKey: "auth_gate_shown" },
      );
      setState("AUTH_REQUIRED");
    } catch (caught) {
      setState("ERROR");
      trackEvent("trial_file_inspection_failed", {
        error_category: errorCategory(caught),
      });
      setError(friendlyTrialError(caught));
    }
  }

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("AUTHENTICATING");
    setAuthMethod("email_otp");
    trackEvent("auth_method_selected", { auth_method: "email_otp" });
    trackEvent("auth_started", { auth_method: "email_otp" });

    try {
      const response = await requestEmailCode(email);
      setEmail(response.email);
      setDemoCode(response.demoCode ?? null);
      setAuthEmailSent(true);
      setState("AUTH_REQUIRED");
    } catch (caught) {
      setState("AUTH_REQUIRED");
      trackEvent("auth_failed", {
        auth_method: "email_otp",
        error_category: errorCategory(caught),
      });
      setError(friendlyAuthError(caught));
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("AUTHENTICATING");

    try {
      await verifyEmailCode(email, code);
      trackEvent(
        "auth_completed",
        { auth_method: "email_otp" },
        { dedupeKey: "auth_completed_email_otp" },
      );
      await convertAndContinue();
    } catch (caught) {
      setState("AUTH_REQUIRED");
      trackEvent("auth_failed", {
        auth_method: "email_otp",
        error_category: errorCategory(caught),
      });
      setError(friendlyAuthError(caught));
    }
  }

  const busy =
    state === "DESCRIBING" ||
    state === "UPLOADING" ||
    state === "AUTHENTICATING" ||
    state === "CONVERTING" ||
    state === "CONTINUING";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" aria-label="RoutesPlan home">
            <LogoMark />
          </Link>
          <Link
            className="rounded-md px-3 py-2 font-display text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:px-6 lg:grid-cols-[1fr_360px] lg:py-12">
        <div className="rounded-lg border border-border bg-card shadow-[0_16px_50px_rgba(26,28,29,0.06)]">
          <div className="border-b border-border px-5 py-4">
            <p className="font-display text-sm font-semibold text-primary">
              Start a route plan
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">
              What do you need to plan?
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Describe the delivery problem or upload a file. RoutesPlan will
              begin understanding it before asking you to sign in and save.
            </p>
          </div>

          <div className="space-y-5 p-5">
            {messages.length === 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <ModeButton
                  icon={Send}
                  label="Describe it"
                  onClick={() => {
                    setTrialSource("describe");
                    trackEvent("trial_source_selected", {
                      trial_source: "describe",
                    });
                    setPrompt("");
                  }}
                />
                <ModeButton
                  icon={Upload}
                  label="Upload a file"
                  onClick={() => {
                    setTrialSource("upload");
                    trackEvent("trial_source_selected", {
                      trial_source: "upload",
                    });
                    fileInputRef.current?.click();
                  }}
                />
                <ModeButton
                  icon={Bot}
                  label="Try an example"
                  onClick={() => {
                    setTrialSource("example");
                    trackEvent("trial_source_selected", {
                      trial_source: "example",
                    });
                    setPrompt(examplePrompt);
                  }}
                />
              </div>
            ) : null}

            <div
              className="min-h-[220px] space-y-4 rounded-md border border-border bg-background p-4"
              {...privateReplayProps()}
            >
              {messages.length ? (
                messages.map((message, index) => (
                  <div
                    className={cn(
                      "max-w-[88%] rounded-md px-4 py-3 text-sm leading-6",
                      message.role === "user"
                        ? "ml-auto bg-surface-container text-foreground"
                        : "border border-border bg-card text-foreground",
                    )}
                    key={`${message.role}-${index}`}
                  >
                    {message.role === "assistant" ? (
                      <p className="mb-1 font-display text-xs font-semibold text-primary">
                        RoutesPlan
                      </p>
                    ) : null}
                    {message.content}
                  </div>
                ))
              ) : (
                <div className="flex h-full min-h-[190px] items-center justify-center text-center text-sm text-muted-foreground">
                  Start with a sentence like “I have 3 vans and 24 deliveries
                  tomorrow” or upload your delivery list.
                </div>
              )}
              {busy ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                  RoutesPlan is working...
                </div>
              ) : null}
            </div>

            {attachments.length ? (
              <div className="space-y-3">
                {attachments.map((attachment) => (
                  <AttachmentPreview attachment={attachment} key={attachment.id} />
                ))}
              </div>
            ) : null}

            {error ? (
              <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <form className="flex gap-2" onSubmit={handleSubmit}>
              <input
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                disabled={busy}
                placeholder="Describe the route problem..."
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                {...privateReplayProps()}
              />
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 font-display text-sm font-bold text-primary-foreground transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busy || !prompt.trim()}
                type="submit"
              >
                <Send aria-hidden className="h-4 w-4" />
                Send
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 font-display text-sm font-semibold text-foreground transition-colors hover:bg-surface-low"
                disabled={busy}
                type="button"
                onClick={() => {
                  setTrialSource("upload");
                  trackEvent("trial_source_selected", {
                    trial_source: "upload",
                  });
                  fileInputRef.current?.click();
                }}
              >
                <Upload aria-hidden className="h-4 w-4" />
                Upload CSV/XLSX
              </button>
              <input
                accept=".csv,.xlsx,.xlsm"
                className="hidden"
                ref={fileInputRef}
                type="file"
                onChange={(event) => {
                  void handleUpload(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <p className="text-xs text-muted-foreground">
                No optimization, geocoding or export runs before sign in.
              </p>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="font-display text-sm font-semibold text-foreground">
              Plan signal
            </p>
            <div className="mt-4 space-y-3">
              {insightLabels.length ? (
                insightLabels.map((label) => (
                  <div className="flex items-center gap-2 text-sm" key={label}>
                    <CheckCircle2 aria-hidden className="h-4 w-4 text-primary" />
                    {label}
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  RoutesPlan will show what it understands once you describe
                  the plan or upload a file.
                </p>
              )}
            </div>
          </div>

          {state === "AUTH_REQUIRED" || state === "AUTHENTICATING" ? (
            <AuthRequiredCard
              code={code}
              demoCode={demoCode}
              email={email}
              googleEnabled={googleEnabled}
              microsoftEnabled={microsoftEnabled}
              emailSent={authEmailSent}
              busy={busy}
              onCodeChange={setCode}
              onEmailChange={setEmail}
              onRequestCode={handleRequestCode}
              onVerifyCode={handleVerifyCode}
              onSocialAuthStart={(method) => {
                setAuthMethod(method);
                trackEvent("auth_method_selected", { auth_method: method });
                trackEvent("auth_started", { auth_method: method });
              }}
            />
          ) : (
            <div className="rounded-lg border border-primary-accent/20 bg-primary-accent/5 p-5">
              <p className="font-display text-sm font-semibold text-primary">
                Delayed sign in
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Start with value first. RoutesPlan asks you to sign in when
                there is real work to save and continue.
              </p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function ModeButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-24 flex-col items-start justify-between rounded-md border border-border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-surface-low"
      type="button"
      onClick={onClick}
    >
      <Icon aria-hidden className="h-5 w-5 text-primary" />
      <span className="font-display text-sm font-semibold text-foreground">
        {label}
      </span>
    </button>
  );
}

function AttachmentPreview({ attachment }: { attachment: TrialAttachment }) {
  const inspection = attachment.inspection;
  return (
    <div
      className="rounded-md border border-border bg-background p-4"
      {...privateReplayProps()}
    >
      <div className="flex items-start gap-3">
        <FileSpreadsheet aria-hidden className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-foreground">
            {attachment.fileName}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {inspection?.rowCount ?? 0} rows detected
          </p>
          {inspection?.columns?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {inspection.columns.slice(0, 8).map((column) => (
                <span
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground"
                  key={column}
                >
                  {column}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AuthRequiredCard({
  code,
  demoCode,
  email,
  googleEnabled,
  microsoftEnabled,
  emailSent,
  busy,
  onCodeChange,
  onEmailChange,
  onRequestCode,
  onSocialAuthStart,
  onVerifyCode,
}: {
  code: string;
  demoCode: string | null;
  email: string;
  googleEnabled: boolean;
  microsoftEnabled: boolean;
  emailSent: boolean;
  busy: boolean;
  onCodeChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onRequestCode: (event: FormEvent<HTMLFormElement>) => void;
  onSocialAuthStart: (method: AuthMethod) => void;
  onVerifyCode: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="rounded-lg border border-primary-accent/25 bg-card p-5 shadow-[0_16px_50px_rgba(26,28,29,0.06)]">
      <p className="font-display text-sm font-semibold text-primary">
        Your route plan is ready to continue.
      </p>
      <h2 className="mt-2 font-display text-xl font-semibold text-foreground">
        Sign in to save your work and finish the optimization.
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        No credit card. Your trial context will be attached to your RoutesPlan
        workspace.
      </p>

      <div className="mt-5 space-y-2">
        {googleEnabled ? (
          <a
            className="flex h-11 w-full items-center justify-center rounded-md border border-border bg-background font-display text-sm font-semibold text-foreground transition-colors hover:bg-surface-low"
            href={getGoogleAuthStartUrl("/try?continueTrial=1&authMethod=google")}
            onClick={() => onSocialAuthStart("google")}
          >
            Continue with Google
          </a>
        ) : null}
        {microsoftEnabled ? (
          <a
            className="flex h-11 w-full items-center justify-center rounded-md border border-border bg-background font-display text-sm font-semibold text-foreground transition-colors hover:bg-surface-low"
            href={getMicrosoftAuthStartUrl(
              "/try?continueTrial=1&authMethod=microsoft",
            )}
            onClick={() => onSocialAuthStart("microsoft")}
          >
            Continue with Microsoft
          </a>
        ) : null}
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="font-display text-xs font-semibold text-muted-foreground">
          OR
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {!emailSent ? (
        <form className="space-y-3" onSubmit={onRequestCode}>
          <label className="block">
            <span className="font-display text-sm font-semibold text-foreground">
              Email
            </span>
            <span className="mt-2 flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:border-primary">
              <Mail aria-hidden className="h-4 w-4 text-muted-foreground" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                inputMode="email"
                placeholder="marco@example.com"
                required
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                {...privateReplayProps()}
              />
            </span>
          </label>
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary font-display text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            Continue with email
            <ArrowRight aria-hidden className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={onVerifyCode}>
          <label className="block">
            <span className="font-display text-sm font-semibold text-foreground">
              Verification code
            </span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-center font-display text-lg font-semibold tracking-[0.2em] outline-none focus:border-primary"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) =>
                onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              {...privateReplayProps()}
            />
          </label>
          {demoCode ? (
            <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
              Development code: <span className="font-semibold">{demoCode}</span>
            </p>
          ) : null}
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary font-display text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy || code.length !== 6}
            type="submit"
          >
            Verify and continue
            <ArrowRight aria-hidden className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}

function friendlyTrialError(caught: unknown) {
  if (caught instanceof TrialApiError) {
    return caught.message;
  }

  return "We couldn't continue this trial. Please try again.";
}

function friendlyAuthError(caught: unknown) {
  if (caught instanceof AuthApiError) {
    return caught.message;
  }

  return "We couldn't complete sign in. Please try again.";
}

function errorCategory(caught: unknown): ErrorCategory {
  const code =
    caught instanceof TrialApiError || caught instanceof AuthApiError
      ? caught.code
      : "";
  const normalized = code.toLowerCase();

  if (normalized.includes("rate")) {
    return "rate_limited";
  }
  if (normalized.includes("auth_required")) {
    return "auth_required";
  }
  if (normalized.includes("not_found") || normalized.includes("expired")) {
    return "expired";
  }
  if (normalized.includes("limit")) {
    return "limit_reached";
  }
  if (normalized.includes("upload")) {
    return "upload_failed";
  }
  if (normalized.includes("invalid") || normalized.includes("empty")) {
    return "invalid_input";
  }
  return "unknown";
}
