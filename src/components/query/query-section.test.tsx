import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuerySection } from "./query-section";

const QUERY_RESPONSE = {
  answer: "getTotal sums price times quantity.",
  sources: [
    {
      filePath: "sample/cart.ts",
      snippet: "getTotal(): number {\n  return 42;\n}",
      lines: { start: 10, end: 12 },
      score: 0.8312,
      chunkId: "sample/cart.ts#Cart.getTotal",
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

async function askQuestion(text: string) {
  await userEvent.type(screen.getByLabelText(/ask a question/i), text);
  await userEvent.click(screen.getByRole("button", { name: /ask/i }));
}

describe("QuerySection", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => fetchSpy.mockRestore());

  it("posts the question and renders the user message and the answer", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(QUERY_RESPONSE));

    render(<QuerySection />);
    await askQuestion("how is the total calculated?");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/query");
    expect(JSON.parse(init.body)).toEqual({ question: "how is the total calculated?" });

    expect(await screen.findByText("getTotal sums price times quantity.")).toBeInTheDocument();
    expect(screen.getByText("how is the total calculated?")).toBeInTheDocument();
  });

  it("renders each source with file path, line range and score", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(QUERY_RESPONSE));

    render(<QuerySection />);
    await askQuestion("total?");

    expect(await screen.findByText(/sample\/cart\.ts/)).toBeInTheDocument();
    expect(screen.getByText(/lines 10–12/)).toBeInTheDocument();
    expect(screen.getByText(/0\.83/)).toBeInTheDocument();
  });

  it("expands a source to show the code snippet", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(QUERY_RESPONSE));

    render(<QuerySection />);
    await askQuestion("total?");
    await screen.findByText(/sample\/cart\.ts/);

    await userEvent.click(screen.getByText(/sample\/cart\.ts/));
    expect(screen.getByText(/return 42;/)).toBeInTheDocument();
  });

  it("disables the form while a request is pending", async () => {
    let release!: (value: Response) => void;
    fetchSpy.mockReturnValue(new Promise<Response>((resolve) => (release = resolve)));

    render(<QuerySection />);
    await askQuestion("pending?");

    expect(screen.getByRole("button", { name: /thinking/i })).toBeDisabled();
    release(jsonResponse(QUERY_RESPONSE));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /ask/i })).toBeEnabled(),
    );
  });

  it("shows an error message when the request fails", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: "UpstreamError" }, 502));

    render(<QuerySection />);
    await askQuestion("broken?");

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed/i);
  });

  it("does not submit an empty question", async () => {
    render(<QuerySection />);
    await userEvent.click(screen.getByRole("button", { name: /ask/i }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
