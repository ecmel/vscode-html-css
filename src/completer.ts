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
  Position,
  ProviderResult,
  Range,
  RelativePattern,
  TextDocument,
  Uri,
  window,
  workspace,
} from "vscode";
import { Style, StyleType, parse } from "./parser";
import { getStyleSheets } from "./settings";

const start = new Position(0, 0);
const isRemote = /^https?:\/\//i;
const canComplete = /(id|class|className)\s*[=:]\s*(["'])(?:.(?!\2))*$/is;
const cache = new Map<string, Style[]>();

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

  private createCompletionItem(style: Style) {
    return new CompletionItem(
      style.label,
      style.type === StyleType.ID
        ? CompletionItemKind.Value
        : CompletionItemKind.Enum
    );
  }

  private populate(
    styles: Style[],
    type: StyleType,
    items: Map<string, CompletionItem>
  ) {
    styles
      .filter((style) => style.type === type)
      .forEach((style) =>
        items.set(style.label, this.createCompletionItem(style))
      );
  }

  private async getCompletionItems(document: TextDocument, type: StyleType) {
    const items = new Map<string, CompletionItem>();
    const folder = workspace.getWorkspaceFolder(document.uri);

    if (folder) {
      const styleSheets = getStyleSheets(document.uri);
      const globs: string[] = [];
      for (const name of styleSheets) {
        if (isRemote.test(name)) {
          const styles = await this.getRemote(name);
          this.populate(styles, type, items);
        } else {
          globs.push(name);
        }
      }
      const relative = new RelativePattern(folder, `{${globs.join(",")}}`);
      const names = await workspace.findFiles(relative.pattern);
      for (const name of names) {
        const styles = await this.getLocal(name);
        this.populate(styles, type, items);
      }
    }
    this.populate(parse(document.getText()), type, items);

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
}

export function invalidate(name: string) {
  cache.delete(name);
}

export function clear() {
  cache.clear();
}
