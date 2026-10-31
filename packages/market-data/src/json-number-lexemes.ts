/**
 * Parse JSON while preserving every numeric lexeme as a string.
 *
 * This keeps source decimals intact until an explicit domain parser validates them,
 * instead of silently rounding through JavaScript IEEE-754 numbers. JSON syntax is
 * still fully validated by the native JSON parser after this token-preserving scan.
 */
export function parseJsonPreservingNumericLexemes(text: string): unknown {
  if (typeof text !== "string") throw new TypeError("JSON input must be text.");

  let output = "";
  let inString = false;
  let escaped = false;
  let index = 0;

  while (index < text.length) {
    const character = text[index]!;

    if (inString) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
      index += 1;
      continue;
    }

    if (character === "-" || (character >= "0" && character <= "9")) {
      const match = text.slice(index).match(/^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
      if (match === null) throw new SyntaxError("Invalid JSON numeric token.");
      output += JSON.stringify(match[0]);
      index += match[0].length;
      continue;
    }

    output += character;
    index += 1;
  }

  if (inString || escaped) throw new SyntaxError("Unterminated JSON string.");
  return JSON.parse(output) as unknown;
}
