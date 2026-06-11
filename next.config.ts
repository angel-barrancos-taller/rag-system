import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // transformers.js ships native/WASM runtimes (onnxruntime) that must not be bundled.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
