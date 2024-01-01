/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

import assert from "assert";
import { describe, it } from "mocha";
import { CompletionList, Position, commands, workspace } from "vscode";

describe("extension", () => {
  it("should suggest completion for html class attributes", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>.selector{}</style>\n<a class='selecto'></a>",
    });

    const list = await commands.executeCommand<CompletionList>(
      "vscode.executeCompletionItemProvider",
      document.uri,
      new Position(1, 17)
    );

    assert.ok(list.items.find((item) => item.label === "selector"));
  });

  it("should suggest completion for html id attributes", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>#selector{}</style>\n<a id='selecto'></a>",
    });

    const list = await commands.executeCommand<CompletionList>(
      "vscode.executeCompletionItemProvider",
      document.uri,
      new Position(1, 14)
    );

    assert.ok(list.items.find((item) => item.label === "selector"));
  });
});
