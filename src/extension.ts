'use strict';

import * as vsc from 'vscode';
import * as lst from 'vscode-languageserver-types';
import * as css from 'vscode-css-languageservice';

let service = css.getCSSLanguageService();
let styleRegEx = /<style>([^<]*$)/;
let inlineRegEx = /style=["|']([^"^']*$)/;
let dummyClass = '.dummy {\n';

class Snippet {

    private _document: lst.TextDocument;
    private _stylesheet: css.Stylesheet;
    private _position: lst.Position;

    constructor(document: vsc.TextDocument, position: vsc.Position) {
        let start = new vsc.Position(0, 0);
        let range = new vsc.Range(start, position);
        let text = document.getText(range);
        let tag;

        tag = inlineRegEx.exec(text);
        if (tag) {
            this.init(dummyClass + tag[1], position.character);
            return;
        }

        tag = styleRegEx.exec(text);
        if (tag) {
            this.init(tag[1], position.character);
            return;
        }
    }

    private init(content: string, character: number): void {
        this._document = lst.TextDocument.create('', 'css', 1, content);
        this._stylesheet = service.parseStylesheet(this._document);
        this._position = new vsc.Position(this._document.lineCount - 1, character);
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

class LanguageServer implements vsc.CompletionItemProvider, vsc.HoverProvider {

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

    provideCompletionItems(document: vsc.TextDocument, position: vsc.Position, token: vsc.CancellationToken): vsc.CompletionList {
        let snippet = new Snippet(document, position);

        if (snippet.document) {
            let result = service.doComplete(snippet.document, snippet.position, snippet.stylesheet);
            return this.convertCompletionList(result);
        }
        return null;
    }

    resolveCompletionItem(item: vsc.CompletionItem, token: vsc.CancellationToken): vsc.CompletionItem {
        return null;
    }

    provideHover(document: vsc.TextDocument, position: vsc.Position, token: vsc.CancellationToken): vsc.Hover {
        let snippet = new Snippet(document, position);

        if (snippet.document) {
            let result = service.doHover(snippet.document, snippet.position, snippet.stylesheet);
            return new vsc.Hover(result.contents);
        }
        return null;
    }
}

export function activate(context: vsc.ExtensionContext) {

    let server = new LanguageServer();

    context.subscriptions.push(vsc.languages.registerCompletionItemProvider('html', server));
    context.subscriptions.push(vsc.languages.registerHoverProvider('html', server));
}

export function deactivate() {
}
