"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

import {
  clearStoredConversationId,
  createConversationSession,
} from "@/lib/api/conversations";
import { initializeRoutingProblem } from "@/lib/api/organization-config";
import { hasPersistenceContext } from "@/lib/api/persistence-context";
import { useOptionalOptimizationStoreApi } from "@/providers/optimization-provider";
import {
  PENDING_INITIALIZED_CONVERSATION_KEY,
  PENDING_INITIALIZED_PROBLEM_KEY,
} from "@/components/settings/optimization-initializer";

export function NewOptimizationLink({
  children,
  onClick,
  ...props
}: ComponentProps<typeof Link>) {
  const store = useOptionalOptimizationStoreApi();
  const router = useRouter();

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    const href = typeof props.href === "string" ? props.href : "/optimize";
    const before = store ? sessionIdentity(store.getState()) : null;

    clearStoredConversationId();

    try {
      if (!hasPersistenceContext()) {
        store?.getState().resetOptimization();
        traceNewOptimization("local", before, store?.getState() ?? null);
        router.push(href);
        return;
      }

      const initialized = await initializeRoutingProblem();
      const conversation = await createConversationSession({
        initialAssistantMessage:
          store?.getState().messages[0]?.content ??
          "Ciao. Carica un file con le consegne oppure descrivimi direttamente il piano da organizzare.",
        problem: initialized.problem,
      });

      const bootstrap = {
        conversationSessionId: conversation?.session.id,
        messages: conversation?.messages,
        optimizationId: conversation?.session.optimizationId ?? null,
        problem: conversation?.problem ?? initialized.problem,
      };

      if (store) {
        store.getState().startNewOptimization(bootstrap);
      } else {
        window.sessionStorage.setItem(
          PENDING_INITIALIZED_CONVERSATION_KEY,
          JSON.stringify(bootstrap),
        );
        window.sessionStorage.setItem(
          PENDING_INITIALIZED_PROBLEM_KEY,
          JSON.stringify(initialized.problem),
        );
      }

      traceNewOptimization("persistent", before, store?.getState() ?? bootstrap);
    } catch {
      clearStoredConversationId();
      store?.getState().resetOptimization();
      traceNewOptimization("fallback", before, store?.getState() ?? null);
    }

    router.push(href);
  }

  return (
    <Link
      {...props}
      onClick={(event) => void handleClick(event)}
    >
      {children}
    </Link>
  );
}

function sessionIdentity(
  state: {
    conversationRevision?: number;
    conversationSessionId?: string;
    problem?: { id?: string };
  } | null,
) {
  return {
    conversationId: state?.conversationSessionId ?? null,
    routingProblemId: state?.problem?.id ?? null,
    stateRevision: state?.conversationRevision ?? null,
  };
}

function traceNewOptimization(
  mode: "fallback" | "local" | "persistent",
  before: ReturnType<typeof sessionIdentity> | null,
  afterState:
    | {
        conversationRevision?: number;
        conversationSessionId?: string;
        problem?: { id?: string };
      }
    | {
        conversationSessionId?: string;
        problem?: { id?: string };
      }
    | null,
) {
  if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG !== "true") {
    return;
  }

  console.info("[NEW OPTIMIZATION SESSION]", {
    after: sessionIdentity(afterState),
    before,
    mode,
  });
}
