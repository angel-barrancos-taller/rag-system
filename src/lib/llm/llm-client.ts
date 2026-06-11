export interface CompleteRequest {
  system?: string;
  user: string;
  temperature?: number;
  /** Request a JSON-object response where the provider supports it. */
  jsonMode?: boolean;
  /**
   * Optional model override, kept for future flexibility. Nothing sets it
   * today: the OpenRouter API key is pre-configured with its model.
   */
  model?: string;
}

export interface LLMClient {
  complete(request: CompleteRequest): Promise<string>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

type Responder = (request: CompleteRequest) => string;

/** Test double: returns scripted responses and records every call. */
export class FakeLLMClient implements LLMClient {
  readonly calls: CompleteRequest[] = [];
  private nextIndex = 0;

  constructor(private readonly responses: string[] | Responder = []) {}

  async complete(request: CompleteRequest): Promise<string> {
    this.calls.push(request);
    if (typeof this.responses === "function") return this.responses(request);
    if (this.responses.length === 0) return "";
    const index = Math.min(this.nextIndex, this.responses.length - 1);
    this.nextIndex++;
    return this.responses[index];
  }
}
