import "@testing-library/jest-dom";

// jsdom ships no fetch; component tests always mock it via jest.spyOn.
if (!("fetch" in globalThis)) {
  Object.defineProperty(globalThis, "fetch", {
    value: () => Promise.reject(new Error("fetch was not mocked in this test")),
    writable: true,
    configurable: true,
  });
}

// Older jsdom versions lack Blob/File.text(), which the dropzone relies on.
if (typeof File !== "undefined" && typeof File.prototype.text !== "function") {
  File.prototype.text = function text(this: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
