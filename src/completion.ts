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
    Diagnostic,
    DiagnosticSeverity,
    Disposable,
    languages,
    Position,
    ProviderResult,
    Range,
    TextDocument,
    Uri,
    workspace
} from "vscode";

export class ClassCompletionItemProvider implements CompletionItemProvider, Disposable {

    readonly none = "__!NONE!__";
    readonly start = new Position(0, 0);
    readonly cache = new Map<string, Map<string, CompletionItem>>();
    readonly extends = new Map<string, Set<string>>();
    readonly watchers = new Map<string, Disposable>();
    readonly collection = languages.createDiagnosticCollection();
    readonly isRemote = /^https?:\/\//i;
    readonly canComplete = /(id|class|className)\s*=\s*("|')(?:(?!\2).)*$/si;
    readonly findLinkRel = /rel\s*=\s*("|')((?:(?!\1).)+)\1/si;
    readonly findLinkHref = /href\s*=\s*("|')((?:(?!\1).)+)\1/si;
    readonly findExtended = /(?:{{<|{%\s*extends|@extends\s*\()\s*("|')?([./A-Za-z_0-9\\\-]+)\1\s*(?:\)|%}|}})/i;

    dispose() {
        this.watchers.forEach(v => v.dispose());
        this.cache.clear();
        this.extends.clear();
        this.watchers.clear();
        this.collection.dispose();
    }

    watchFile(uri: Uri, listener: (e: Uri) => any) {
        const key = uri.toString();

        if (!this.watchers.has(key)) {
            const watcher = workspace.createFileSystemWatcher(uri.fsPath, true);

            watcher.onDidChange(listener);
            watcher.onDidDelete(listener);

            this.watchers.set(key, watcher);
        }
    }

    getItems(key: string): Map<string, CompletionItem> | undefined {
        return this.cache.get(key);
    }

    getStyleSheets(uri: Uri): string[] {
        return workspace.getConfiguration("css", uri).get<string[]>("styleSheets", []);
    }

    getRelativePath(uri: Uri, spec: string, ext?: string): string {
        const folder = workspace.getWorkspaceFolder(uri);
        const name = ext ? join(dirname(spec), basename(spec, ext) + ext) : spec;

        return folder
            ? join(isAbsolute(spec)
                ? folder.uri.fsPath
                : dirname(uri.fsPath), name)
            : join(dirname(uri.fsPath), name);
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
                const file = Uri.file(this.getRelativePath(uri, key));

                workspace.fs.readFile(file).then(content => {
                    const items = new Map<string, CompletionItem>();

                    this.parseTextToItems(content.toString(), items);
                    this.cache.set(key, items);
                    this.watchFile(file, e => this.cache.delete(key));
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
            const keys = new Set<string>();
            const extended = this.findExtended.exec(text);

            if (extended) {
                const name = extended[2];
                const ext = extname(name) || extname(uri.fsPath);
                const key = this.getRelativePath(uri, name, ext);
                const cached = this.extends.get(key);

                if (cached) {
                    resolve(cached);
                } else {
                    const file = Uri.file(key);

                    workspace.fs.readFile(file).then(content => {
                        const text = content.toString();

                        Promise.all([
                            this.findDocumentLinks(file, text),
                            this.findDocumentStyles(file, text)
                        ]).then(sets => {
                            sets.forEach(set => set.forEach(k => keys.add(k)));
                            this.extends.set(key, keys);
                            this.watchFile(file, e => this.extends.delete(key));
                            resolve(keys);
                        });
                    }, () => resolve(keys));
                }
            } else {
                resolve(keys);
            }
        });
    }

    findAll(uri: Uri, text: string): Thenable<Set<string>[]> {
        return Promise.all([
            this.findStyleSheets(uri),
            this.findDocumentLinks(uri, text),
            this.findDocumentStyles(uri, text),
            this.findExtendedStyles(uri, text)
        ]);
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
                    const kind = canComplete[1] === "id"
                        ? CompletionItemKind.Value
                        : CompletionItemKind.Enum;

                    this.findAll(document.uri, text)
                        .then(keys => resolve(this.buildItems(keys, kind)));
                } else {
                    reject();
                }
            }
        });
    }

    validate(document: TextDocument) {
        const uri = document.uri;
        const text = document.getText();

        this.findAll(uri, text).then(sets => {
            const ids = new Set<string>();
            const classes = new Set<string>();

            sets.forEach(set => set.forEach(key => this.getItems(key)?.forEach((v, k) => {
                if (v.kind === CompletionItemKind.Value) {
                    ids.add(k);
                } else {
                    classes.add(k);
                }
            })));

            const diagnostics: Diagnostic[] = [];
            const findAttribute = /(id|class|className)\s*=\s*("|')(.+?)\2/gsi;

            let attribute;

            while ((attribute = findAttribute.exec(text)) !== null) {
                const offset = findAttribute.lastIndex
                    - attribute[3].length
                    + attribute[3].indexOf(attribute[2]);

                const findValue = /([^\s]+)/gi;

                let value;

                while ((value = findValue.exec(attribute[3])) !== null) {
                    const anchor = findValue.lastIndex + offset;
                    const end = document.positionAt(anchor);
                    const start = document.positionAt(anchor - value[1].length);

                    if (attribute[1] === "id") {
                        if (!ids.has(value[1])) {
                            diagnostics.push(new Diagnostic(new Range(start, end),
                                `CSS id selector '${value[1]}' not found.`,
                                DiagnosticSeverity.Warning));
                        }
                    } else {
                        if (!classes.has(value[1])) {
                            diagnostics.push(new Diagnostic(new Range(start, end),
                                `CSS class selector '${value[1]}' not found.`,
                                DiagnosticSeverity.Warning));
                        }
                    }
                }
            }

            this.collection.set(uri, diagnostics);
        });
    }
}
