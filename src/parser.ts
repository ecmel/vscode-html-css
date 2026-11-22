/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import lineColumn from "line-column";

export const enum StyleType {
  ID = "#",
  CLASS = ".",
  VARIABLE = "--",
}

export interface Style {
  index: number;
  line: number;
  col: number;
  type: StyleType;
  selector: string;
  value?: string;
}

// Comments, strings and escapes. Escapes are matched so that an escaped quote
// in a selector (`.a\"b`) does not start a string.
const ignored =
  /\/\*[\s\S]*?(?:\*\/|$)|"(?:[^"\\\n]|\\[\s\S])*"|'(?:[^'\\\n]|\\[\s\S])*'|\\[\s\S]/g;

// A hex escape (`\32 `) or any other escaped character.
const escape = String.raw`\\[0-9a-fA-F]{1,6}[ \t\n]?|\\[^\n]`;

// An identifier cannot start with a digit, or with a hyphen and a digit. Any
// character can be escaped, and non-ASCII characters are allowed.
const nameStart = String.raw`(?:[_a-zA-Z]|[^\x00-\x7F]|${escape})`;
const nameChar = String.raw`(?:[\w-]|[^\x00-\x7F]|${escape})`;

// What may come between a selector and the `{` of its rule: other compound
// selectors, combinators, pseudo-classes and attribute selectors.
const selectorChar = String.raw`(?:[\w\s#.,:()[\]*"'>~+=|^$\\-]|[^\x00-\x7F])`;

const selector = new RegExp(
  String.raw`([.#])((?:-?${nameStart}|--)${nameChar}*)` +
    // Stop at the end of the name, so an SCSS interpolation like
    // `.btn-#{$name}` does not yield a partial `btn-`.
    String.raw`(?!${nameChar}|#\{)` +
    String.raw`(?=${selectorChar}*\{[^}]*\})`,
  "g",
);

// A custom property declaration like `--size-1: .25rem`. The lookbehind skips
// names that are part of something else, like `.a--b:hover`, `$a--b:` or
// `<!--a:`.
const variable = new RegExp(
  String.raw`(?<![\w$@.#!\\-])--(${nameChar}+)\s*:`,
  "g",
);

// The value of a custom property runs until the end of its declaration.
const value = /[^;{}]*/y;

// Replaces comments and string contents with spaces, keeping every other
// character in place so match indices still point into the original text.
function blank(text: string) {
  return text.replace(ignored, (match) =>
    match[0] === "\\"
      ? match
      : match[0] === "/"
        ? match.replace(/[^\n]/g, " ")
        : match[0] + " ".repeat(match.length - 2) + match[match.length - 1],
  );
}

function unescape(name: string) {
  return name.replace(
    /\\([0-9a-fA-F]{1,6})[ \t\n]?|\\(.)/g,
    (_match, hex: string | undefined, char: string) => {
      if (!hex) {
        return char;
      }
      const code = parseInt(hex, 16);
      return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
        ? "\ufffd"
        : String.fromCodePoint(code);
    },
  );
}

export function parse(text: string) {
  const styles: Style[] = [];
  const lc = lineColumn(text, { origin: 0 });
  const source = blank(text);

  // Indices come from matches, so they are always within the text.
  const position = (index: number) => {
    const { line, col } = lc.fromIndex(index)!;
    return { line, col };
  };

  let match;

  selector.lastIndex = 0;
  while ((match = selector.exec(source))) {
    const { line, col } = position(match.index);
    styles.push({
      index: match.index,
      line,
      // Point at the name, after the `.` or `#`.
      col: col + 1,
      type: match[1] as StyleType,
      selector: unescape(match[2]),
    });
  }

  variable.lastIndex = 0;
  while ((match = variable.exec(source))) {
    value.lastIndex = variable.lastIndex;
    value.exec(source);
    styles.push({
      index: match.index,
      ...position(match.index),
      type: StyleType.VARIABLE,
      selector: unescape(match[1]),
      // Strings are blanked in source, so take the value from the text.
      value: text
        .slice(variable.lastIndex, value.lastIndex)
        .trim()
        .replace(/\s+/g, " "),
    });
  }

  return styles.sort((a, b) => a.index - b.index);
}
