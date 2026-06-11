import { OpenRouter } from "@openrouter/sdk";

import { type CompleteRequest, type LLMClient, LLMError } from "./llm-client";

/**
 * OpenRouter-backed LLM client. Requests deliberately omit the model:
 * the API key is pre-configured with its model on the OpenRouter side.
 *
 * Fallback if the SDK ever misbehaves: the `openai` package pointed at
 * baseURL "https://openrouter.ai/api/v1" speaks the same protocol.
 */
export class OpenRouterClient implements LLMClient {
  private readonly client: OpenRouter;

  constructor(apiKey: string | undefined) {
    if (!apiKey) {
      throw new LLMError(
        "OPENROUTER_API_KEY is not set. Add it to .env.local.",
      );
    }
    this.client = new OpenRouter({ apiKey });
  }

  async complete(request: CompleteRequest): Promise<string> {
    const messages: { role: "system" | "user"; content: string }[] = [];
    if (request.system)
      messages.push({ role: "system", content: request.system });
    messages.push({ role: "user", content: request.user });

    try {
      const result = await this.client.chat.send({
        chatRequest: {
          messages,
          ...(request.model ? { model: request.model } : {}),
          ...(request.temperature !== undefined
            ? { temperature: request.temperature }
            : {}),
          ...(request.jsonMode
            ? { responseFormat: { type: "json_object" as const } }
            : {}),
          stream: false,
        },
      });

      if (!("choices" in result)) {
        throw new LLMError(
          "OpenRouter returned an unexpected streaming response",
        );
      }
      return extractText(result.choices[0]?.message?.content);
    } catch (error) {
      if (error instanceof LLMError) throw error;
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode: unknown }).statusCode)
          : undefined;
      throw new LLMError(
        error instanceof Error ? error.message : String(error),
        status,
      );
    }
  }
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("");
  }
  return "";
}
