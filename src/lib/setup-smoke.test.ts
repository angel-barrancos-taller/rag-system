describe("jest node project", () => {
  it("runs with node environment and test env vars", () => {
    expect(typeof window).toBe("undefined");
    expect(process.env.OPENROUTER_API_KEY).toBeDefined();
    expect(process.env.RAG_DATA_DIR).toContain("rag-system-tests");
  });
});
