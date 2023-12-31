/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

import * as assert from "assert";
import { CompletionList, Position, commands, workspace } from "vscode";

suite("Extension Test Suite", () => {
  test("should complete for html", async () => {
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
});
