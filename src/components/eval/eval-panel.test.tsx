import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EvalPanel } from "./eval-panel";

const REPORT = {
  k: 5,
  perQuestion: [
    {
      id: "cart-total",
      question: "How is the cart total calculated?",
      retrieved: [{ chunkId: "sample/cart.ts#Cart.getTotal", score: 0.9 }],
      precisionAtK: 0.2,
      recallAtK: 1,
      reciprocalRank: 1,
      answer: "It sums price times quantity.",
      judge: {
        faithfulness: { score: 5, reasoning: "Fully grounded in getTotal." },
        relevance: { score: 4, reasoning: "Answers the question." },
      },
    },
    {
      id: "hard-refunds",
      question: "How are refunds processed?",
      retrieved: [],
      precisionAtK: 0,
      recallAtK: 0,
      reciprocalRank: 0,
      answer: "I don't know based on the indexed code.",
      judge: null,
      judgeError: "Judge returned invalid JSON twice",
    },
  ],
  aggregate: {
    precisionAtK: 0.1,
    recallAtK: 0.5,
    mrr: 0.5,
    meanFaithfulness: 5,
    meanRelevance: 4,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

describe("EvalPanel", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => fetchSpy.mockRestore());

  it("runs the evaluation with the chosen K and skip-judge option", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(REPORT));

    render(<EvalPanel />);
    await userEvent.clear(screen.getByLabelText(/^k$/i));
    await userEvent.type(screen.getByLabelText(/^k$/i), "3");
    await userEvent.click(screen.getByLabelText(/skip llm judge/i));
    await userEvent.click(screen.getByRole("button", { name: /run evaluation/i }));

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/evaluate");
    expect(JSON.parse(init.body)).toEqual({ k: 3, skipJudge: true });
  });

  it("displays the aggregate metric cards", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(REPORT));

    render(<EvalPanel />);
    await userEvent.click(screen.getByRole("button", { name: /run evaluation/i }));

    expect(await screen.findByText("Precision@5")).toBeInTheDocument();
    expect(screen.getByText("0.10")).toBeInTheDocument(); // precision
    expect(screen.getByText("Recall@5")).toBeInTheDocument();
    expect(screen.getAllByText("0.50").length).toBeGreaterThanOrEqual(1); // recall + mrr
    expect(screen.getByText("MRR")).toBeInTheDocument();
    expect(screen.getByText("Faithfulness")).toBeInTheDocument();
    expect(screen.getByText("5.0")).toBeInTheDocument();
    expect(screen.getByText("Relevance")).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
  });

  it("expands a question row to show judge reasoning, and shows judge errors", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(REPORT));

    render(<EvalPanel />);
    await userEvent.click(screen.getByRole("button", { name: /run evaluation/i }));
    await screen.findByText("Precision@5");

    await userEvent.click(screen.getByText("How is the cart total calculated?"));
    expect(screen.getByText(/fully grounded in getTotal/i)).toBeInTheDocument();

    await userEvent.click(screen.getByText("How are refunds processed?"));
    expect(screen.getByText(/judge returned invalid json/i)).toBeInTheDocument();
  });

  it("shows an error when the evaluation request fails", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: "UpstreamError" }, 502));

    render(<EvalPanel />);
    await userEvent.click(screen.getByRole("button", { name: /run evaluation/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed/i);
  });
});
