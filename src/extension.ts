'use strict';

import * as vsc from 'vscode';
import * as lst from 'vscode-languageserver-types';
import * as css from 'vscode-css-languageservice';

let service = css.getCSSLanguageService();

class Snippet {

  private _document: lst.TextDocument;
  private _stylesheet: css.Stylesheet;
  private _position: lst.Position;

  constructor(content: string, character?: number) {
    this._document = lst.TextDocument.create('', 'css', 1, content);
    this._stylesheet = service.parseStylesheet(this._document);
    this._position = new vsc.Position(this._document.lineCount - 1, character ? character : 0);
  }

  public get document(): lst.TextDocument {
    return this._document;
  }

  public get stylesheet(): css.Stylesheet {
    return this._stylesheet;
  }

  public get position(): lst.Position {
    return this._position;
  }
}

class StyleServer implements vsc.CompletionItemProvider, vsc.HoverProvider {

  private regex = [/style=["|']([^"^']*$)/, /<style>([^<]*$)/];

  private convertCompletionList(list: lst.CompletionList): vsc.CompletionList {
    let ci: vsc.CompletionItem[] = [];
    for (let i = 0; i < list.items.length; i++) {
      ci[i] = new vsc.CompletionItem(list.items[i].label);
      ci[i].detail = list.items[i].detail;
      ci[i].documentation = list.items[i].documentation;
      ci[i].filterText = list.items[i].filterText;
      ci[i].insertText = list.items[i].insertText;
      ci[i].kind = list.items[i].kind;
      ci[i].sortText = list.items[i].sortText;
    }
    return new vsc.CompletionList(ci, list.isIncomplete);
  }

  private createSnippet(document: vsc.TextDocument, position: vsc.Position): Snippet {
    let start = new vsc.Position(0, 0);
    let range = new vsc.Range(start, position);
    let text = document.getText(range);

    let tag = this.regex[0].exec(text);
    if (tag) {
      return new Snippet('.c {\n' + tag[1], position.character);
    }

    tag = this.regex[1].exec(text);
    if (tag) {
      return new Snippet(tag[1], position.character);
    }

    return null;
  }

  provideCompletionItems(document: vsc.TextDocument, position: vsc.Position, token: vsc.CancellationToken): vsc.CompletionList {
    let snippet = this.createSnippet(document, position);

    if (snippet) {
      let result = service.doComplete(snippet.document, snippet.position, snippet.stylesheet);
      return this.convertCompletionList(result);
    }
    return null;
  }

  resolveCompletionItem(item: vsc.CompletionItem, token: vsc.CancellationToken): vsc.CompletionItem {
    return null;
  }

  provideHover(document: vsc.TextDocument, position: vsc.Position, token: vsc.CancellationToken): vsc.Hover {
    let snippet = this.createSnippet(document, position);

    if (snippet) {
      let result = service.doHover(snippet.document, snippet.position, snippet.stylesheet);
      return new vsc.Hover(result.contents);
    }
    return null;
  }
}

class ClassServer implements vsc.CompletionItemProvider {

  private regex = [/class=["|']([^"^']*$)/, /<style>([\s\S]*)<\/style>/];

  provideCompletionItems(document: vsc.TextDocument, position: vsc.Position, token: vsc.CancellationToken): vsc.CompletionList {
    let start = new vsc.Position(0, 0);
    let range = new vsc.Range(start, position);
    let text = document.getText(range);

    let tag = this.regex[0].exec(text);
    if (tag) {
      let style = this.regex[1].exec(document.getText());
      if (style) {
        let snippet = new Snippet(style[1]);
        let symbols = service.findDocumentSymbols(snippet.document, snippet.stylesheet);
        let ci: vsc.CompletionItem[] = [];
        for (let i = 0; i < symbols.length; i++) {
          if (symbols[i].kind !== 5) {
            continue;
          }
          let c = symbols[i].name.split(/\s/);
          for (let j = 0; j < c.length; j++) {
            if (c[j].startsWith('.')) {
              ci.push(new vsc.CompletionItem(c[j].substr(1)));
            }
          }
        }
        return new vsc.CompletionList(ci);
      }
    }
    return null;
  }

  resolveCompletionItem(item: vsc.CompletionItem, token: vsc.CancellationToken): vsc.CompletionItem {
    return null;
  }
}

function parse(uri: vsc.Uri) {
  console.log(uri.fsPath);
}

export function activate(context: vsc.ExtensionContext) {

  if (vsc.workspace.rootPath) {
    let fsw = vsc.workspace.createFileSystemWatcher("**/*.css");
    fsw.onDidCreate(parse);
    fsw.onDidChange(parse);
    fsw.onDidDelete(parse);
    context.subscriptions.push(fsw);

    vsc.workspace.findFiles("**/*.css", "").then(function (uris: vsc.Uri[]) {
      for (let i = 0; i < uris.length; i++) {
        parse(uris[i]);
      }
    });
  }

  let styleServer = new StyleServer();

  context.subscriptions.push(vsc.languages.registerCompletionItemProvider('html', styleServer));
  context.subscriptions.push(vsc.languages.registerHoverProvider('html', styleServer));

  let classServer = new ClassServer();

  context.subscriptions.push(vsc.languages.registerCompletionItemProvider('html', classServer));
}

export function deactivate() {
}
