// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { listContacts, addContact, ContactsError } from '../lib/contacts.mjs'

function tempContactsPath() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mce-contacts-'))
  return { contactsPath: path.join(dir, 'contacts.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('listContacts returns an empty array when no file exists yet', () => {
  const { contactsPath, cleanup } = tempContactsPath()
  try {
    assert.deepEqual(listContacts(contactsPath), [])
  } finally {
    cleanup()
  }
})

test('addContact refuses in read-only mode', () => {
  const { contactsPath, cleanup } = tempContactsPath()
  try {
    assert.throws(
      () => addContact({ safeMode: 'read-only' }, { name: 'Ada', email: 'ada@example.com' }, contactsPath),
      (err) => err instanceof ContactsError && /read-only/.test(err.message),
    )
    assert.deepEqual(listContacts(contactsPath), [])
  } finally {
    cleanup()
  }
})

test('addContact succeeds in read-write mode and persists', () => {
  const { contactsPath, cleanup } = tempContactsPath()
  try {
    const contact = addContact({ safeMode: 'read-write' }, { name: 'Ada', email: 'ada@example.com' }, contactsPath)
    assert.equal(contact.email, 'ada@example.com')
    assert.equal(listContacts(contactsPath).length, 1)
  } finally {
    cleanup()
  }
})

test('addContact requires an email', () => {
  const { contactsPath, cleanup } = tempContactsPath()
  try {
    assert.throws(
      () => addContact({ safeMode: 'read-write' }, { name: 'No Email' }, contactsPath),
      (err) => err instanceof ContactsError && /email/.test(err.message),
    )
  } finally {
    cleanup()
  }
})

test('addContact prepends new contacts, most recent first', () => {
  const { contactsPath, cleanup } = tempContactsPath()
  try {
    addContact({ safeMode: 'read-write' }, { name: 'First', email: 'first@example.com' }, contactsPath)
    addContact({ safeMode: 'read-write' }, { name: 'Second', email: 'second@example.com' }, contactsPath)
    const contacts = listContacts(contactsPath)
    assert.equal(contacts[0].email, 'second@example.com')
    assert.equal(contacts[1].email, 'first@example.com')
  } finally {
    cleanup()
  }
})
