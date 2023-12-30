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
  Diagnostic,
  DiagnosticSeverity,
  Position,
  ProviderResult,
  Range,
  RelativePattern,
  TextDocument,
  Uri,
  window,
  workspace,
} from "vscode";
import { getStyleSheets } from "./settings";
import { Style, StyleType, parse } from "./parser";

const start = new Position(0, 0);
const cache = new Map<string, Style[]>();
const isRemote = /^https?:\/\//i;
const findSelector = /([^(\[{}\])\s]+)(?![^(\[{]*[}\])])/gi;
const findAttribute = /(class|className)\s*[=:]\s*(["'])(.*?)\2/gis;
const canComplete = /(id|class|className)\s*[=:]\s*(["'])(?:.(?!\2))*$/is;

export class Completer implements CompletionItemProvider {
  private async fetch(url: string) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return await res.text();
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

  private async getStyles(document: TextDocument) {
    const styles = new Map<string, Style[]>();
    const folder = workspace.getWorkspaceFolder(document.uri);

    if (folder) {
      const sheets = getStyleSheets(document.uri);
      for (const sheet of sheets) {
        if (isRemote.test(sheet)) {
          styles.set(sheet, await this.getRemote(sheet));
        } else {
          const files = await workspace.findFiles(
            new RelativePattern(folder, sheet).pattern
          );
          for (const file of files) {
            styles.set(file.toString(), await this.getLocal(file));
          }
        }
      }
    }
    styles.set(document.uri.toString(), parse(document.getText()));

    return styles;
  }

  private async getCompletionMap(document: TextDocument, type: StyleType) {
    const items = new Map<string, CompletionItem>();
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
          items.set(style.selector, item);
        }
      }
    }
    return items;
  }

  private async getCompletionItems(document: TextDocument, type: StyleType) {
    const items = await this.getCompletionMap(document, type);
    return [...items.values()];
  }

  provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext
  ): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
    const range = new Range(start, position);
    const text = document.getText(range);
    const match = canComplete.exec(text);

    return new Promise((resolve, reject) => {
      if (match && !token.isCancellationRequested) {
        resolve(
          this.getCompletionItems(
            document,
            match[1] === "id" ? StyleType.ID : StyleType.CLASS
          )
        );
      } else {
        reject();
      }
    });
  }

  async validate(document: TextDocument) {
    const text = document.getText();
    const diagnostics: Diagnostic[] = [];
    const styles = await this.getCompletionMap(document, StyleType.CLASS);

    let attribute, offset, value, anchor, end, start;

    while ((attribute = findAttribute.exec(text))) {
      offset =
        findAttribute.lastIndex -
        attribute[3].length +
        attribute[3].indexOf(attribute[2]);

      while ((value = findSelector.exec(attribute[3]))) {
        if (styles.has(value[1])) {
          continue;
        }

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

    return diagnostics;
  }
}

export function clear() {
  cache.clear();
}

export function invalidate(name: string) {
  cache.delete(name);
}
