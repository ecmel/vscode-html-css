/*
 * Copyright (c) 1986-2023 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import assert from "assert";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { workspace } from "vscode";
import * as settings from "../../src/settings";

describe("settings", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should return enabled languages", () => {
    sinon
      .stub(workspace, "getConfiguration")
      .value(() => ({ get: () => ["html"] }));
    const enabledLanguages = settings.getEnabledLanguages();
    assert.strictEqual(enabledLanguages.length, 1);
    assert.strictEqual(enabledLanguages[0], "html");
  });

  it("should return style sheets", async () => {
    sinon
      .stub(workspace, "getConfiguration")
      .value(() => ({ get: () => ["some"] }));
    const document = await workspace.openTextDocument({
      language: "html",
      content: "",
    });
    const styleSheets = settings.getStyleSheets(document.uri);
    assert.strictEqual(styleSheets.length, 1);
    assert.strictEqual(styleSheets[0], "some");
  });
});
