/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import Path from "path";
import { TextDocument, workspace } from "vscode";

export function getEnabledLanguages(): string[] {
  return workspace
    .getConfiguration("css")
    .get<string[]>("enabledLanguages", ["html"]);
}

export function getStyleSheets(scope: TextDocument): string[] {
  const path = Path.parse(scope.fileName);

  return workspace
    .getConfiguration("css", scope)
    .get<string[]>("styleSheets", [])
    .map((glob) =>
      glob.replace(
        /\$\s*{\s*(fileBasenameNoExtension|fileBasename|fileExtname)\s*}/g,
        (match, variable) =>
          variable === "fileBasename"
            ? path.base
            : variable === "fileExtname"
            ? path.ext
            : path.name
      )
    );
}

export const enum AutoValidation {
  NEVER = "Never",
  SAVE = "Save",
  ALWAYS = "Always",
}

export function getAutoValidation(scope: TextDocument): AutoValidation {
  return workspace
    .getConfiguration("css", scope)
    .get<AutoValidation>("autoValidation", AutoValidation.NEVER);
}
