// Provides the `Netlify` global that the platform injects into function and
// edge-function runtimes.
//
// Exactly one place in the application depends on it — tag-gateway.ts reads
// Netlify.env.get('GOOGLE_TAG_GATEWAY_ID') without a guard, so without this the
// edge function throws a ReferenceError on its first request rather than
// failing gracefully. netlify/lib/email.mts also reaches for it but already
// falls back to process.env on its own.
//
// Environment variables are the only part of the global the codebase uses, and
// they map directly onto process.env.

export function installNetlifyGlobal() {
  if (globalThis.Netlify) return

  globalThis.Netlify = {
    env: {
      get: (name) => process.env[name],
      has: (name) => Object.hasOwn(process.env, name),
      set: (name, value) => {
        process.env[name] = String(value)
      },
      delete: (name) => {
        delete process.env[name]
      },
      toObject: () => ({ ...process.env }),
    },
  }
}
