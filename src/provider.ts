/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

import {
  CancellationToken,
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  CompletionList,
  Definition,
  DefinitionProvider,
  Diagnostic,
  DiagnosticSeverity,
  Location,
  LocationLink,
  Position,
  ProviderResult,
  Range,
  RelativePattern,
  TextDocument,
  Uri,
  window,
  workspace,
  WorkspaceFolder,
} from "vscode";
import { getStyleSheets } from "./settings";
import { Style, StyleType, parse } from "./parser";

const start = new Position(0, 0);
const cache = new Map<string, Style[]>();

export class Provider implements CompletionItemProvider, DefinitionProvider {
  private get isRemote() {
    return /^https?:\/\//i;
  }

  private get wordRange() {
    return /[_a-zA-Z0-9-]+/;
  }

  private get canComplete() {
    return /(id|class|className)\s*[=:]\s*(["'])(?:.(?!\2))*$/is;
  }

  private async fetch(url: string) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return res.text();
      }
      throw new Error(res.statusText);
    } catch (error) {
      window.showErrorMessage(`Fetching ${url} failed. ${error}`);
    }
    return "";
  }

  private async getRemote(name: string) {
    let styles = cache.get(name);
    if (!styles) {
      const content = await this.fetch(name);
      styles = parse(content);
      cache.set(name, styles);
    }
    return styles;
  }

  private async getLocal(uri: Uri) {
    const name = uri.toString();
    let styles = cache.get(name);
    if (!styles) {
      const content = await workspace.fs.readFile(uri);
      styles = parse(content.toString());
      cache.set(name, styles);
    }
    return styles;
  }

  private getRelativePattern(folder: WorkspaceFolder, glob: string) {
    return new RelativePattern(folder, glob).pattern;
  }

  private async getStyles(document: TextDocument) {
    const styles = new Map<string, Style[]>();
    const folder = workspace.getWorkspaceFolder(document.uri);
    const globs = getStyleSheets(document.uri);

    for (const glob of globs) {
      if (this.isRemote.test(glob)) {
        styles.set(glob, await this.getRemote(glob));
      } else if (folder) {
        const files = await workspace.findFiles(
          this.getRelativePattern(folder, glob)
        );
        for (const file of files) {
          styles.set(file.toString(), await this.getLocal(file));
        }
      }
    }
    styles.set(document.uri.toString(), parse(document.getText()));
    return styles;
  }

  private async getCompletionMap(document: TextDocument, type: StyleType) {
    const map = new Map<string, CompletionItem>();
    const styles = await this.getStyles(document);

    for (const value of styles.values()) {
      for (const style of value) {
        if (style.type === type) {
          const item = new CompletionItem(
            style.selector,
            style.type === StyleType.ID
              ? CompletionItemKind.Value
              : CompletionItemKind.Enum
          );
          map.set(style.selector, item);
        }
      }
    }
    return map;
  }

  private async getCompletionItems(
    document: TextDocument,
    position: Position,
    type: StyleType
  ) {
    const map = await this.getCompletionMap(document, type);
    const range = document.getWordRangeAtPosition(position, this.wordRange);
    const items = [];

    for (const item of map.values()) {
      item.range = range;
      items.push(item);
    }
    return items;
  }

  provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext
  ): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
    const range = new Range(start, position);
    const text = document.getText(range);
    const match = this.canComplete.exec(text);

    return new Promise((resolve, reject) =>
      match && !token.isCancellationRequested
        ? resolve(
            this.getCompletionItems(
              document,
              position,
              match[1] === "id" ? StyleType.ID : StyleType.CLASS
            )
          )
        : reject()
    );
  }

  private async getDefinitions(document: TextDocument, position: Position) {
    const styles = await this.getStyles(document);
    const range = document.getWordRangeAtPosition(position, this.wordRange);
    const selector = document.getText(range);
    const locations: Location[] = [];

    for (const entry of styles) {
      if (!this.isRemote.test(entry[0])) {
        entry[1]
          .filter((style) => style.selector === selector)
          .forEach((style) =>
            locations.push(
              new Location(
                Uri.parse(entry[0]),
                new Position(style.line, style.col)
              )
            )
          );
      }
    }
    return locations;
  }

  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Definition | LocationLink[]> {
    const range = new Range(start, position);
    const text = document.getText(range);
    const match = this.canComplete.exec(text);

    return new Promise((resolve, reject) =>
      match && !token.isCancellationRequested
        ? resolve(this.getDefinitions(document, position))
        : reject()
    );
  }

  async validate(document: TextDocument) {
    const findSelector = /([^(\[{}\])\s]+)(?![^(\[{]*[}\])])/gi;
    const findAttribute = /(class|className)\s*[=:]\s*(["'])(.*?)\2/gis;
    const diagnostics: Diagnostic[] = [];
    const map = await this.getCompletionMap(document, StyleType.CLASS);
    const text = document.getText();

    let attribute, offset, value, anchor, end, start;

    while ((attribute = findAttribute.exec(text))) {
      offset =
        findAttribute.lastIndex -
        attribute[3].length +
        attribute[3].indexOf(attribute[2]);

      while ((value = findSelector.exec(attribute[3]))) {
        if (!map.has(value[1])) {
          anchor = findSelector.lastIndex + offset;
          end = document.positionAt(anchor);
          start = document.positionAt(anchor - value[1].length);

          diagnostics.push(
            new Diagnostic(
              new Range(start, end),
              `CSS selector '${value[1]}' not found.`,
              DiagnosticSeverity.Warning
            )
          );
        }
      }
    }
    return diagnostics;
  }
}

export function clear() {
  cache.clear();
}

export function invalidate(name: string) {
  cache.delete(name);
}
