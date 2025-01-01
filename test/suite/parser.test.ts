/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import assert from "assert";
import { describe, it } from "mocha";
import { parse } from "../../src/parser";

describe("parser", () => {
  it("should parse escaped classes", async () => {
    const css = `
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
    const res = parse(css);
    assert.strictEqual(res.length, 4);
  });
});
