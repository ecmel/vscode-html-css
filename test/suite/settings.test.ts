/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

import assert from "assert";
import { describe, it } from "mocha";
import * as settings from "../../src/settings";
import { workspace } from "vscode";

describe("settings", () => {
  it("should return enabled languages", () => {
    const enabledLanguages = settings.getEnabledLanguages();
    assert.strictEqual(enabledLanguages.length, 1);
    assert.strictEqual(enabledLanguages[0], "html");
  });

  it("should return style sheets", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "",
    });
    const styleSheets = settings.getStyleSheets(document.uri);
    assert.strictEqual(styleSheets.length, 0);
  });
});
