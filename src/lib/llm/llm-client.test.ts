import { FakeLLMClient } from "./llm-client";

describe("FakeLLMClient", () => {
  it("returns scripted responses in order", async () => {
    const llm = new FakeLLMClient(["first", "second"]);
    expect(await llm.complete({ user: "q1" })).toBe("first");
    expect(await llm.complete({ user: "q2" })).toBe("second");
  });

  it("keeps returning the last scripted response when exhausted", async () => {
    const llm = new FakeLLMClient(["only"]);
    await llm.complete({ user: "q1" });
    expect(await llm.complete({ user: "q2" })).toBe("only");
  });

  it("supports a responder function", async () => {
    const llm = new FakeLLMClient((req) => `echo: ${req.user}`);
    expect(await llm.complete({ user: "hello" })).toBe("echo: hello");
  });

  it("records every call for assertions", async () => {
    const llm = new FakeLLMClient(["ok"]);
    await llm.complete({
      system: "sys",
      user: "question",
      temperature: 0,
      jsonMode: true,
    });

    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]).toMatchObject({
      system: "sys",
      user: "question",
      temperature: 0,
      jsonMode: true,
    });
  });

  it("defaults to an empty-string response when nothing is scripted", async () => {
    const llm = new FakeLLMClient();
    expect(await llm.complete({ user: "q" })).toBe("");
  });
});
