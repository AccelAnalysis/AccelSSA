// Next/Turbopack resolves explicit .js imports literally, while the Category 03
// TypeScript sources intentionally use NodeNext .js specifiers. The production
// build compiles this workspace first, so the application runtime consumes the
// same generated domain module used by the package test suite.
export * from "../dist/index.js";
