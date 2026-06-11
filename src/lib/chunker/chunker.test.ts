import { chunkFile } from "./chunker";

describe("chunkFile", () => {
  it("creates one function chunk per top-level function with exact line ranges", () => {
    const source = [
      "export function add(a: number, b: number): number {", // line 1
      "  return a + b;", // line 2
      "}", // line 3
      "", // line 4
      "function sub(a: number, b: number): number {", // line 5
      "  return a - b;", // line 6
      "}", // line 7
    ].join("\n");

    const chunks = chunkFile("src/math.ts", source);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      id: "src/math.ts#add",
      filePath: "src/math.ts",
      name: "add",
      kind: "function",
      startLine: 1,
      endLine: 3,
    });
    expect(chunks[0].content).toContain("return a + b;");
    expect(chunks[1]).toMatchObject({ name: "sub", startLine: 5, endLine: 7 });
  });

  it("chunks top-level arrow-function consts as functions", () => {
    const source = "export const mul = (a: number, b: number) => a * b;";

    const chunks = chunkFile("src/math.ts", source);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      id: "src/math.ts#mul",
      name: "mul",
      kind: "function",
      startLine: 1,
      endLine: 1,
    });
  });

  it("chunks a class into a skeleton chunk plus one chunk per method", () => {
    const source = [
      "export class Cart {", // line 1
      "  private items: string[] = [];", // line 2
      "", // line 3
      "  constructor(private taxRate: number) {}", // line 4
      "", // line 5
      "  addItem(item: string): void {", // line 6
      "    this.items.push(item);", // line 7
      "  }", // line 8
      "", // line 9
      "  getTotal(): number {", // line 10
      "    return this.items.length;", // line 11
      "  }", // line 12
      "}", // line 13
    ].join("\n");

    const chunks = chunkFile("src/cart.ts", source);

    const classChunk = chunks.find((c) => c.kind === "class");
    expect(classChunk).toMatchObject({
      id: "src/cart.ts#Cart",
      name: "Cart",
      startLine: 1,
    });
    expect(classChunk!.content).toContain("class Cart");
    expect(classChunk!.content).toContain("private items");
    expect(classChunk!.content).toContain("constructor");
    expect(classChunk!.content).not.toContain("this.items.push");

    const methods = chunks.filter((c) => c.kind === "method");
    expect(methods.map((m) => m.name)).toEqual([
      "Cart.addItem",
      "Cart.getTotal",
    ]);
    expect(methods[0]).toMatchObject({ startLine: 6, endLine: 8 });
    expect(methods[0].content.startsWith("// class Cart")).toBe(true);
    expect(methods[0].content).toContain("this.items.push(item);");
    expect(methods[1]).toMatchObject({ startLine: 10, endLine: 12 });
  });

  it("falls back to a single whole-file chunk when there are no declarations", () => {
    const source = [
      'import { format } from "./format";', // line 1
      "", // line 2
      'console.log(format("hello"));', // line 3
    ].join("\n");

    const chunks = chunkFile("src/main.ts", source);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      id: "src/main.ts#file",
      name: "file",
      kind: "file",
      startLine: 1,
      endLine: 3,
    });
    expect(chunks[0].content).toBe(source);
  });

  it("falls back to overlapping sliding windows for long declaration-free files", () => {
    const lines = Array.from(
      { length: 200 },
      (_, i) => `console.log(${i + 1});`,
    );
    const source = lines.join("\n");

    const chunks = chunkFile("src/long.ts", source, {
      windowSize: 60,
      windowOverlap: 15,
    });

    expect(chunks.every((c) => c.kind === "window")).toBe(true);
    expect(chunks[0]).toMatchObject({
      name: "window-0",
      startLine: 1,
      endLine: 60,
    });
    // stride = windowSize - overlap = 45
    expect(chunks[1]).toMatchObject({
      name: "window-1",
      startLine: 46,
      endLine: 105,
    });
    // union of windows covers every line
    const covered = new Set<number>();
    for (const c of chunks) {
      for (let line = c.startLine; line <= c.endLine; line++) covered.add(line);
    }
    expect(covered.size).toBe(200);
    expect(chunks[chunks.length - 1].endLine).toBe(200);
  });

  it("splits an oversized function into windows scoped to that function", () => {
    const body = Array.from(
      { length: 130 },
      (_, i) => `  console.log(${i + 1});`,
    );
    const source = ["function huge() {", ...body, "}"].join("\n");

    const chunks = chunkFile("src/huge.ts", source, {
      maxChunkLines: 120,
      windowSize: 60,
      windowOverlap: 15,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.kind === "window")).toBe(true);
    expect(chunks[0].name).toBe("huge.window-0");
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[chunks.length - 1].endLine).toBe(132);
  });

  it("produces deterministic, unique ids", () => {
    const source = [
      "function a() {}",
      "function b() {}",
      "class C { m() {} }",
    ].join("\n");

    const first = chunkFile("src/x.ts", source);
    const second = chunkFile("src/x.ts", source);

    expect(first.map((c) => c.id)).toEqual(second.map((c) => c.id));
    expect(new Set(first.map((c) => c.id)).size).toBe(first.length);
  });

  it("does not throw on syntactically broken input", () => {
    const source = "function broken( {{{";
    expect(() => chunkFile("src/broken.ts", source)).not.toThrow();
    expect(chunkFile("src/broken.ts", source).length).toBeGreaterThan(0);
  });

  it("returns no chunks for an empty file", () => {
    expect(chunkFile("src/empty.ts", "")).toEqual([]);
  });
});
