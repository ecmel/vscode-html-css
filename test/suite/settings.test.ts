/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import assert from "assert";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import fs from "fs";
import os from "os";
import path from "path";
import { Uri, workspace } from "vscode";
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
    const styleSheets = settings.getStyleSheets(document);
    assert.strictEqual(styleSheets.length, 1);
    assert.strictEqual(styleSheets[0], "some");
  });

  it("should substitute file variables in style sheets", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vscode-html-css-"));
    const file = path.join(dir, "page.html");
    fs.writeFileSync(file, "");

    sinon.stub(workspace, "getConfiguration").value(() => ({
      get: () => [
        "${fileBasename}",
        "${fileExtname}",
        "${ fileBasenameNoExtension }.css",
        "css/${fileBasenameNoExtension}/${unknown}",
      ],
    }));
    const document = await workspace.openTextDocument(Uri.file(file));

    assert.deepStrictEqual(settings.getStyleSheets(document), [
      "page.html",
      ".html",
      "page.css",
      "css/page/${unknown}",
    ]);
  });

  it("should return auto validation", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "",
    });

    sinon
      .stub(workspace, "getConfiguration")
      .value(() => ({ get: (_key: string, value: unknown) => value }));
    assert.strictEqual(settings.getAutoValidation(document), "Never");

    sinon.restore();
    sinon
      .stub(workspace, "getConfiguration")
      .value(() => ({ get: () => "Save" }));
    assert.strictEqual(settings.getAutoValidation(document), "Save");
  });
});
