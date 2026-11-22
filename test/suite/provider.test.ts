/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import assert from "assert";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import {
  CancellationToken,
  CompletionContext,
  CompletionItemKind,
  CompletionTriggerKind,
  MarkdownString,
  Position,
  RelativePattern,
  Uri,
  WorkspaceFolder,
  window,
  workspace,
} from "vscode";
import { Provider, clear, invalidate } from "../../src/provider";
import * as settings from "../../src/settings";
import { parse } from "../../src/parser";

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

    context = {
      triggerKind: CompletionTriggerKind.Invoke,
      triggerCharacter: undefined,
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should complete from local style sheets", async () => {
    sinon.stub(workspace, "getWorkspaceFolder").value(() => ({}));
    sinon.stub(workspace, "findFiles").value(() => [""]);
    sinon.stub(workspace, "fs").value({ readFile: async () => ".container{}" });
    sinon.stub(settings, "getStyleSheets").value(() => ["style"]);
    sinon.stub(provider, <any>"getRelativePattern").value(() => "");

    const document = await workspace.openTextDocument({
      language: "html",
      content: "<a class='containe'></a>",
    });

    const items = await provider.provideCompletionItems(
      document,
      new Position(0, 18),
      token,
      context,
    );

    assert.ok(items);
    assert.ok("find" in items);
    assert.ok(items.find((item) => item.label === "container"));
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
      context,
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
      token,
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

  it("should cache style sheets", async () => {
    let read = false;

    sinon.stub(workspace, "fs").value({
      readFile: async () => {
        read = true;
        return ".container{}";
      },
    });

    const document = await workspace.openTextDocument({
      language: "html",
      content: "<a class='containe'></a>",
    });

    await provider["getLocal"](document.uri);
    assert.strictEqual(read, true);
    read = false;
    await provider["getLocal"](document.uri);
    assert.strictEqual(read, false);
    clear();
    await provider["getLocal"](document.uri);
    assert.strictEqual(read, true);
    read = false;
    await provider["getLocal"](document.uri);
    assert.strictEqual(read, false);
    invalidate(document.uri.toString());
    await provider["getLocal"](document.uri);
    assert.strictEqual(read, true);
  });

  it("should show error message for remote failures", async () => {
    const url =
      "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css2";

    let shown = false;
    sinon.stub(window, "showErrorMessage").value(() => (shown = true));
    await provider["fetch"](url);
    assert.strictEqual(shown, true);
  });

  it("should complete id attributes with id selectors only", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>#main{} .mainly{}</style>\n<a id='mai'></a>",
    });

    const items = await provider.provideCompletionItems(
      document,
      new Position(1, 10),
      token,
      context,
    );

    assert.ok(items && "map" in items);
    assert.deepStrictEqual(
      items.map((item) => [item.label, item.kind]),
      [["main", CompletionItemKind.Value]],
    );
  });

  it("should complete class attributes with enum kind", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>#main{} .mainly{}</style>\n<a class='mai'></a>",
    });

    const items = await provider.provideCompletionItems(
      document,
      new Position(1, 13),
      token,
      context,
    );

    assert.ok(items && "map" in items);
    assert.deepStrictEqual(
      items.map((item) => [item.label, item.kind]),
      [["mainly", CompletionItemKind.Enum]],
    );
  });

  it("should not complete outside of attributes", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>.one{}</style>\n<a href='o'></a>",
    });

    await assert.rejects(
      Promise.resolve(
        provider.provideCompletionItems(
          document,
          new Position(1, 10),
          token,
          context,
        ),
      ),
    );
  });

  it("should not complete when cancelled", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>.one{}</style>\n<a class='o'></a>",
    });

    token.isCancellationRequested = true;

    await assert.rejects(
      Promise.resolve(
        provider.provideCompletionItems(
          document,
          new Position(1, 11),
          token,
          context,
        ),
      ),
    );
  });

  it("should not provide definitions outside of attributes", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>.one{}</style>\n<a href='one'></a>",
    });

    await assert.rejects(
      Promise.resolve(
        provider.provideDefinition(document, new Position(1, 11), token),
      ),
    );
  });

  it("should not provide definitions in remote style sheets", async () => {
    const url = "https://example.com/style.css";
    sinon.stub(settings, "getStyleSheets").value(() => [url]);
    sinon.stub(provider, <any>"getRemote").value(async () => parse(".one{}"));

    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>.one{}</style>\n<a class='one'></a>",
    });

    const locations = await provider.provideDefinition(
      document,
      new Position(1, 13),
      token,
    );

    assert.ok(locations && "map" in locations);
    assert.deepStrictEqual(
      locations.map((location) => "uri" in location && location.uri.scheme),
      ["untitled"],
    );
  });

  it("should skip local style sheets without a workspace folder", async () => {
    const findFiles = sinon.stub(workspace, "findFiles");
    sinon.stub(workspace, "getWorkspaceFolder").value(() => undefined);
    sinon.stub(settings, "getStyleSheets").value(() => ["**/*.css"]);

    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>.one{}</style>\n<a class='o'></a>",
    });

    const items = await provider.provideCompletionItems(
      document,
      new Position(1, 11),
      token,
      context,
    );

    assert.ok(items && "map" in items);
    assert.deepStrictEqual(
      items.map((item) => item.label),
      ["one"],
    );
    assert.ok(findFiles.notCalled);
  });

  it("should cache remote style sheets", async () => {
    const url = "https://example.com/cached.css";
    const fetch = sinon.fake.resolves(".remote{}");
    sinon.stub(provider, <any>"fetch").value(fetch);

    const first = await provider["getRemote"](url);
    const second = await provider["getRemote"](url);

    assert.strictEqual(first, second);
    assert.strictEqual(first[0].selector, "remote");
    assert.ok(fetch.calledOnceWith(url));
    invalidate(url);
  });

  it("should create relative patterns from workspace folders", () => {
    const folder: WorkspaceFolder = {
      uri: Uri.file("/project"),
      name: "project",
      index: 0,
    };
    const pattern = provider["getRelativePattern"](folder, "**/*.css");
    assert.ok(pattern instanceof RelativePattern);
    assert.strictEqual(pattern.pattern, "**/*.css");
    assert.strictEqual(pattern.baseUri.path, "/project");
  });

  const complete = async (content: string, character: string) => {
    const document = await workspace.openTextDocument({
      language: "html",
      content,
    });
    const offset = content.indexOf(character);
    const items = await provider.provideCompletionItems(
      document,
      document.positionAt(offset),
      token,
      context,
    );
    assert.ok(items && "map" in items);
    return items;
  };

  const vars = "<style>:root { --size-1: .25rem; --size-2: .5rem }</style>\n";

  it("should complete custom properties in style attributes", async () => {
    const items = await complete(vars + "<a style='margin: var(|)'>", "|");
    assert.deepStrictEqual(
      items.map((item) => [item.label, item.kind, item.detail]),
      [
        ["--size-1", CompletionItemKind.Variable, ".25rem"],
        ["--size-2", CompletionItemKind.Variable, ".5rem"],
      ],
    );
  });

  it("should complete custom properties in style blocks", async () => {
    const items = await complete(
      vars + "<style>.a { margin: var(--si|) }</style>",
      "|",
    );
    assert.deepStrictEqual(
      items.map((item) => item.label),
      ["--size-1", "--size-2"],
    );
    const range = items[0].range;
    assert.ok(range && "start" in range);
    assert.strictEqual(range.start.character, 24);
  });

  it("should complete custom properties in fallbacks", async () => {
    const items = await complete(
      vars + "<a style='margin: var(--x, var(-|))'>",
      "|",
    );
    assert.strictEqual(items.length, 2);
  });

  it("should keep the first custom property definition", async () => {
    const items = await complete(
      "<style>:root { --c: white } @media (x) { :root { --c: black } }" +
        "</style>\n<a style='color: var(|)'>",
      "|",
    );
    assert.deepStrictEqual(
      items.map((item) => [item.label, item.detail]),
      [["--c", "white"]],
    );
  });

  it("should not complete custom properties outside of var", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: vars + "<a style='margin: --si'>",
    });
    await assert.rejects(
      Promise.resolve(
        provider.provideCompletionItems(
          document,
          new Position(1, 22),
          token,
          context,
        ),
      ),
    );
  });

  it("should support go to definition for custom properties", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: vars + "<a class='size-1' style='margin: var(--size-1)'>",
    });
    const locations = await provider.provideDefinition(
      document,
      new Position(1, 40),
      token,
    );
    assert.ok(locations && "map" in locations);
    assert.deepStrictEqual(
      locations.map(
        (location) =>
          "range" in location && [
            location.range.start.line,
            location.range.start.character,
          ],
      ),
      [[0, 15]],
    );
  });

  it("should only find definitions of the same type", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>#one{} .one{}</style>\n<a id='one'></a>",
    });
    const locations = await provider.provideDefinition(
      document,
      new Position(1, 8),
      token,
    );
    assert.ok(locations && "map" in locations);
    assert.deepStrictEqual(
      locations.map(
        (location) => "range" in location && location.range.start.character,
      ),
      [8],
    );
  });

  const hover = async (content: string, character = "|") => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: content.replace(character, ""),
    });
    const result = await provider.provideHover(
      document,
      document.positionAt(content.indexOf(character)),
      token,
    );
    if (!result) {
      return undefined;
    }
    return result.contents
      .map((content) => (content as MarkdownString).value)
      .join("\n");
  };

  it("should show custom property values on hover", async () => {
    const value = await hover(
      "<style>.x {} :root { --size-1: .25rem }</style>\n" +
        "<a style='margin: var(--si|ze-1)'>",
    );
    assert.ok(value);
    assert.match(value, /```css\n--size-1: \.25rem;\n```/);
    assert.match(value, /Defined in Untitled-\d+/);
    assert.doesNotMatch(value, /Resolves to/);
  });

  it("should resolve custom properties on hover", async () => {
    const value = await hover(
      "<style>:root { --a: var(--b) 1px; --b: var(--c, var(--d)); --d: red }" +
        "</style>\n<a style='color: var(--|a)'>",
    );
    assert.ok(value);
    assert.match(value, /--a: var\(--b\) 1px;/);
    assert.match(value, /Resolves to `red 1px`/);
  });

  it("should not resolve cyclic custom properties", async () => {
    const value = await hover(
      "<style>:root { --a: var(--b); --b: var(--a) }</style>\n" +
        "<a style='color: var(--|a)'>",
    );
    assert.ok(value);
    assert.doesNotMatch(value, /Resolves to/);
  });

  it("should keep unresolved references on hover", async () => {
    const value = await hover(
      "<style>:root { --a: var(--x) var(--y, 2px) }</style>\n" +
        "<a style='color: var(--|a)'>",
    );
    assert.ok(value);
    assert.match(value, /Resolves to `var\(--x\) 2px`/);
  });

  it("should list every definition on hover", async () => {
    const url = "https://example.com/props.css";
    sinon.stub(settings, "getStyleSheets").value(() => [url]);
    sinon
      .stub(provider, <any>"getRemote")
      .value(async () => parse(":root { --c: white; --w: var(--c) }"));

    const value = await hover(
      "<style>@media (x) { :root { --c: black } }</style>\n" +
        "<a style='color: var(--|c)'>",
    );
    assert.ok(value);
    assert.match(value, /--c: white;\n--c: black;/);
    assert.match(value, /Defined in https:\/\/example\.com\/props\.css,/);

    const resolved = await hover(
      "<style>:root { --c: black }</style>\n<a style='color: var(--|w)'>",
    );
    assert.ok(resolved);
    assert.match(resolved, /Resolves to `white`/);
  });

  it("should not hover outside of var or for unknown properties", async () => {
    assert.strictEqual(
      await hover("<style>:root { --a: 1 }</style>\n<a style='--|a: 2'>"),
      undefined,
    );
    assert.strictEqual(
      await hover("<style>:root { --a: 1 }</style>\n<a style='var(--|b)'>"),
      undefined,
    );
    assert.strictEqual(
      await hover("<style>.a { }</style>\n<a style='var(a|)'>"),
      undefined,
    );
    assert.strictEqual(await hover("<a style='var(|)'>"), undefined);
  });

  it("should not hover when cancelled", async () => {
    token.isCancellationRequested = true;
    assert.strictEqual(
      await hover("<style>:root { --a: 1 }</style>\n<a style='var(--|a)'>"),
      undefined,
    );
  });
});
