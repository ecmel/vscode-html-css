/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
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
  Hover,
  HoverProvider,
  Location,
  LocationLink,
  MarkdownString,
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

// A var() reference, with an optional fallback that may hold one level of
// parentheses, like `var(--a, var(--b))`.
const reference =
  /var\(\s*--([\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*?)\s*)?\)/g;

// Replaces var() references with their values, following chains of custom
// properties. References that cannot be resolved are kept as they are.
function resolve(
  value: string,
  variables: Map<string, string>,
  seen = new Set<string>(),
): string {
  return value.replace(
    reference,
    (match, name: string, fallback: string | undefined) => {
      const found = variables.get(name);
      if (seen.has(name)) {
        return match;
      }
      if (found === undefined) {
        return fallback === undefined
          ? match
          : resolve(fallback, variables, seen);
      }
      return resolve(found, variables, new Set(seen).add(name));
    },
  );
}

export class Provider
  implements CompletionItemProvider, DefinitionProvider, HoverProvider
{
  private get isRemote() {
    return /^https?:\/\//i;
  }

  private get wordRange() {
    return /[_a-zA-Z0-9-]+/;
  }

  private get canComplete() {
    return /(id|class|className|[.#])\s*[=:]?\s*(["'])(?:.(?!\2))*$/is;
  }

  private get canCompleteVariable() {
    return /\bvar\(\s*[\w-]*$/;
  }

  // What to complete or look up for the text before the cursor, if anything.
  private getType(text: string) {
    if (this.canCompleteVariable.test(text)) {
      return StyleType.VARIABLE;
    }
    const match = this.canComplete.exec(text);
    if (match) {
      return match[1] === "id" ? StyleType.ID : StyleType.CLASS;
    }
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
    return new RelativePattern(folder, glob);
  }

  private async getStyles(document: TextDocument) {
    const styles = new Map<string, Style[]>();
    const folder = workspace.getWorkspaceFolder(document.uri);
    const globs = getStyleSheets(document);

    for (const glob of globs) {
      if (this.isRemote.test(glob)) {
        styles.set(glob, await this.getRemote(glob));
      } else if (folder) {
        const files = await workspace.findFiles(
          this.getRelativePattern(folder, glob),
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
        if (style.type !== type) {
          continue;
        }
        if (type === StyleType.VARIABLE) {
          // Keep the first definition, overrides like dark mode come later.
          if (!map.has(style.selector)) {
            const item = new CompletionItem(
              StyleType.VARIABLE + style.selector,
              CompletionItemKind.Variable,
            );
            item.detail = style.value;
            map.set(style.selector, item);
          }
        } else {
          const item = new CompletionItem(
            style.selector,
            type === StyleType.ID
              ? CompletionItemKind.Value
              : CompletionItemKind.Enum,
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
    type: StyleType,
  ) {
    const range = document.getWordRangeAtPosition(position, this.wordRange);
    const map = await this.getCompletionMap(document, type);
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
    context: CompletionContext,
  ): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
    const range = new Range(start, position);
    const type = this.getType(document.getText(range));

    return new Promise((resolve, reject) =>
      type && !token.isCancellationRequested
        ? resolve(this.getCompletionItems(document, position, type))
        : reject(),
    );
  }

  private async getDefinitions(
    document: TextDocument,
    position: Position,
    type: StyleType,
  ) {
    const range = document.getWordRangeAtPosition(position, this.wordRange);
    const styles = await this.getStyles(document);
    const word = document.getText(range);
    const selector =
      type === StyleType.VARIABLE ? word.replace(/^--/, "") : word;
    const locations: Location[] = [];

    for (const entry of styles) {
      if (!this.isRemote.test(entry[0])) {
        entry[1]
          .filter((style) => style.type === type && style.selector === selector)
          .forEach((style) =>
            locations.push(
              new Location(
                Uri.parse(entry[0]),
                new Position(style.line, style.col),
              ),
            ),
          );
      }
    }
    return locations;
  }

  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
  ): ProviderResult<Definition | LocationLink[]> {
    const range = new Range(start, position);
    const type = this.getType(document.getText(range));

    return new Promise((resolve, reject) =>
      type && !token.isCancellationRequested
        ? resolve(this.getDefinitions(document, position, type))
        : reject(),
    );
  }

  private async getHover(document: TextDocument, range: Range) {
    const name = document.getText(range).replace(/^--/, "");
    const styles = await this.getStyles(document);
    const variables = new Map<string, string>();
    const declarations = new Set<string>();
    const sources = new Set<string>();

    for (const [source, values] of styles) {
      for (const style of values) {
        if (style.type !== StyleType.VARIABLE) {
          continue;
        }
        // Keep the first definition, as completion does.
        if (!variables.has(style.selector)) {
          // The parser always sets a value for custom properties.
          variables.set(style.selector, style.value!);
        }
        if (style.selector === name) {
          declarations.add(`--${name}: ${style.value};`);
          sources.add(
            this.isRemote.test(source)
              ? source
              : workspace.asRelativePath(Uri.parse(source)),
          );
        }
      }
    }

    if (declarations.size === 0) {
      return undefined;
    }

    const value = variables.get(name)!;
    const resolved = resolve(value, variables);
    const markdown = new MarkdownString();

    markdown.appendCodeblock([...declarations].join("\n"), "css");
    if (resolved !== value) {
      // CSS values cannot contain backticks outside of strings, so this
      // only guards against breaking out of the inline code span.
      markdown.appendMarkdown(
        `Resolves to \`${resolved.replace(/`/g, "")}\`\n\n`,
      );
    }
    markdown.appendMarkdown("Defined in ");
    markdown.appendText([...sources].join(", "));

    return new Hover(markdown, range);
  }

  provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
  ): ProviderResult<Hover> {
    const range = document.getWordRangeAtPosition(position, this.wordRange);
    if (!range || token.isCancellationRequested) {
      return undefined;
    }
    const type = this.getType(document.getText(new Range(start, range.end)));
    return type === StyleType.VARIABLE &&
      document.getText(range).startsWith("--")
      ? this.getHover(document, range)
      : undefined;
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
              DiagnosticSeverity.Warning,
            ),
          );
        }
      }
    }
    return diagnostics;
  }
}

export function clear() {
  window.showInformationMessage(`Style sheets cache cleared: ${cache.size}`);
  cache.clear();
}

export function invalidate(name: string) {
  cache.delete(name);
}
