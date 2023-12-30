/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

import { ExtensionContext, commands, languages, workspace } from "vscode";
import { getEnabledLanguages } from "./settings";
import { Completer, clear, invalidate } from "./completer";

export function activate(context: ExtensionContext) {
  const enabledLanguages = getEnabledLanguages();
  const completer = new Completer();

  context.subscriptions.push(
    languages.registerCompletionItemProvider(enabledLanguages, completer),
    workspace.onDidChangeTextDocument((event) =>
      invalidate(event.document.uri.toString())
    ),
    commands.registerCommand("vscode-html-css.clear", () => clear()),
    commands.registerCommand("vscode-html-css.validate", async () => {})
  );
}

export function deactivate() {}
