// Vitest runs outside Next's server/client module graph, so the real
// `server-only` package (which throws when imported from a "client"
// context) would fail every test that imports server code. This no-op
// shim is aliased in for tests only (see vitest.config.mts); production
// builds still use the real package via Next's bundler.
export {};
