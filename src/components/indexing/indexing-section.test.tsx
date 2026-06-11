import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IndexingSection } from "./indexing-section";

function jsonResponse(body: unknown, status = 200): Response {
  // Plain object instead of `new Response`: jsdom has no Response global.
  return { ok: status < 400, status, json: async () => body } as Response;
}

describe("IndexingSection", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => fetchSpy.mockRestore());

  it("uploads selected files as JSON and shows per-file chunk counts", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({
        filesIndexed: 1,
        chunksIndexed: 3,
        perFile: [{ path: "cart.ts", chunks: 3 }],
      }),
    );

    render(<IndexingSection />);
    const file = new File(["export function f() {}"], "cart.ts", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText(/browse files/i), file);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/index/files");
    expect(JSON.parse(init.body)).toEqual({
      files: [{ path: "cart.ts", content: "export function f() {}" }],
    });

    expect(await screen.findByText("cart.ts")).toBeInTheDocument();
    expect(screen.getByText(/3 chunks/i)).toBeInTheDocument();
  });

  it("rejects unsupported file types without calling the API", async () => {
    render(<IndexingSection />);
    const file = new File(["# notes"], "notes.md", { type: "text/markdown" });
    // applyAccept: false — mimics drag & drop, which the accept filter cannot stop
    await userEvent.upload(screen.getByLabelText(/browse files/i), file, { applyAccept: false });

    expect(await screen.findByText(/only ts\/js files/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows the server error message on a failed response", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: "ValidationError" }, 400));

    render(<IndexingSection />);
    const file = new File(["x"], "a.ts", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText(/browse files/i), file);

    expect(await screen.findByText(/indexing failed/i)).toBeInTheDocument();
  });

  it("accumulates indexed files across uploads", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        jsonResponse({ filesIndexed: 1, chunksIndexed: 2, perFile: [{ path: "a.ts", chunks: 2 }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ filesIndexed: 1, chunksIndexed: 5, perFile: [{ path: "b.ts", chunks: 5 }] }),
      );

    render(<IndexingSection />);
    await userEvent.upload(screen.getByLabelText(/browse files/i), new File(["1"], "a.ts"));
    await screen.findByText("a.ts");
    await userEvent.upload(screen.getByLabelText(/browse files/i), new File(["2"], "b.ts"));

    expect(await screen.findByText("b.ts")).toBeInTheDocument();
    expect(screen.getByText("a.ts")).toBeInTheDocument();
  });
});
