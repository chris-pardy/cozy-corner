/**
 * Static Lua script linter. Rejects scripts that use forbidden globals,
 * unsafe patterns, or likely-infinite loops before they ever reach the VM.
 */

export interface LintDiagnostic {
  level: "error" | "warning";
  message: string;
}

/** Maximum script size in bytes. Matches lexicon's behavior code limit. */
const MAX_SCRIPT_BYTES = 10_000;

/**
 * Globals that are banned outright. Any whole-word occurrence in code
 * (outside comments and strings) is an error.
 */
const FORBIDDEN_GLOBALS = [
  "debug",
  "load",
  "loadstring",
  "dofile",
  "loadfile",
  "require",
  "package",
  "module",
  "rawget",
  "rawset",
  "rawequal",
  "rawlen",
  "setmetatable",
  "getmetatable",
  "collectgarbage",
  "setfenv",
  "getfenv",
  "_G",
  "_ENV",
];

/**
 * Lint a Lua script source. Returns an array of diagnostics.
 * Any diagnostic with level "error" means the script must be rejected.
 */
export function lintLuaScript(code: string): LintDiagnostic[] {
  const diags: LintDiagnostic[] = [];

  // --- size limit ---
  if (new TextEncoder().encode(code).length > MAX_SCRIPT_BYTES) {
    diags.push({
      level: "error",
      message: `script exceeds maximum size of ${MAX_SCRIPT_BYTES} bytes`,
    });
    return diags; // no point continuing
  }

  // Strip comments and string literals so we only scan actual code.
  const stripped = stripCommentsAndStrings(code);

  // --- forbidden globals ---
  for (const name of FORBIDDEN_GLOBALS) {
    // \b doesn't work perfectly with leading underscores, so use
    // a lookbehind/lookahead for non-word chars (or start/end).
    const re = new RegExp(`(?<![\\w.])${escapeRegex(name)}(?!\\w)`, "g");
    if (re.test(stripped)) {
      diags.push({
        level: "error",
        message: `forbidden identifier: "${name}"`,
      });
    }
  }

  // --- string.dump / .dump( pattern ---
  if (/\.dump\s*\(/.test(stripped)) {
    diags.push({
      level: "error",
      message: `forbidden: "string.dump" or equivalent .dump() call`,
    });
  }

  // --- loops without when() ---
  // Heuristic: find while/repeat blocks and check that the body
  // contains at least one `when` call. Not foolproof (the yield
  // could be in a called function) but catches the obvious case.
  checkLoopsWithoutYield(stripped, diags);

  return diags;
}

/** Returns true if every diagnostic is a warning (no errors). */
export function lintPassed(diags: LintDiagnostic[]): boolean {
  return diags.every((d) => d.level !== "error");
}

// ---------------------------------------------------------------------------
// Lua comment / string stripping
// ---------------------------------------------------------------------------

/**
 * Replace all Lua comments and string literals with spaces,
 * preserving overall length (so char positions still roughly match).
 */
function stripCommentsAndStrings(code: string): string {
  const out: string[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    // --- block comment: --[=*[ ... ]=*] ---
    if (
      code[i] === "-" &&
      code[i + 1] === "-" &&
      code[i + 2] === "["
    ) {
      const close = matchLongBracket(code, i + 2);
      if (close !== -1) {
        // Replace entire block comment with spaces
        while (i < close) {
          out.push(code[i] === "\n" ? "\n" : " ");
          i++;
        }
        continue;
      }
    }

    // --- line comment: -- ... \n ---
    if (code[i] === "-" && code[i + 1] === "-") {
      while (i < len && code[i] !== "\n") {
        out.push(" ");
        i++;
      }
      continue;
    }

    // --- long string: [=*[ ... ]=*] ---
    if (code[i] === "[") {
      const close = matchLongBracket(code, i);
      if (close !== -1) {
        while (i < close) {
          out.push(code[i] === "\n" ? "\n" : " ");
          i++;
        }
        continue;
      }
    }

    // --- short string: "..." or '...' ---
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      out.push(" ");
      i++;
      while (i < len && code[i] !== quote) {
        if (code[i] === "\\") {
          out.push(" ");
          i++;
        }
        out.push(code[i] === "\n" ? "\n" : " ");
        i++;
      }
      if (i < len) {
        out.push(" "); // closing quote
        i++;
      }
      continue;
    }

    out.push(code[i]);
    i++;
  }

  return out.join("");
}

/**
 * If `code[start]` begins a long bracket (`[=*[`), return the index
 * one past the matching close bracket. Otherwise return -1.
 */
function matchLongBracket(code: string, start: number): number {
  if (code[start] !== "[") return -1;
  let eq = 0;
  let j = start + 1;
  while (j < code.length && code[j] === "=") {
    eq++;
    j++;
  }
  if (j >= code.length || code[j] !== "[") return -1;

  const closePattern = "]" + "=".repeat(eq) + "]";
  const closeIdx = code.indexOf(closePattern, j + 1);
  if (closeIdx === -1) return -1;
  return closeIdx + closePattern.length;
}

// ---------------------------------------------------------------------------
// Loop-without-yield detection
// ---------------------------------------------------------------------------

/**
 * Heuristic: scan for `while ... do ... end` and `repeat ... until`
 * blocks that don't contain the identifier `when` in their body.
 * Only checks top-level and one-deep nesting.
 */
function checkLoopsWithoutYield(code: string, diags: LintDiagnostic[]) {
  // Tokenize enough to find loop boundaries.
  // We look for `while ... do` and `repeat` keywords and their matching end/until.
  const loopRe = /\b(while)\b.*?\bdo\b|\b(repeat)\b/g;
  let match: RegExpExecArray | null;

  while ((match = loopRe.exec(code)) !== null) {
    const isWhile = match[1] !== undefined;
    const bodyStart = match.index + match[0].length;
    const bodyEnd = findLoopEnd(code, bodyStart, isWhile);
    if (bodyEnd === -1) continue;

    const body = code.slice(bodyStart, bodyEnd);
    if (!/\bwhen\s*\(/.test(body)) {
      diags.push({
        level: "error",
        message: `loop without when() will block forever (near position ${match.index})`,
      });
    }
  }
}

/**
 * Find the end of a loop body starting at `start`.
 * For while loops, finds the matching `end`.
 * For repeat loops, finds `until`.
 */
function findLoopEnd(code: string, start: number, isWhile: boolean): number {
  if (!isWhile) {
    // repeat ... until: find `until` at the same nesting depth
    const idx = findMatchingKeyword(code, start, "repeat", "until");
    return idx === -1 ? -1 : idx;
  }
  // while ... do ... end
  return findMatchingKeyword(code, start, "do", "end");
}

/**
 * Starting from `start`, find the keyword that closes the given block,
 * accounting for nested blocks. Returns the index of the close keyword,
 * or -1 if not found.
 */
function findMatchingKeyword(
  code: string,
  start: number,
  _open: string,
  close: string,
): number {
  // Keywords that open new blocks (and require a matching `end`)
  const blockOpeners = /\b(do|then|function)\b/g;
  const allKeywords =
    close === "end"
      ? /\b(do|then|function|end)\b/g
      : /\b(repeat|until)\b/g;

  let depth = 0;
  allKeywords.lastIndex = start;
  let m: RegExpExecArray | null;

  while ((m = allKeywords.exec(code)) !== null) {
    const kw = m[1];
    if (close === "end") {
      if (kw === "do" || kw === "then" || kw === "function") {
        depth++;
      } else if (kw === "end") {
        if (depth === 0) return m.index;
        depth--;
      }
    } else {
      if (kw === "repeat") {
        depth++;
      } else if (kw === "until") {
        if (depth === 0) return m.index;
        depth--;
      }
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
