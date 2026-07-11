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
 * True iff the string contains a control character (code point < 0x20, or DEL).
 * Such characters never legitimately appear in a URI-shaped resource identifier.
 */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * True iff `resource` is authorized by `pattern`. Deny-friendly: an empty or
 * malformed input never accidentally matches.
 *
 * Control characters are rejected up front. Without this, a `*` segment (`[^/]*`)
 * would match a newline, so `secret://GITHUB_*` would over-match a newline-injected
 * resource such as `secret://GITHUB_TOKEN\n<anything>`. A resource identifier is a
 * URI; a control character in it is malformed, and malformed input is denied.
 */
export function resourceMatches(pattern: string, resource: string): boolean {
  if (pattern.length === 0 || resource.length === 0) return false;
  if (hasControlChar(pattern) || hasControlChar(resource)) return false;
  return compileResourcePattern(pattern).test(resource);
}
