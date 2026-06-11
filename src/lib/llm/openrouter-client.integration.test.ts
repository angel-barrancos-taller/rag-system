/**
 * Opt-in integration test: makes a real OpenRouter call. Requires
 * OPENROUTER_API_KEY in the environment (e.g. via .env.local). Run with:
 *   pnpm test:integration
 */
import { OpenRouterClient } from "./openrouter-client";

const hasRealKey =
  process.env.OPENROUTER_API_KEY &&
  process.env.OPENROUTER_API_KEY !== "test-key";
const describeIntegration =
  process.env.RUN_INTEGRATION && hasRealKey ? describe : describe.skip;

describeIntegration("OpenRouterClient (integration)", () => {
  jest.setTimeout(60_000);

  it("completes a prompt without specifying a model", async () => {
    const client = new OpenRouterClient(process.env.OPENROUTER_API_KEY);
    const answer = await client.complete({
      user: "Reply with exactly the word: pong",
      temperature: 0,
    });
    expect(answer.toLowerCase()).toContain("pong");
  });
});
