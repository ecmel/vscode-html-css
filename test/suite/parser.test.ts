/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import assert from "assert";
import { describe, it } from "mocha";
import { parse } from "../../src/parser";

describe("parser", () => {
  it("should parse escaped classes", async () => {
    const css = String.raw`
      .\+pd-all-lg {
	      padding: 64px!important;
      }
      .\+pd-all-md {
        padding: 32px!important;
      }
      .\+pd-all-sm {
        padding: 7.999px!important;
      }
      .\+pd-all-none {
        padding: 0!important;
      }
    `;
    assert.deepStrictEqual(
      parse(css).map((style) => style.selector),
      ["+pd-all-lg", "+pd-all-md", "+pd-all-sm", "+pd-all-none"],
    );
  });

  const selectors = (css: string) =>
    parse(css).map((style) => style.type + style.selector);

  it("should parse ids and classes", () => {
    assert.deepStrictEqual(selectors("#main, .red, .a.b {}"), [
      "#main",
      ".red",
      ".a",
      ".b",
    ]);
  });

  it("should parse selectors joined by combinators", () => {
    assert.deepStrictEqual(selectors(".a+.b {}"), [".a", ".b"]);
    assert.deepStrictEqual(selectors(".a + .b {}"), [".a", ".b"]);
    assert.deepStrictEqual(selectors(".a~.b {}"), [".a", ".b"]);
    assert.deepStrictEqual(selectors(".a ~ .b {}"), [".a", ".b"]);
    assert.deepStrictEqual(selectors(".a>.b {}"), [".a", ".b"]);
    assert.deepStrictEqual(selectors(".a .b {}"), [".a", ".b"]);
    assert.deepStrictEqual(selectors("svg|a.b {}"), [".b"]);
  });

  it("should parse selectors with pseudo classes and attributes", () => {
    assert.deepStrictEqual(selectors(".btn:hover::before {}"), [".btn"]);
    assert.deepStrictEqual(selectors(".a:not(.b) {}"), [".a", ".b"]);
    assert.deepStrictEqual(selectors(".btn[disabled] {}"), [".btn"]);
    assert.deepStrictEqual(selectors('a.x[href$=".pdf"] {}'), [".x"]);
    assert.deepStrictEqual(selectors("a.x[href$='.pdf'] {}"), [".x"]);
  });

  it("should parse escaped and non-ascii selectors", () => {
    assert.deepStrictEqual(selectors(".sm\\:flex {}"), [".sm:flex"]);
    assert.deepStrictEqual(selectors(".w-1\\/2 {}"), [".w-1/2"]);
    assert.deepStrictEqual(selectors(".w-\\[10px\\] {}"), [".w-[10px]"]);
    assert.deepStrictEqual(selectors(".\\!mt-0 {}"), [".!mt-0"]);
    assert.deepStrictEqual(selectors(".a\\\\b {}"), [".a\\b"]);
    assert.deepStrictEqual(selectors(".\\32xl\\:p-0 {}"), [".2xl:p-0"]);
    assert.deepStrictEqual(selectors(".\\31 0 .\\31  .x {}"), [
      ".10",
      ".1",
      ".x",
    ]);
    assert.deepStrictEqual(selectors(".\\1F600 {}"), [".\u{1F600}"]);
    assert.deepStrictEqual(selectors(".\\0 a {}"), [".\ufffda"]);
    assert.deepStrictEqual(selectors('.a\\"b {}'), ['.a"b']);
    assert.deepStrictEqual(selectors(".café .日本 {}"), [".café", ".日本"]);
    assert.deepStrictEqual(selectors(".-a .--b ._c {}"), [
      ".-a",
      ".--b",
      "._c",
    ]);
  });

  it("should not parse numbers as selectors", () => {
    assert.deepStrictEqual(selectors("@media (min-width: 37.5em) { .c {} }"), [
      ".c",
    ]);
    assert.deepStrictEqual(selectors(".5col, .-5col {}"), []);
    assert.deepStrictEqual(selectors(".x { margin: .5em; }"), [".x"]);
  });

  it("should not parse selectors in declarations", () => {
    assert.deepStrictEqual(selectors(".x { color: #fff; }"), [".x"]);
    assert.deepStrictEqual(selectors(".x { color: #fff }"), [".x"]);
    assert.deepStrictEqual(selectors(".bg { background: url(img.png) }"), [
      ".bg",
    ]);
    assert.deepStrictEqual(selectors('.q::before { content: ".x {}" }'), [
      ".q",
    ]);
  });

  it("should not parse selectors in comments", () => {
    assert.deepStrictEqual(selectors("/* .old {} */ .new {}"), [".new"]);
    assert.deepStrictEqual(selectors(".a/* c */{}"), [".a"]);
    assert.deepStrictEqual(selectors(".a {} /* .b {} "), [".a"]);
  });

  it("should parse scss", () => {
    assert.deepStrictEqual(selectors(".card { &.active {} }"), [
      ".card",
      ".active",
    ]);
    assert.deepStrictEqual(selectors(".card { .body {} }"), [".card", ".body"]);
    assert.deepStrictEqual(selectors(".btn-#{$name} {}"), []);
    assert.deepStrictEqual(selectors("#{$sel} .x {}"), [".x"]);
    assert.deepStrictEqual(selectors("$m: (a: .5); .y { @include m(.5); }"), [
      ".y",
    ]);
  });

  it("should report positions in the original text", () => {
    const styles = parse("/* .a {} */\n.b,\n  #c {}");
    assert.deepStrictEqual(
      styles.map(({ index, line, col, selector }) => [
        selector,
        index,
        line,
        col,
      ]),
      [
        ["b", 12, 1, 1],
        ["c", 18, 2, 3],
      ],
    );
  });

  const variables = (css: string) =>
    parse(css)
      .filter((style) => style.type === "--")
      .map((style) => [style.selector, style.value]);

  it("should parse custom properties", () => {
    assert.deepStrictEqual(
      variables(":root { --size-1: .25rem; --font: system-ui, sans-serif }"),
      [
        ["size-1", ".25rem"],
        ["font", "system-ui, sans-serif"],
      ],
    );
    assert.deepStrictEqual(variables(":where(html){--a:1;--b:2}"), [
      ["a", "1"],
      ["b", "2"],
    ]);
    assert.deepStrictEqual(variables(".x { --empty:; }"), [["empty", ""]]);
  });

  it("should keep strings and spacing in custom property values", () => {
    assert.deepStrictEqual(
      variables(":root { --noise: url(\"data:a;b{c}\") ; --q: 'x' }"),
      [
        ["noise", 'url("data:a;b{c}")'],
        ["q", "'x'"],
      ],
    );
    assert.deepStrictEqual(
      variables(
        ":root {\n  --shadow:\n    0 1px 2px red,\n    0 2px 4px blue;\n}",
      ),
      [["shadow", "0 1px 2px red, 0 2px 4px blue"]],
    );
  });

  it("should parse escaped and non-ascii custom properties", () => {
    assert.deepStrictEqual(variables(":root { --a\\:b: 1; --café: 2 }"), [
      ["a:b", "1"],
      ["café", "2"],
    ]);
  });

  it("should not parse custom property usages or lookalikes", () => {
    assert.deepStrictEqual(
      variables(".a { color: var(--b); margin: var(--c, 1px) }"),
      [],
    );
    assert.deepStrictEqual(variables(".a--b:hover {}"), []);
    assert.deepStrictEqual(variables(".--b:hover {}"), []);
    assert.deepStrictEqual(variables("$a--b: 1;"), []);
    assert.deepStrictEqual(variables("<!--a: b -->"), []);
    assert.deepStrictEqual(variables("/* --a: 1 */ x ? i--: j"), []);
  });

  it("should parse custom properties with selectors in order", () => {
    const styles = parse(".a { --b: 1 }\n#c { --d: 2 }");
    assert.deepStrictEqual(
      styles.map(({ type, selector, line, col }) => [
        type,
        selector,
        line,
        col,
      ]),
      [
        [".", "a", 0, 1],
        ["--", "b", 0, 5],
        ["#", "c", 1, 1],
        ["--", "d", 1, 5],
      ],
    );
  });
});
