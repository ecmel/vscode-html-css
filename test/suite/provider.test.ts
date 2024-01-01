/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

import assert from "assert";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import {
  CancellationToken,
  CompletionContext,
  Position,
  workspace,
} from "vscode";
import { Provider } from "../../src/provider";
import * as settings from "../../src/settings";

describe("provider", () => {
  let provider: Provider;
  let token: CancellationToken;
  let context: CompletionContext;

  beforeEach(() => {
    provider = new Provider();

    token = {
      isCancellationRequested: false,
      onCancellationRequested: <any>(() => false),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should complete from remote style sheets", async () => {
    sinon
      .stub(settings, "getStyleSheets")
      .value(() => [
        "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css",
      ]);

    const document = await workspace.openTextDocument({
      language: "html",
      content: "<a class='containe'></a>",
    });

    const items = await provider.provideCompletionItems(
      document,
      new Position(0, 18),
      token,
      context
    );

    assert.ok(items);
    assert.ok("find" in items);
    assert.ok(items.find((item) => item.label === "container"));
  });

  it("should support go to definition for class selectors", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>.one{}</style>\n<a class='one'></a>",
    });
    const locations = await provider.provideDefinition(
      document,
      new Position(1, 13),
      token
    );
    assert.ok(locations);
    assert.ok("length" in locations);
    assert.strictEqual(locations.length, 1);
  });

  it("should validate class selectors", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>.one{}</style>\n<a class='one two three'></a>",
    });
    const diagnostics = await provider.validate(document);
    assert.strictEqual(diagnostics.length, 2);
  });
});
