// A minimal ZIP archive writer, with no dependencies.
//
// The store sells one product whose deliverable is actual software
// (SKU AI-AG-065, packages/site-audit-agent). A Markdown document is the right
// delivery format for prompts and templates, but for source code it makes the
// buyer hand-extract thirteen files before they can run anything. A .zip is what
// "download and install" actually means for a Node tool, so this builds one.
//
// Written by hand rather than pulled from npm for the same reason the product
// itself has no dependencies: the archive format is small, completely
// specified, and stable since 1989. `node:zlib` already provides the only hard
// part (DEFLATE), so the rest is headers and a CRC. Adding a dependency to the
// site's build to emit ~200 bytes of header would be the worse trade.
//
// Scope: store + deflate, no ZIP64, no encryption, no multi-disk. That covers
// any payload under 4 GB with fewer than 65,535 entries, which is every archive
// this store will ever serve. Anything larger should not be going through a
// serverless function anyway.

import { deflateRawSync } from 'node:zlib'

export interface ArchiveFile {
  /** Path inside the archive, always POSIX-separated. */
  path: string
  contents: string
  /** True for files that must arrive runnable — shell scripts and CLI entry points. */
  executable?: boolean
}

// A fixed modification time, so the same input always produces byte-identical
// output. That makes the archive cacheable and checksummable: a buyer can
// compare hashes with another buyer and get the same answer, and re-downloading
// never produces a spuriously different file.
//
// 2026-01-01 00:00:00 in MS-DOS format. The DOS date packs year-since-1980 into
// 7 bits, month into 4, day into 5; the time packs hours, minutes, and
// two-second increments.
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1
const DOS_TIME = 0

// Unix st_mode values, shifted into the high 16 bits of the external attributes
// field, which is where the "made by UNIX" flavour of ZIP records permissions.
// Without this every file unzips as 0644 and the installer will not run.
const MODE_FILE = 0o100644
const MODE_EXEC = 0o100755

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

interface Entry {
  nameBytes: Buffer
  crc: number
  compressed: Buffer
  rawSize: number
  method: number
  offset: number
  executable: boolean
}

/**
 * Build a ZIP archive from a list of files.
 *
 * Every entry is DEFLATE-compressed unless compression would make it bigger
 * (which happens with tiny or already-dense files), in which case it is stored
 * uncompressed — the format allows both, per entry.
 */
export function buildZip(files: ArchiveFile[]): Buffer {
  if (files.length > 0xffff) {
    throw new Error(`zip: ${files.length} entries exceeds the 65535 the format allows without ZIP64`)
  }

  const entries: Entry[] = []
  const chunks: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = Buffer.from(file.path, 'utf8')
    const raw = Buffer.from(file.contents, 'utf8')
    const crc = crc32(raw)

    const deflated = deflateRawSync(raw, { level: 9 })
    // Storing is legitimate and sometimes smaller; method 0 means "no compression".
    const useDeflate = deflated.length < raw.length
    const compressed = useDeflate ? deflated : raw
    const method = useDeflate ? 8 : 0

    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0) // local file header signature
    header.writeUInt16LE(20, 4) // version needed: 2.0
    header.writeUInt16LE(0, 6) // general purpose flags
    header.writeUInt16LE(method, 8)
    header.writeUInt16LE(DOS_TIME, 10)
    header.writeUInt16LE(DOS_DATE, 12)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(compressed.length, 18)
    header.writeUInt32LE(raw.length, 22)
    header.writeUInt16LE(nameBytes.length, 26)
    header.writeUInt16LE(0, 28) // extra field length

    chunks.push(header, nameBytes, compressed)
    entries.push({
      nameBytes,
      crc,
      compressed,
      rawSize: raw.length,
      method,
      offset,
      executable: file.executable === true,
    })
    offset += header.length + nameBytes.length + compressed.length
  }

  // Central directory: one record per entry, repeating the metadata and pointing
  // back at each local header. This is the index an unzip tool actually reads.
  const central: Buffer[] = []
  let centralSize = 0

  for (const e of entries) {
    const rec = Buffer.alloc(46)
    rec.writeUInt32LE(0x02014b50, 0) // central directory header signature
    rec.writeUInt16LE(0x031e, 4) // version made by: 3 = UNIX, 30 = 3.0
    rec.writeUInt16LE(20, 6) // version needed: 2.0
    rec.writeUInt16LE(0, 8) // flags
    rec.writeUInt16LE(e.method, 10)
    rec.writeUInt16LE(DOS_TIME, 12)
    rec.writeUInt16LE(DOS_DATE, 14)
    rec.writeUInt32LE(e.crc, 16)
    rec.writeUInt32LE(e.compressed.length, 20)
    rec.writeUInt32LE(e.rawSize, 24)
    rec.writeUInt16LE(e.nameBytes.length, 28)
    rec.writeUInt16LE(0, 30) // extra field length
    rec.writeUInt16LE(0, 32) // comment length
    rec.writeUInt16LE(0, 34) // disk number start
    rec.writeUInt16LE(0, 36) // internal attributes
    rec.writeUInt32LE(((e.executable ? MODE_EXEC : MODE_FILE) << 16) >>> 0, 38)
    rec.writeUInt32LE(e.offset, 42)

    central.push(rec, e.nameBytes)
    centralSize += rec.length + e.nameBytes.length
  }

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0) // end of central directory signature
  end.writeUInt16LE(0, 4) // this disk
  end.writeUInt16LE(0, 6) // disk with the central directory
  end.writeUInt16LE(entries.length, 8) // entries on this disk
  end.writeUInt16LE(entries.length, 10) // entries total
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16) // central directory offset
  end.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...chunks, ...central, end])
}
