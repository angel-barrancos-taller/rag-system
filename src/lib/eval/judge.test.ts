import { FakeLLMClient } from "@/lib/llm/llm-client";

import { JudgeParseError, judgeAnswer } from "./judge";

const VALID_VERDICT = JSON.stringify({
  faithfulness: { score: 4, reasoning: "Claims are grounded in the context." },
  relevance: { score: 5, reasoning: "Directly answers the question." },
});

const INPUT = {
  question: "How is the total calculated?",
  context: ["function getTotal() { return sum; }"],
  answer: "getTotal sums the items.",
  referenceAnswer: "It sums price times quantity.",
};

describe("judgeAnswer", () => {
  it("parses a valid JSON verdict", async () => {
    const llm = new FakeLLMClient([VALID_VERDICT]);

    const verdict = await judgeAnswer(llm, INPUT);

    expect(verdict.faithfulness.score).toBe(4);
    expect(verdict.relevance.score).toBe(5);
    expect(verdict.relevance.reasoning).toContain("answers");
  });

  it("parses a verdict wrapped in markdown fences", async () => {
    const llm = new FakeLLMClient(["```json\n" + VALID_VERDICT + "\n```"]);
    const verdict = await judgeAnswer(llm, INPUT);
    expect(verdict.faithfulness.score).toBe(4);
  });

  it("sends question, answer and all context to the judge with jsonMode and temperature 0", async () => {
    const llm = new FakeLLMClient([VALID_VERDICT]);

    await judgeAnswer(llm, INPUT);

    expect(llm.calls).toHaveLength(1);
    const call = llm.calls[0];
    expect(call.jsonMode).toBe(true);
    expect(call.temperature).toBe(0);
    expect(call.user).toContain(INPUT.question);
    expect(call.user).toContain(INPUT.answer);
    expect(call.user).toContain(INPUT.context[0]);
    expect(call.user).toContain(INPUT.referenceAnswer);
  });

  it("retries once when the first response is not valid JSON", async () => {
    const llm = new FakeLLMClient(["this is not json", VALID_VERDICT]);

    const verdict = await judgeAnswer(llm, INPUT);

    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1].user).toMatch(/only valid json/i);
    expect(verdict.faithfulness.score).toBe(4);
  });

  it("retries when the JSON fails schema validation (score out of range)", async () => {
    const outOfRange = JSON.stringify({
      faithfulness: { score: 6, reasoning: "too high" },
      relevance: { score: 5, reasoning: "ok" },
    });
    const llm = new FakeLLMClient([outOfRange, VALID_VERDICT]);

    const verdict = await judgeAnswer(llm, INPUT);

    expect(llm.calls).toHaveLength(2);
    expect(verdict.faithfulness.score).toBe(4);
  });

  it("throws JudgeParseError after two bad responses", async () => {
    const llm = new FakeLLMClient(["bad", "still bad"]);
    await expect(judgeAnswer(llm, INPUT)).rejects.toThrow(JudgeParseError);
    expect(llm.calls).toHaveLength(2);
  });
});
