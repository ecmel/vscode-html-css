import fetch from "node-fetch";
import { parse, walk } from "css-tree";
import {
    languages,
    Range,
    workspace,
    ExtensionContext,
    CompletionItemProvider,
    TextDocument,
    Position,
    CancellationToken,
    CompletionContext,
    ProviderResult,
    CompletionItem,
    CompletionList,
    CompletionItemKind,
    Uri
} from "vscode";

export const NONE = "__!NONE!__";

export class ClassCompletionItemProvider implements CompletionItemProvider {

    readonly start = new Position(0, 0);
    readonly cache = new Map<string, Map<string, CompletionItem>>();
    readonly isRemote = /^https?:\/\//i;
    readonly canComplete = /class\s*=\s*(["'])(?:(?!\1).)*$/si;
    readonly findLinkRel = /rel\s*=\s*(["'])((?:(?!\1).)+)\1/si;
    readonly findLinkHref = /href\s*=\s*(["'])((?:(?!\1).)+)\1/si;

    parseTextToItems(text: string, items: Map<string, CompletionItem>) {
        walk(parse(text), node => {
            if (node.type === "ClassSelector") {
                items.set(node.name, new CompletionItem(node.name, CompletionItemKind.EnumMember));
            }
        });
    }

    fetchRemote(key: string): Thenable<string> {
        return new Promise(resolve => {
            const items = new Map<string, CompletionItem>();

            fetch(key).then(res => {
                if (res.ok) {
                    res.text().then(text => {
                        this.parseTextToItems(text, items);
                        this.cache.set(key, items);
                        resolve(key);
                    }, () => resolve(NONE));
                } else {
                    this.cache.set(key, items);
                    resolve(key);
                }
            }, () => resolve(NONE));
        });
    }

    fetchStyleSheet(key: string): Thenable<string> {
        return new Promise(resolve => {
            if (key === NONE) {
                resolve(NONE);
            } else {
                if (this.cache.get(key)) {
                    resolve(key);
                } else if (this.isRemote.test(key)) {
                    this.fetchRemote(key).then(key => resolve(key));
                } else {
                    resolve(NONE);
                }
            }
        });
    }

    findDocumentLinks(text: string): Thenable<Set<string>> {
        return new Promise(resolve => {
            const findLinks = /<link([^>]+)>/gi;
            const keys = new Set<string>();
            const promises = [];

            let link;

            while ((link = findLinks.exec(text)) !== null) {
                const rel = this.findLinkRel.exec(link[1]);

                if (rel && rel[2] === "stylesheet") {
                    const href = this.findLinkHref.exec(link[1]);

                    if (href) {
                        promises.push(this.fetchStyleSheet(href[2]).then(k => keys.add(k)));
                    }
                }
            }

            Promise.all(promises).then(() => resolve(keys));
        });
    }

    findRemoteStyles(uri: Uri): Thenable<Set<string>> {
        return new Promise(resolve => {
            const keys = new Set<string>();
            const config = workspace.getConfiguration("css", uri);
            const remoteStyleSheets = config.get<string[]>("remoteStyleSheets", []);

            if (remoteStyleSheets.length === 0) {
                resolve(keys);
            } else {
                const promises = [];

                for (const href of remoteStyleSheets) {
                    promises.push(this.fetchStyleSheet(href).then(k => keys.add(k)));
                }

                Promise.all(promises).then(() => resolve(keys));
            }
        });
    }

    findDocumentStyles(text: string): Map<string, CompletionItem> {
        const items = new Map<string, CompletionItem>();
        const findStyles = /<style[^>]*>([^<]+)<\/style>/gi;

        let style;

        while ((style = findStyles.exec(text)) !== null) {
            this.parseTextToItems(style[1], items);
        }

        return items;
    }

    buildItems(items: Map<string, CompletionItem>, ...sets: Set<string>[]): CompletionItem[] {
        const keys = new Set<string>();

        sets.forEach(v => v.forEach(v => keys.add(v)));
        keys.forEach(k => this.cache.get(k)?.forEach((v, k) => items.set(k, v)));

        return [...items.values()];
    }

    provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {

        return new Promise((resolve, reject) => {
            if (token.isCancellationRequested) {
                reject();
            } else {
                const range = new Range(this.start, position);
                const text = document.getText(range);
                const canComplete = this.canComplete.test(text);

                if (canComplete) {
                    const items = this.findDocumentStyles(text);

                    this.findRemoteStyles(document.uri).then(styles =>
                        this.findDocumentLinks(text).then(links =>
                            resolve(this.buildItems(items, styles, links))));
                } else {
                    reject();
                }
            }
        });
    }
}

export function activate(context: ExtensionContext) {
    context.subscriptions.push(languages
        .registerCompletionItemProvider("html",
            new ClassCompletionItemProvider(), "\"", "'"));
}

export function deactivate() { }
