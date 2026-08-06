// Loaded with `node --import ./container/hooks/register.mjs`, which runs it
// before the main module is evaluated. Registering the resolver from a separate
// tiny file is required: hooks must be in place before any application import
// is resolved, and `module.register` only affects modules loaded after it runs.

import { register } from 'node:module'

register('./resolver.mjs', import.meta.url)
