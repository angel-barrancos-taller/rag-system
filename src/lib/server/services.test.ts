import { getServices, setServicesForTesting } from "./services";

/**
 * In unit tests the OpenRouter SDK is stubbed with a class that THROWS on
 * construction. getServices() must therefore not construct the LLM client
 * eagerly — otherwise indexing (which never uses the LLM) would require an
 * API key.
 */
describe("getServices", () => {
  afterEach(() => setServicesForTesting(null));

  it("wires services without constructing the LLM client", () => {
    const services = getServices();
    expect(services.embedder).toBeDefined();
    expect(services.store).toBeDefined();
    expect(services.llm).toBeDefined();
  });

  it("defers LLM construction until the first completion call", async () => {
    const services = getServices();
    // The stubbed OpenRouter constructor throws — proving construction
    // happens here, on first use, not at wiring time.
    await expect(services.llm.complete({ user: "hi" })).rejects.toThrow(
      /unit test/,
    );
  });

  it("returns the same cached instance across calls", () => {
    expect(getServices()).toBe(getServices());
  });
});
