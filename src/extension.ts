/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import {
  commands,
  ExtensionContext,
  languages,
  TextDocument,
  window,
  workspace,
} from "vscode";
import {
  AutoValidation,
  getAutoValidation,
  getEnabledLanguages,
} from "./settings";
import { Provider, clear, invalidate } from "./provider";

const enabledLanguages = getEnabledLanguages();
const validations = languages.createDiagnosticCollection();
const provider = new Provider();

async function validate(
  document: TextDocument,
  type: AutoValidation | undefined
) {
  if (enabledLanguages.includes(document.languageId)) {
    const validation = getAutoValidation(document);
    if (!type || type === validation) {
      validations.set(document.uri, await provider.validate(document));
    } else if (validation !== AutoValidation.ALWAYS) {
      validations.delete(document.uri);
    }
  }
}

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    languages.registerCompletionItemProvider(enabledLanguages, provider),
    languages.registerDefinitionProvider(enabledLanguages, provider),
    workspace.onDidSaveTextDocument(async (document) => {
      invalidate(document.uri.toString());
      await validate(document, AutoValidation.SAVE);
    }),
    workspace.onDidOpenTextDocument(async (document) => {
      await validate(document, AutoValidation.ALWAYS);
    }),
    workspace.onDidChangeTextDocument(async (event) => {
      if (event.contentChanges.length > 0) {
        await validate(event.document, AutoValidation.ALWAYS);
      }
    }),
    workspace.onDidCloseTextDocument((document) => {
      validations.delete(document.uri);
    }),
    commands.registerCommand(
      "vscode-html-css.validate",
      async (type: AutoValidation | undefined) => {
        const editor = window.activeTextEditor;
        if (editor) {
          await validate(editor.document, type);
        }
      }
    ),
    commands.registerCommand("vscode-html-css.clear", () => clear())
  );

  return commands.executeCommand<void>(
    "vscode-html-css.validate",
    AutoValidation.ALWAYS
  );
}

export function deactivate() {}
