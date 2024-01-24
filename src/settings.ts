/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import { Uri, workspace } from "vscode";

export function getEnabledLanguages(): string[] {
  return workspace
    .getConfiguration("css")
    .get<string[]>("enabledLanguages", ["html"]);
}

export function getStyleSheets(uri: Uri): string[] {
  return workspace
    .getConfiguration("css", uri)
    .get<string[]>("styleSheets", []);
}

export function getVaildOnSave(): Boolean {
  return workspace
    .getConfiguration("vscode-html-css")
    .get<Boolean>("vaildOnSave", false);
}