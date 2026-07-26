/**
 * Pack and validate AI context against the feature's access container.
 * Anything not allowlisted is dropped before it can reach the model.
 */

import {
  AI_GLOBAL_DENY_SCOPES,
  getAiAccessContainer,
  type AiAction,
  type AiDataScope,
} from "./access-container";
import { getAiOutputContract } from "./output-contracts";
import type { AiFeatureKey, AiMessage } from "./types";

export type AiContextBag = {
  scope: AiDataScope;
  /** Structured payload for that scope only. */
  data: unknown;
};

export type AiSandboxedRequest = {
  feature: AiFeatureKey;
  accountId: string;
  workspace: string;
  /** Action the caller wants — must be on the container allowlist. */
  action: AiAction;
  /** Scoped context bags. Unlisted scopes are stripped. */
  context?: AiContextBag[];
  /** Optional free-form instruction (only if container.allowFreeformUserText). */
  userText?: string;
  temperature?: number;
  maxTokens?: number;
};

export type AiPackedPrompt = {
  messages: AiMessage[];
  /** Scopes that were accepted into the prompt. */
  acceptedScopes: AiDataScope[];
  /** Scopes the caller tried to pass but the container rejected. */
  strippedScopes: string[];
  /** Character count of packed context. */
  contextChars: number;
};

export class AiAccessDeniedError extends Error {
  readonly code = "AI_ACCESS_DENIED";
  constructor(message: string) {
    super(message);
    this.name = "AiAccessDeniedError";
  }
}

function isDeniedScopeName(name: string): boolean {
  return (AI_GLOBAL_DENY_SCOPES as readonly string[]).includes(name);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildBoundarySystemPrompt(input: {
  purpose: string;
  allowedScopes: readonly AiDataScope[];
  allowedActions: readonly AiAction[];
  denied: readonly string[];
  outputContract: string | null;
}): string {
  const lines = [
    "You are an assistant inside the GTA Apprenticeship Portal.",
    "You operate inside a strict access container. Follow these rules exactly:",
    `1. Purpose: ${input.purpose}`,
    `2. You may only use data from these scopes: ${input.allowedScopes.join(", ") || "(none)"}.`,
    `3. You may only perform these actions: ${input.allowedActions.join(", ") || "(none)"}.`,
    `4. You must NEVER use, infer, request, or invent data from: ${input.denied.join(", ")}.`,
    "5. If asked for information outside your allowed scopes, refuse briefly and say it is outside your access.",
    "6. Do not claim access to other learners, staff case notes, safeguarding records, or credentials.",
    "7. Do not auto-send messages, change permissions, or persist data — only return suggested text.",
    "8. Stay factual: do not invent employers, grades, hours, or qualifications the user did not provide.",
  ];
  if (input.outputContract) {
    lines.push(`9. Output contract: ${input.outputContract}`);
  }
  return lines.join("\n");
}

/**
 * Validate workspace + action, pack only allowlisted context, and build
 * the messages that will be sent to the provider.
 */
export function packAiSandbox(request: AiSandboxedRequest): AiPackedPrompt {
  const container = getAiAccessContainer(request.feature);

  if (
    container.allowedWorkspaces.length > 0 &&
    !container.allowedWorkspaces.includes(
      request.workspace as (typeof container.allowedWorkspaces)[number],
    )
  ) {
    throw new AiAccessDeniedError(
      `AI feature "${request.feature}" is not available in the "${request.workspace}" workspace.`,
    );
  }

  if (!container.allowedActions.includes(request.action)) {
    throw new AiAccessDeniedError(
      `Action "${request.action}" is not allowed for AI feature "${request.feature}".`,
    );
  }

  const acceptedScopes: AiDataScope[] = [];
  const strippedScopes: string[] = [];
  const contextBlocks: string[] = [];

  for (const bag of request.context ?? []) {
    const scopeName = String(bag.scope);
    if (isDeniedScopeName(scopeName)) {
      strippedScopes.push(scopeName);
      continue;
    }
    if (!container.allowedScopes.includes(bag.scope)) {
      strippedScopes.push(scopeName);
      continue;
    }
    acceptedScopes.push(bag.scope);
    contextBlocks.push(`### scope:${bag.scope}\n${safeJson(bag.data)}`);
  }

  const userText = (request.userText ?? "").trim();
  if (userText && !container.allowFreeformUserText) {
    // Fold free-form into a note that we ignore — or reject hard.
    throw new AiAccessDeniedError(
      `Free-form user text is not allowed for AI feature "${request.feature}". Pass data via allowlisted scopes only.`,
    );
  }

  let packed = contextBlocks.join("\n\n");
  if (userText) {
    packed = packed
      ? `${packed}\n\n### user_instruction\n${userText}`
      : `### user_instruction\n${userText}`;
  }

  if (packed.length > container.maxContextChars) {
    packed = packed.slice(0, container.maxContextChars);
  }

  if (!packed.trim()) {
    throw new AiAccessDeniedError(
      `No allowlisted context was provided for AI feature "${request.feature}".`,
    );
  }

  const outputContract = getAiOutputContract(request.feature);

  const messages: AiMessage[] = [
    {
      role: "system",
      content: buildBoundarySystemPrompt({
        purpose: container.purpose,
        allowedScopes: container.allowedScopes,
        allowedActions: container.allowedActions,
        denied: AI_GLOBAL_DENY_SCOPES as unknown as string[],
        outputContract,
      }),
    },
    {
      role: "user",
      content: [
        `Feature: ${request.feature}`,
        `Action: ${request.action}`,
        outputContract ? `Required output: ${outputContract}` : null,
        "",
        "Allowed context (container-filtered):",
        packed,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  return {
    messages,
    acceptedScopes,
    strippedScopes,
    contextChars: packed.length,
  };
}
