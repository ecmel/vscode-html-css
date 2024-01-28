/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import { ConfigurationScope, workspace } from "vscode";

export function getEnabledLanguages(): string[] {
  return workspace
    .getConfiguration("css")
    .get<string[]>("enabledLanguages", ["html"]);
}

export function getStyleSheets(scope: ConfigurationScope): string[] {
  return workspace
    .getConfiguration("css", scope)
    .get<string[]>("styleSheets", []);
}

export const enum AutoValidation {
  NEVER = "Never",
  SAVE = "Save",
  ALWAYS = "Always",
}

export function getAutoValidation(scope: ConfigurationScope): AutoValidation {
  return workspace
    .getConfiguration("css", scope)
    .get<AutoValidation>("autoValidation", AutoValidation.NEVER);
}
