#!/usr/bin/env node
/**
 * AIDLC · Coverage-matrix checker (tier 3 enforcer)
 *
 * Enforces the traceability spine from A6. Cross-references the requirements
 * ledger (00-spec.md) against the implementation report (03-impl-report.md):
 *
 *   - GAP    : a `must` requirement with no change referencing it.
 *   - ORPHAN : a row in the impl-report "Changes made" table with no R-id
 *              (a change that traces to no requirement → scope creep).
 *
 * Usage:
 *   node scripts/aidlc/check-coverage.mjs <feature-dir>
 *
 * Exit code 0 = no gaps, no orphans. Non-zero = at least one of either.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

const R_ID = /\bR\d+\b/g
const PRIORITY = /\b(must|should|could)\b/i

function readMaybe(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

/** Parse the ledger table → [{ id, priority, withdrawn }]. */
function parseLedger(specText) {
  const reqs = []
  for (const raw of specText.split('\n')) {
    const line = raw.trim()
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim()).filter((c, i, a) => !(c === '' && (i === 0 || i === a.length - 1)))
    const idCell = cells.find((c) => /^R\d+$/.test(c))
    if (!idCell) continue // header / separator / non-ledger row
    const withdrawn = /withdrawn/i.test(line)
    const priorityCell = cells.find((c) => /^(must|should|could)$/i.test(c))
    reqs.push({ id: idCell, priority: priorityCell ? priorityCell.toLowerCase() : 'unknown', withdrawn })
  }
  return reqs
}

/** All R-ids referenced anywhere in the impl report = the covered set. */
function parseCoveredIds(reportText) {
  const set = new Set()
  let m
  R_ID.lastIndex = 0
  while ((m = R_ID.exec(reportText)) !== null) set.add(m[0])
  return set
}

/** Rows of the "## Changes made" table with no R-id = orphans. */
function findOrphans(reportText) {
  const lines = reportText.split('\n')
  const orphans = []
  let inSection = false
  let inTable = false

  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('## ')) {
      inSection = /changes made/i.test(line)
      inTable = false
      continue
    }
    if (!inSection) continue
    if (!line.startsWith('|')) {
      if (inTable && line === '') break // table ended
      continue
    }
    // Skip header row and the |---|---| separator.
    if (/^\|[\s:|-]+\|$/.test(line)) {
      inTable = true
      continue
    }
    if (/file.*what changed|r-ids/i.test(line)) continue // header
    if (!inTable) continue
    if (line.includes('<') && line.includes('>')) continue // template placeholder row
    if (!R_ID.test(line)) {
      R_ID.lastIndex = 0
      orphans.push(line)
    }
    R_ID.lastIndex = 0
  }
  return orphans
}

function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('usage: node scripts/aidlc/check-coverage.mjs <feature-dir>')
    process.exit(2)
  }
  const dir = isAbsolute(arg) ? arg : resolve(process.cwd(), arg)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error(`✖ not a directory: ${arg}`)
    process.exit(2)
  }

  const specText = readMaybe(join(dir, '00-spec.md'))
  const reportText = readMaybe(join(dir, '03-impl-report.md'))
  if (!specText) {
    console.error('✖ 00-spec.md not found — cannot check coverage without a ledger.')
    process.exit(2)
  }
  if (!reportText) {
    console.error('✖ 03-impl-report.md not found — run IMPLEMENT before checking coverage.')
    process.exit(2)
  }

  const reqs = parseLedger(specText).filter((r) => !r.withdrawn)
  const covered = parseCoveredIds(reportText)
  const orphans = findOrphans(reportText)

  const mustGaps = reqs.filter((r) => r.priority === 'must' && !covered.has(r.id))
  const softGaps = reqs.filter((r) => r.priority !== 'must' && !covered.has(r.id))

  console.log(`Ledger: ${reqs.length} active requirement(s) — ${reqs.filter((r) => r.priority === 'must').length} must.`)
  console.log(`Covered in impl-report: ${[...covered].sort().join(', ') || '(none)'}\n`)

  let failed = false

  if (mustGaps.length) {
    failed = true
    console.log(`❌ GAPS — ${mustGaps.length} must-requirement(s) with no change:`)
    for (const r of mustGaps) console.log(`   ${r.id} (must)`)
  } else {
    console.log('✅ No gaps — every must-requirement is covered.')
  }

  if (orphans.length) {
    failed = true
    console.log(`\n❌ ORPHANS — ${orphans.length} change row(s) with no R-id (possible scope creep):`)
    for (const o of orphans) console.log(`   ${o}`)
  } else {
    console.log('✅ No orphans — every change row cites a requirement.')
  }

  if (softGaps.length) {
    console.log(`\n⚠️  ${softGaps.length} should/could requirement(s) uncovered (not a failure): ${softGaps.map((r) => r.id).join(', ')}`)
  }

  if (failed) {
    console.log('\nCoverage check FAILED.')
    process.exit(1)
  }
  console.log('\nCoverage check passed.')
}

main()
