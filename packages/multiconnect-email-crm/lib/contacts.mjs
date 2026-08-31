// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A simple JSON-file-backed contact list — the "maintains its own simple
// contact list if none is connected" half of the product listing. Not a
// real CRM integration; a lightweight fallback so the agent always has
// somewhere to read and log contacts, with the same safe-mode write gate
// as everything else in this line.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

function defaultContactsPath() {
  return path.resolve(process.cwd(), 'contacts.json')
}

/** @typedef {{ id: string, name: string, email: string, notes: string, createdAt: string }} Contact */

/** @param {string} [contactsPath] @returns {Contact[]} */
export function listContacts(contactsPath = defaultContactsPath()) {
  if (!existsSync(contactsPath)) return []
  try {
    return JSON.parse(readFileSync(contactsPath, 'utf8'))
  } catch {
    return []
  }
}

export class ContactsError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ContactsError'
  }
}

/**
 * Add a contact. Refuses outright unless safe mode is read-write, same as
 * every other write path in this product line.
 * @param {import('./config.mjs').EmailConfig} config
 * @param {{ name: string, email: string, notes?: string }} input
 * @param {string} [contactsPath]
 * @returns {Contact}
 */
export function addContact(config, input, contactsPath = defaultContactsPath()) {
  if (config.safeMode !== 'read-write') {
    throw new ContactsError('Refused: safe mode is read-only. Switch to read-write in the dashboard to add contacts.')
  }
  if (!input.email) throw new ContactsError('A contact needs an email address.')

  const contacts = listContacts(contactsPath)
  /** @type {Contact} */
  const contact = {
    id: randomUUID(),
    name: input.name ?? '',
    email: input.email,
    notes: input.notes ?? '',
    createdAt: new Date().toISOString(),
  }
  contacts.unshift(contact)
  mkdirSync(path.dirname(contactsPath), { recursive: true })
  writeFileSync(contactsPath, JSON.stringify(contacts, null, 2) + '\n', 'utf8')
  return contact
}

export { defaultContactsPath }
