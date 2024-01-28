/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import {
  commands,
  ExtensionContext,
  languages,
  window,
  workspace,
} from "vscode";
import {
  AutoValidation,
  getAutoValidation,
  getEnabledLanguages,
} from "./settings";
import { Provider, clear, invalidate } from "./provider";

export function activate(context: ExtensionContext) {
  const enabledLanguages = getEnabledLanguages();
  const validations = languages.createDiagnosticCollection();
  const provider = new Provider();

  context.subscriptions.push(
    languages.registerCompletionItemProvider(enabledLanguages, provider),
    languages.registerDefinitionProvider(enabledLanguages, provider),
    workspace.onDidSaveTextDocument(async (document) => {
      invalidate(document.uri.toString());
      if (enabledLanguages.includes(document.languageId)) {
        const validation = getAutoValidation(document);
        if (validation === AutoValidation.SAVE) {
          validations.set(document.uri, await provider.validate(document));
        }
      }
    }),
    workspace.onDidChangeTextDocument(async (event) => {
      const document = event.document;
      if (enabledLanguages.includes(document.languageId)) {
        const validation = getAutoValidation(document);
        if (validation === AutoValidation.ALWAYS) {
          validations.set(document.uri, await provider.validate(document));
        } else {
          validations.delete(document.uri);
        }
      }
    }),
    workspace.onDidCloseTextDocument((document) => {
      validations.delete(document.uri);
    }),
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
