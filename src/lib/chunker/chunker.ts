import ts from "typescript";

import type { Chunk, ChunkKind } from "@/lib/types";

export interface ChunkerOptions {
  /** Declarations longer than this are split into windows. */
  maxChunkLines?: number;
  windowSize?: number;
  windowOverlap?: number;
}

const DEFAULTS: Required<ChunkerOptions> = {
  maxChunkLines: 120,
  windowSize: 60,
  windowOverlap: 15,
};

/**
 * Splits a TS/JS file into retrieval chunks using the TypeScript compiler API
 * (pure parse — no type checker, no file system, never throws on bad syntax).
 *
 * - top-level functions and arrow-function consts → one `function` chunk each
 * - classes → one `class` skeleton chunk (header + properties + constructor)
 *   plus one `method` chunk per method, prefixed with `// class X` for context
 * - files with no declarations → a whole-`file` chunk, or sliding `window`
 *   chunks when the file is longer than `windowSize`
 */
export function chunkFile(
  filePath: string,
  content: string,
  opts?: ChunkerOptions,
): Chunk[] {
  const { maxChunkLines, windowSize, windowOverlap } = { ...DEFAULTS, ...opts };
  if (content.trim() === "") return [];

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const lines = content.split("\n");
  const usedIds = new Set<string>();
  const chunks: Chunk[] = [];

  const lineOf = (pos: number) =>
    sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  const textOfLines = (startLine: number, endLine: number) =>
    lines.slice(startLine - 1, endLine).join("\n");

  function uniqueName(name: string): string {
    let candidate = name;
    for (let n = 2; usedIds.has(`${filePath}#${candidate}`); n++) {
      candidate = `${name}-${n}`;
    }
    usedIds.add(`${filePath}#${candidate}`);
    return candidate;
  }

  function addChunk(
    name: string,
    kind: ChunkKind,
    startLine: number,
    endLine: number,
    text?: string,
  ) {
    if (endLine - startLine + 1 > maxChunkLines) {
      addWindows(startLine, endLine, name);
      return;
    }
    const unique = uniqueName(name);
    chunks.push({
      id: `${filePath}#${unique}`,
      filePath,
      name: unique,
      kind,
      startLine,
      endLine,
      content: text ?? textOfLines(startLine, endLine),
    });
  }

  function addWindows(
    firstLine: number,
    lastLine: number,
    namePrefix?: string,
  ) {
    const stride = Math.max(1, windowSize - windowOverlap);
    let index = 0;
    for (let start = firstLine; start <= lastLine; start += stride, index++) {
      const end = Math.min(start + windowSize - 1, lastLine);
      const name = uniqueName(
        namePrefix ? `${namePrefix}.window-${index}` : `window-${index}`,
      );
      chunks.push({
        id: `${filePath}#${name}`,
        filePath,
        name,
        kind: "window",
        startLine: start,
        endLine: end,
        content: textOfLines(start, end),
      });
      if (end === lastLine) break;
    }
  }

  function addClass(node: ts.ClassDeclaration) {
    const className = node.name?.text ?? "default";
    const classStart = lineOf(node.getStart(sourceFile));

    const skeletonParts: string[] = [lines[classStart - 1]];
    let skeletonEnd = classStart;
    for (const member of node.members) {
      if (
        ts.isPropertyDeclaration(member) ||
        ts.isConstructorDeclaration(member)
      ) {
        skeletonParts.push(member.getText(sourceFile).replace(/^/gm, "  "));
        skeletonEnd = lineOf(member.getEnd());
      }
    }
    skeletonParts.push("}");
    addChunk(
      className,
      "class",
      classStart,
      skeletonEnd,
      skeletonParts.join("\n"),
    );

    for (const member of node.members) {
      const isMethodLike =
        ts.isMethodDeclaration(member) ||
        ts.isGetAccessor(member) ||
        ts.isSetAccessor(member);
      if (!isMethodLike || !member.name) continue;
      const methodName = member.name.getText(sourceFile);
      const startLine = lineOf(member.getStart(sourceFile));
      const endLine = lineOf(member.getEnd());
      addChunk(
        `${className}.${methodName}`,
        "method",
        startLine,
        endLine,
        `// class ${className}\n${textOfLines(startLine, endLine)}`,
      );
    }
  }

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      const name = statement.name?.text ?? "default";
      addChunk(
        name,
        "function",
        lineOf(statement.getStart(sourceFile)),
        lineOf(statement.getEnd()),
      );
    } else if (ts.isClassDeclaration(statement)) {
      addClass(statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        const isFunctionLike =
          initializer &&
          (ts.isArrowFunction(initializer) ||
            ts.isFunctionExpression(initializer));
        if (isFunctionLike && ts.isIdentifier(declaration.name)) {
          addChunk(
            declaration.name.text,
            "function",
            lineOf(statement.getStart(sourceFile)),
            lineOf(statement.getEnd()),
          );
        }
      }
    }
  }

  if (chunks.length === 0) {
    const lastLine = lines.length;
    if (lastLine <= windowSize) {
      addChunk("file", "file", 1, lastLine, content);
    } else {
      addWindows(1, lastLine);
    }
  }

  return chunks;
}
