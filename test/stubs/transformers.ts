// Jest stub for @huggingface/transformers. Unit tests must inject a FakeEmbedder;
// reaching this module means a real model load was attempted.
export const env = { cacheDir: "" };

export function pipeline(): never {
  throw new Error(
    "@huggingface/transformers was imported in a unit test. Inject a FakeEmbedder instead.",
  );
}
