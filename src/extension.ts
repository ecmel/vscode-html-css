/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

import {
  commands,
  ExtensionContext,
  languages,
  window,
  workspace,
} from "vscode";
import { getEnabledLanguages } from "./settings";
import { Provider, clear, invalidate } from "./provider";

export function activate(context: ExtensionContext) {
  const enabledLanguages = getEnabledLanguages();
  const validations = languages.createDiagnosticCollection();
  const provider = new Provider();

  context.subscriptions.push(
    languages.registerCompletionItemProvider(enabledLanguages, provider),
    languages.registerDefinitionProvider(enabledLanguages, provider),
    workspace.onDidChangeTextDocument((event) => {
      const uri = event.document.uri;
      invalidate(uri.toString());
      validations.delete(uri);
    }),
    workspace.onDidCloseTextDocument((document) =>
      validations.delete(document.uri)
    ),
    commands.registerCommand("vscode-html-css.validate", async () => {
      const editor = window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        if (enabledLanguages.includes(document.languageId)) {
          validations.set(document.uri, await provider.validate(document));
        }
      }
    }),
    commands.registerCommand("vscode-html-css.clear", () => clear())
  );
}

export function deactivate() {}
