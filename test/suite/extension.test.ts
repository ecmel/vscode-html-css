/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import assert from "assert";
import { describe, it } from "mocha";
import { CompletionList, Position, commands, workspace } from "vscode";

describe("extension", () => {
  it("should complete id and class attributes", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>#main,.red{}</style>\n<a id='mai' class='re'></a>",
    });

    let list = await commands.executeCommand<CompletionList>(
      "vscode.executeCompletionItemProvider",
      document.uri,
      new Position(1, 10)
    );

    assert.ok(list.items.find((item) => item.label === "main"));

    list = await commands.executeCommand<CompletionList>(
      "vscode.executeCompletionItemProvider",
      document.uri,
      new Position(1, 21)
    );

    assert.ok(list.items.find((item) => item.label === "red"));
  });
});
