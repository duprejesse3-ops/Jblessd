// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Encryption for the vault file itself. AES-256-GCM, key derived from the
// user's passphrase with scrypt (a fresh random salt per encrypt, stored
// alongside the ciphertext — the salt is not secret, only the passphrase is).
//
// Everything here is Node's own `node:crypto`. No third-party crypto library,
// so there is nothing to audit beyond what ships with Node itself, and
// nothing that can silently change behavior on an `npm update` you never ran
// (this package has no dependencies at all — see package.json).
//
// File layout written by encrypt(): [salt(16)][iv(12)][authTag(16)][ciphertext]
// All fixed-length except the ciphertext, so decrypt() can slice deterministically.

import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto'

const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16
const KEY_LEN = 32 // AES-256
const SCRYPT_OPTS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } // ~100ms on a modern laptop; deliberately slow to raise the cost of brute-forcing a stolen vault file

function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, KEY_LEN, SCRYPT_OPTS)
}

export function encrypt(plaintext, passphrase) {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = deriveKey(passphrase, salt)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([salt, iv, authTag, ciphertext])
}

export class DecryptError extends Error {}

export function decrypt(blob, passphrase) {
  if (blob.length < SALT_LEN + IV_LEN + TAG_LEN) {
    throw new DecryptError('Vault file is too short to be valid — it may be corrupt.')
  }
  const salt = blob.subarray(0, SALT_LEN)
  const iv = blob.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const authTag = blob.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN)
  const ciphertext = blob.subarray(SALT_LEN + IV_LEN + TAG_LEN)
  const key = deriveKey(passphrase, salt)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    // GCM's auth tag check fails on any wrong passphrase or any tampering —
    // both collapse to the same message so nothing about the failure mode
    // leaks to an attacker guessing passphrases.
    throw new DecryptError('Could not open the vault. Wrong passphrase, or the file is corrupt/tampered.')
  }
}

// A random, readable-enough passphrase generated once at `vault init` and
// shown to the user exactly one time. Nothing about it is derived from the
// machine or the account — losing it means losing access to that vault's
// contents, by design (see README's "if you lose the passphrase" section).
export function generatePassphrase() {
  return randomBytes(24).toString('base64url') // 32 chars, URL-safe, no padding
}
