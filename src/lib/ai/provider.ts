import type { AiMessage, AiProvider } from "./types";

/**
 * Stub provider used until AI_API_KEY is set.
 * Keeps UI / usage wiring testable without a live model.
 */
export const stubAiProvider: AiProvider = {
  id: "stub",
  isConfigured() {
    return false;
  },
  async complete() {
    throw new Error(
      "AI is not configured yet. Add AI_API_KEY (and AI_PROVIDER) in .env.local.",
    );
  },
};

/**
 * Minimal OpenAI-compatible chat completions client.
 * Works with OpenAI and many OpenAI-compatible gateways.
 */
export function createOpenAiProvider(opts: {
  apiKey: string;
  model: string;
  baseUrl?: string;
}): AiProvider {
  const baseUrl = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");

  return {
    id: "openai",
    isConfigured() {
      return Boolean(opts.apiKey);
    },
    async complete({ messages, temperature, maxTokens }) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          messages: toOpenAiMessages(messages),
          temperature: temperature ?? 0.4,
          max_tokens: maxTokens ?? 1200,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`AI provider error (${res.status}): ${detail.slice(0, 400)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const text = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) throw new Error("AI provider returned an empty response.");

      return {
        text,
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
      };
    },
  };
}

/**
 * Anthropic Messages API client.
 */
export function createAnthropicProvider(opts: {
  apiKey: string;
  model: string;
}): AiProvider {
  return {
    id: "anthropic",
    isConfigured() {
      return Boolean(opts.apiKey);
    },
    async complete({ messages, temperature, maxTokens }) {
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const chatMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": opts.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: maxTokens ?? 1200,
          temperature: temperature ?? 0.4,
          system: system || undefined,
          messages: chatMessages,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`AI provider error (${res.status}): ${detail.slice(0, 400)}`);
      }

      const data = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const text =
        data.content
          ?.filter((block) => block.type === "text" && block.text)
          .map((block) => block.text)
          .join("\n")
          .trim() ?? "";

      if (!text) throw new Error("AI provider returned an empty response.");

      return {
        text,
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      };
    },
  };
}

function toOpenAiMessages(messages: AiMessage[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}
