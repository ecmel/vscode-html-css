'use strict';

import * as vsc from 'vscode';
import * as lst from 'vscode-languageserver-types';
import * as css from 'vscode-css-languageservice';

class CompletionItemProviderImpl implements vsc.CompletionItemProvider {

    private service = css.getCSSLanguageService();
    private inlineStyleRegEx = /style=["|']([\w-;: ]*$)/;
    private dummyClass = '.dummy {';

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

    private doComplete(content: string, position: vsc.Position): vsc.CompletionList {
        let document = lst.TextDocument.create('', 'css', 1, content);
        let stylesheet = this.service.parseStylesheet(document);
        let completions = this.service.doComplete(document, position, stylesheet);

        return this.convertCompletionList(completions);
    }

    provideCompletionItems(document: vsc.TextDocument, position: vsc.Position, token: vsc.CancellationToken): vsc.CompletionList {
        let start = new vsc.Position(position.line, 0);
        let range = new vsc.Range(start, position);
        let text = document.getText(range);

        let inlineStyle = this.inlineStyleRegEx.exec(text);
        if (inlineStyle) {
            let content = this.dummyClass + inlineStyle[1];
            return this.doComplete(content, new vsc.Position(0, content.length));
        }
        return null;
    }

    resolveCompletionItem(item: vsc.CompletionItem, token: vsc.CancellationToken): vsc.CompletionItem {
        return null;
    }
}

export function activate(context: vsc.ExtensionContext) {

    let completion = vsc.languages.registerCompletionItemProvider('html', new CompletionItemProviderImpl());

    context.subscriptions.push(completion);
}

export function deactivate() {
}