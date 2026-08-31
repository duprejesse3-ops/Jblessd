// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Test suite. Run with: npm test   (or: node test/run.mjs)
// Uses node:test and node:assert — both built in, so the package still
// installs nothing. No test touches the public internet.

import './mapping.test.mjs'
import './outbound-retry.test.mjs'
import './server.test.mjs'
