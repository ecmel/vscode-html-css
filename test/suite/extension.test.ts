/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import sinon from "sinon";
import { afterEach, before, describe, it } from "mocha";
import {
  CompletionList,
  ConfigurationTarget,
  Hover,
  MarkdownString,
  Position,
  TextDocument,
  Uri,
  WorkspaceEdit,
  commands,
  extensions,
  languages,
  window,
  workspace,
} from "vscode";

const content = "<style>.one{}</style>\n<a class='one two'></a>";

async function setAutoValidation(value: string | undefined) {
  await workspace
    .getConfiguration("css")
    .update("autoValidation", value, ConfigurationTarget.Global);
}

async function waitFor(predicate: () => boolean, timeout = 5000) {
  const end = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > end) {
      throw new Error("Timed out waiting for condition.");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// Only count diagnostics from this extension: the built-in CSS linter also
// reports on the <style> block asynchronously.
function diagnostics(document: TextDocument) {
  return languages
    .getDiagnostics(document.uri)
    .filter((diagnostic) => diagnostic.message.startsWith("CSS selector"));
}

async function append(document: TextDocument, text: string) {
  const edit = new WorkspaceEdit();
  edit.insert(
    document.uri,
    document.positionAt(document.getText().length),
    text,
  );
  await workspace.applyEdit(edit);
}

async function closeAllEditors() {
  for (let i = 0; i < 20 && window.visibleTextEditors.length > 0; i++) {
    await commands.executeCommand(
      "workbench.action.revertAndCloseActiveEditor",
    );
  }
  await commands.executeCommand("workbench.action.closeAllEditors");
}

function tempFile(text: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vscode-html-css-"));
  const file = path.join(dir, "page.html");
  fs.writeFileSync(file, text);
  return Uri.file(file);
}

describe("extension", () => {
  before(async () => {
    await extensions.getExtension("ecmel.vscode-html-css")?.activate();
  });

  afterEach(async () => {
    sinon.restore();
    await setAutoValidation(undefined);
    await closeAllEditors();
  });

  it("should complete id and class attributes", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content: "<style>#main,.red{}</style>\n<a id='mai' class='re'></a>",
    });

    let list = await commands.executeCommand<CompletionList>(
      "vscode.executeCompletionItemProvider",
      document.uri,
      new Position(1, 10),
    );

    assert.ok(list.items.find((item) => item.label === "main"));

    list = await commands.executeCommand<CompletionList>(
      "vscode.executeCompletionItemProvider",
      document.uri,
      new Position(1, 21),
    );

    assert.ok(list.items.find((item) => item.label === "red"));
  });

  it("should complete custom properties", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content:
        "<style>:root { --size-1: .25rem }</style>\n<a style='margin: var(--'>",
    });

    const list = await commands.executeCommand<CompletionList>(
      "vscode.executeCompletionItemProvider",
      document.uri,
      new Position(1, 24),
      "-",
    );

    const item = list.items.find((item) => item.label === "--size-1");
    assert.ok(item);
    assert.strictEqual(item.detail, ".25rem");
  });

  it("should show custom properties on hover", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content:
        "<style>:root { --a: var(--b); --b: 1rem }</style>\n<a style='margin: var(--a)'>",
    });

    const hovers = await commands.executeCommand<Hover[]>(
      "vscode.executeHoverProvider",
      document.uri,
      new Position(1, 24),
    );

    const value = hovers
      .flatMap((hover) => hover.contents)
      .map((content) => (content as MarkdownString).value)
      .join("\n");
    assert.match(value, /--a: var\(--b\);/);
    assert.match(value, /Resolves to `1rem`/);
  });

  it("should validate the active editor on command", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content,
    });
    await window.showTextDocument(document);
    assert.strictEqual(diagnostics(document).length, 0);

    await commands.executeCommand("vscode-html-css.validate");

    const result = diagnostics(document);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].message, "CSS selector 'two' not found.");
  });

  it("should not validate documents in other languages", async () => {
    const document = await workspace.openTextDocument({
      language: "plaintext",
      content,
    });
    await window.showTextDocument(document);
    await commands.executeCommand("vscode-html-css.validate");
    assert.strictEqual(diagnostics(document).length, 0);
  });

  it("should do nothing on command without an active editor", async () => {
    await closeAllEditors();
    await commands.executeCommand("vscode-html-css.validate");
  });

  it("should validate on open and change when set to always", async () => {
    await setAutoValidation("Always");

    const document = await workspace.openTextDocument({
      language: "html",
      content,
    });
    await waitFor(() => diagnostics(document).length === 1);

    await append(document, "<b class='three'></b>");
    await waitFor(() => diagnostics(document).length === 2);
  });

  it("should validate on save when set to save", async () => {
    await setAutoValidation("Save");

    const document = await workspace.openTextDocument(tempFile(content));
    await window.showTextDocument(document);
    assert.strictEqual(diagnostics(document).length, 0);

    await append(document, "\n");
    assert.strictEqual(diagnostics(document).length, 0);

    await document.save();
    await waitFor(() => diagnostics(document).length === 1);
  });

  it("should clear diagnostics on change unless set to always", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content,
    });
    await window.showTextDocument(document);
    await commands.executeCommand("vscode-html-css.validate");
    assert.strictEqual(diagnostics(document).length, 1);

    await append(document, "\n");
    await waitFor(() => diagnostics(document).length === 0);
  });

  it("should clear diagnostics when a document is closed", async () => {
    const document = await workspace.openTextDocument({
      language: "html",
      content,
    });
    await window.showTextDocument(document);
    await commands.executeCommand("vscode-html-css.validate");
    assert.strictEqual(diagnostics(document).length, 1);

    // Changing the language closes the document and reopens it.
    await languages.setTextDocumentLanguage(document, "plaintext");
    await waitFor(() => diagnostics(document).length === 0);
  });

  it("should clear the style sheets cache on command", async () => {
    const shown = sinon.stub(window, "showInformationMessage");
    await commands.executeCommand("vscode-html-css.clear");
    assert.ok(shown.calledOnce);
    assert.match(String(shown.firstCall.args[0]), /cache cleared/);
  });
});
