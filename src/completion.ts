import fetch from "node-fetch";
import { parse, walk } from "css-tree";
import { basename, dirname, extname, isAbsolute, join } from "path";
import {
    CancellationToken,
    CompletionContext,
    CompletionItem,
    CompletionItemKind,
    CompletionItemProvider,
    CompletionList,
    Disposable,
    Position,
    ProviderResult,
    Range,
    TextDocument,
    Uri,
    workspace,
} from "vscode";

export class ClassCompletionItemProvider implements CompletionItemProvider, Disposable {

    readonly none = "__!NONE!__";
    readonly start = new Position(0, 0);
    readonly cache = new Map<string, Map<string, CompletionItem>>();
    readonly empty = new Set<string>();
    readonly extends = new Map<string, Set<string>>();
    readonly disposables: Disposable[] = [];
    readonly isRemote = /^https?:\/\//i;
    readonly canComplete = /(id|class|className)\s*=\s*(["'])(?:(?!\2).)*$/si;
    readonly findLinkRel = /rel\s*=\s*(["'])((?:(?!\1).)+)\1/si;
    readonly findLinkHref = /href\s*=\s*(["'])((?:(?!\1).)+)\1/si;
    readonly findExtends = /(?:{{<|{{>|{%)\s*(?:extends)?\s*"?([\.0-9_a-z-A-Z]+)"?\s*(?:%}|}})/i;

    dispose() {
        let e;

        while (e = this.disposables.pop()) {
            e.dispose();
        }

        this.cache.clear();
        this.extends.clear();
    }

    watchFile(uri: Uri, listener: (e: Uri) => any) {
        const watcher = workspace.createFileSystemWatcher(uri.fsPath, true);

        this.disposables.push(
            watcher.onDidChange(listener),
            watcher.onDidDelete(listener),
            watcher);
    }

    getStyleSheets(uri: Uri): string[] {
        return workspace.getConfiguration("css", uri).get<string[]>("styleSheets", []);
    }

    parseTextToItems(text: string, items: Map<string, CompletionItem>) {
        walk(parse(text), node => {

            let kind: CompletionItemKind;

            switch (node.type) {
                case "ClassSelector":
                    kind = CompletionItemKind.Enum;
                    break;
                case "IdSelector":
                    kind = CompletionItemKind.Value;
                    break;
                default:
                    return;
            }

            items.set(node.name, new CompletionItem(node.name, kind));
        });
    }

    fetchLocal(key: string, uri: Uri): Thenable<string> {
        return new Promise(resolve => {
            if (this.cache.has(key)) {
                resolve(key);
            } else {
                const folder = workspace.getWorkspaceFolder(uri);

                const file = Uri.file(folder
                    ? join(isAbsolute(key)
                        ? folder.uri.fsPath
                        : dirname(uri.fsPath), key)
                    : join(dirname(uri.fsPath), key));

                workspace.fs.readFile(file).then(content => {
                    const items = new Map<string, CompletionItem>();

                    this.parseTextToItems(content.toString(), items);
                    this.watchFile(file, e => this.cache.delete(key));
                    this.cache.set(key, items);
                    resolve(key);
                }, () => resolve(this.none));
            }
        });
    }

    fetchRemote(key: string): Thenable<string> {
        return new Promise(resolve => {
            if (this.cache.has(key)) {
                resolve(key);
            } else {
                fetch(key).then(res => {
                    const items = new Map<string, CompletionItem>();

                    if (res.ok) {
                        res.text().then(text => {
                            this.parseTextToItems(text, items);
                            this.cache.set(key, items);
                            resolve(key);
                        }, () => resolve(this.none));
                    } else {
                        this.cache.set(key, items);
                        resolve(key);
                    }
                }, () => resolve(this.none));
            }
        });
    }

    findStyleSheets(uri: Uri): Thenable<Set<string>> {
        return new Promise(resolve => {
            const keys = new Set<string>();
            const styleSheets = this.getStyleSheets(uri);
            const promises = [];

            for (const key of styleSheets) {
                promises.push(this.isRemote.test(key)
                    ? this.fetchRemote(key).then(k => keys.add(k))
                    : this.fetchLocal(key, uri).then(k => keys.add(k)));
            }

            Promise.all(promises).then(() => resolve(keys));
        });
    }

    findDocumentLinks(uri: Uri, text: string): Thenable<Set<string>> {
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
                        const key = href[2];

                        promises.push(this.isRemote.test(key)
                            ? this.fetchRemote(key).then(k => keys.add(k))
                            : this.fetchLocal(key, uri).then(k => keys.add(k)));
                    }
                }
            }

            Promise.all(promises).then(() => resolve(keys));
        });
    }

    findDocumentStyles(uri: Uri, text: string): Thenable<Set<string>> {
        return new Promise(resolve => {
            const key = uri.toString();
            const keys = new Set<string>([key]);
            const items = new Map<string, CompletionItem>();
            const findStyles = /<style[^>]*>([^<]+)<\/style>/gi;

            let style;

            while ((style = findStyles.exec(text)) !== null) {
                this.parseTextToItems(style[1], items);
            }

            this.cache.set(key, items);
            resolve(keys);
        });
    }

    findExtendedStyles(uri: Uri, text: string): Thenable<Set<string>> {
        return new Promise(resolve => {
            const parent = this.findExtends.exec(text);

            if (parent) {
                const path = uri.fsPath;
                const ext = extname(path);
                const key = join(dirname(path), basename(parent[1], ext) + ext);
                const extend = this.extends.get(key);

                if (extend) {
                    resolve(extend);
                } else {
                    const file = Uri.file(key);

                    workspace.fs.readFile(file).then(content => {
                        const text = content.toString();

                        Promise.all([
                            this.findDocumentLinks(file, text),
                            this.findDocumentStyles(file, text),
                            this.findExtendedStyles(file, text)
                        ]).then(sets => {
                            const keys = new Set<string>();

                            sets.forEach(set => set.forEach(k => keys.add(k)));
                            this.watchFile(file, e => this.extends.delete(key));
                            this.extends.set(key, keys);
                            resolve(keys);
                        });

                    }, () => resolve(this.empty));
                }
            } else {
                resolve(this.empty);
            }
        });
    }

    buildItems(sets: Set<string>[], kind: CompletionItemKind): CompletionItem[] {
        const items = new Map<string, CompletionItem>();
        const keys = new Set<string>();

        sets.forEach(v => v.forEach(v => keys.add(v)));

        keys.forEach(k => this.cache.get(k)?.forEach((v, k) => {
            if (kind === v.kind) {
                items.set(k, v);
            }
        }));

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
                const canComplete = this.canComplete.exec(text);

                if (canComplete) {
                    const type = canComplete[1] === "id"
                        ? CompletionItemKind.Value
                        : CompletionItemKind.Enum;

                    const uri = document.uri;

                    Promise.all([
                        this.findStyleSheets(uri),
                        this.findDocumentLinks(uri, text),
                        this.findDocumentStyles(uri, text),
                        this.findExtendedStyles(uri, text)
                    ]).then(keys => resolve(this.buildItems(keys, type)));
                } else {
                    reject();
                }
            }
        });
    }
}
