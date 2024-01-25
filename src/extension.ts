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
import { getEnabledLanguages, getVaildOnSaveOrChange, VaildOnSaveOrChange } from "./settings";
import { Provider, clear, invalidate } from "./provider";

export function activate(context: ExtensionContext) {
  const enabledLanguages = getEnabledLanguages();
  const validations = languages.createDiagnosticCollection();
  const provider = new Provider();

  context.subscriptions.push(
    languages.registerCompletionItemProvider(enabledLanguages, provider),
    languages.registerDefinitionProvider(enabledLanguages, provider),
    workspace.onDidSaveTextDocument((document) => {
      const vaildOnSaveOrChange = getVaildOnSaveOrChange();
      if (vaildOnSaveOrChange == VaildOnSaveOrChange.Always || vaildOnSaveOrChange == VaildOnSaveOrChange.OnSave) {
        commands.executeCommand("vscode-html-css.validate")
      } else {
        invalidate(document.uri.toString())
      }
    }),
    workspace.onDidCloseTextDocument((document) =>
      validations.delete(document.uri)
    ),
    workspace.onDidChangeTextDocument((event) => {
      const vaildOnSaveOrChange = getVaildOnSaveOrChange();
      if (vaildOnSaveOrChange == VaildOnSaveOrChange.Always || vaildOnSaveOrChange == VaildOnSaveOrChange.OnChange) {
        commands.executeCommand("vscode-html-css.validate")
      } else {
        validations.delete(event.document.uri)
      }
    }
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

export function deactivate() { }
