#!/usr/bin/env node
/**
 * AIDLC · Citation validator (tier 3 enforcer)
 *
 * Enforces the citation rule from A6: every `path:line` cited in a research or
 * plan handoff doc must point at a real file, and the line must be in range.
 * This is the mechanical layer that kills fabricated paths before a human or
 * the verifier ever looks at the doc.
 *
 * Usage:
 *   node scripts/aidlc/validate-citations.mjs <file.md | feature-dir> [...more]
 *
 * - Given a .md file, validates citations in that file.
 * - Given a directory, validates 01-research.md and 02-plan.md inside it.
 *
 * What counts as a citation: an inline-code token (`...`) that contains a `/`
 * and a file extension, optionally followed by `:line` or `:line-line`.
 * Tokens on a line containing "(new)" are skipped — they're proposed files that
 * don't exist yet. Placeholder tokens (with <, >, ..., or :NN) are skipped.
 *
 * Exit code 0 = all citations resolve. Non-zero = at least one bad citation.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const INLINE_CODE = /`([^`\n]+?)`/g
const PATH_WITH_OPTIONAL_LINE = /^([\w./@-]+\/[\w./@-]+\.\w+)(?::(\d+)(?:-(\d+))?)?$/
const PLACEHOLDER = /[<>]|\.\.\.|:NN\b|:N\b/

function lineCount(absPath) {
  const text = readFileSync(absPath, 'utf8')
  // A trailing newline shouldn't inflate the count.
  const n = text.split('\n').length
  return text.endsWith('\n') ? n - 1 : n
}

/** @returns {{file:string, ok:boolean, problems:string[]}} */
function validateFile(mdPath) {
  const problems = []
  const text = readFileSync(mdPath, 'utf8')
  const lines = text.split('\n')

  lines.forEach((line, idx) => {
    if (line.includes('(new)')) return // proposed file, nothing to resolve yet
    let m
    INLINE_CODE.lastIndex = 0
    while ((m = INLINE_CODE.exec(line)) !== null) {
      const token = m[1].trim()
      if (PLACEHOLDER.test(token)) continue
      const pm = token.match(PATH_WITH_OPTIONAL_LINE)
      if (!pm) continue // not a path citation (e.g. useTheme(), @occ/shared)

      const [, relPath, startStr, endStr] = pm
      const absPath = isAbsolute(relPath) ? relPath : join(REPO_ROOT, relPath)
      const where = `line ${idx + 1}: \`${token}\``

      if (!existsSync(absPath)) {
        problems.push(`${where} → file not found: ${relPath}`)
        continue
      }
      if (startStr) {
        const total = lineCount(absPath)
        const start = Number(startStr)
        const end = endStr ? Number(endStr) : start
        if (start < 1 || end > total || start > end) {
          problems.push(`${where} → line ${startStr}${endStr ? '-' + endStr : ''} out of range (file has ${total} lines)`)
        }
      }
    }
  })

  return { file: mdPath, ok: problems.length === 0, problems }
}

function resolveTargets(args) {
  const targets = []
  for (const arg of args) {
    const abs = isAbsolute(arg) ? arg : resolve(process.cwd(), arg)
    if (!existsSync(abs)) {
      console.error(`✖ not found: ${arg}`)
      process.exitCode = 2
      continue
    }
    if (statSync(abs).isDirectory()) {
      for (const name of ['01-research.md', '02-plan.md']) {
        const f = join(abs, name)
        if (existsSync(f)) targets.push(f)
      }
    } else {
      targets.push(abs)
    }
  }
  return targets
}

function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('usage: node scripts/aidlc/validate-citations.mjs <file.md | feature-dir> [...]')
    process.exit(2)
  }

  const targets = resolveTargets(args)
  if (targets.length === 0) {
    console.error('No research/plan docs found to validate.')
    process.exit(2)
  }

  let failed = 0
  for (const t of targets) {
    const { ok, problems } = validateFile(t)
    const rel = t.startsWith(REPO_ROOT) ? t.slice(REPO_ROOT.length + 1) : t
    if (ok) {
      console.log(`✅ ${rel} — all citations resolve`)
    } else {
      failed++
      console.log(`❌ ${rel} — ${problems.length} bad citation(s):`)
      for (const p of problems) console.log(`   ${p}`)
    }
  }

  if (failed > 0) {
    console.log(`\n${failed} file(s) failed citation validation.`)
    process.exit(1)
  }
  console.log('\nAll citations valid.')
}

main()
