// Stands in for `@netlify/edge-functions`.
//
// The four edge functions import only `type { Context, Config }` from this
// package — no runtime values at all — so type stripping removes every
// reference to it before Node ever tries to load anything. This module exists
// purely so the resolver has a valid target if that ever stops being true, and
// so a stray runtime import fails with a clear message rather than a confusing
// module-not-found against a package that is not installed.

export default {}
