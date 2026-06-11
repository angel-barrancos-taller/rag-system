// Jest stub for @openrouter/sdk. Unit tests must inject a FakeLLMClient;
// reaching this module means a real OpenRouter call was attempted.
export class OpenRouter {
  constructor() {
    throw new Error(
      "@openrouter/sdk was imported in a unit test. Inject a FakeLLMClient instead.",
    );
  }
}
