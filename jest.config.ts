import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const moduleNameMapper = {
  "^@/(.*)$": "<rootDir>/src/$1",
  // Unit tests must never load the real model runtime or call OpenRouter.
  // These stubs throw on use so an accidental import fails loudly.
  "^@huggingface/transformers$": "<rootDir>/test/stubs/transformers.ts",
  "^@openrouter/sdk$": "<rootDir>/test/stubs/openrouter.ts",
};

const buildConfig = async () => ({
  projects: [
    await createJestConfig({
      displayName: "node",
      testEnvironment: "node",
      moduleNameMapper,
      setupFiles: ["<rootDir>/jest.setup.node.ts"],
      testMatch: ["<rootDir>/src/lib/**/*.test.ts"],
      testPathIgnorePatterns: ["\\.integration\\.test\\.ts$"],
    })(),
    await createJestConfig({
      displayName: "jsdom",
      testEnvironment: "jsdom",
      moduleNameMapper,
      setupFilesAfterEnv: ["<rootDir>/jest.setup.jsdom.ts"],
      testMatch: [
        "<rootDir>/src/components/**/*.test.tsx",
        "<rootDir>/src/app/**/*.test.tsx",
      ],
    })(),
  ],
});

export default buildConfig;
