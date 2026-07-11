/**
 * Resource-pattern matching for capabilities (TC-07).
 *
 * A grant authorizes an action against a resource *pattern*. Requests carry a
 * concrete resource. Matching is intentionally strict and simple:
 *   - `*`  matches any run of characters except the path separator `/`
 *   - `**` matches any run of characters including `/` (a whole suffix)
 *   - everything else is a literal, including the URI scheme
 *
 * We compile to an anchored RegExp. Fragile ad-hoc string matching is a named
 * code-slop category, so this is the one place matching logic lives.
 */

function escapeLiteral(segment: string): string {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function compileResourcePattern(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!;
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i += 1;
      } else {
        out += '[^/]*';
      }
    } else {
      out += escapeLiteral(ch);
    }
  }
  return new RegExp(`^${out}$`);
}

/**
 * True iff `resource` is authorized by `pattern`. Deny-friendly: an empty or
 * malformed input never accidentally matches.
 */
export function resourceMatches(pattern: string, resource: string): boolean {
  if (pattern.length === 0 || resource.length === 0) return false;
  return compileResourcePattern(pattern).test(resource);
}
