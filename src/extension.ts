import fetch from "node-fetch";
import { parse, walk } from "css-tree";
import {
    CancellationToken,
    CompletionContext,
    CompletionItem,
    CompletionItemKind,
    CompletionItemProvider,
    CompletionList,
    Disposable,
    ExtensionContext,
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
    readonly disposables: Disposable[] = [];
    readonly isRemote = /^https?:\/\//i;
    readonly canComplete = /(id|class|className)\s*=\s*(["'])(?:(?!\2).)*$/si;
    readonly findLinkRel = /rel\s*=\s*(["'])((?:(?!\1).)+)\1/si;
    readonly findLinkHref = /href\s*=\s*(["'])((?:(?!\1).)+)\1/si;

    dispose() {
        this.disposables.forEach(e => e.dispose());
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
                const file = folder ? Uri.joinPath(folder.uri, key) : Uri.file(key);

                workspace.fs.readFile(file).then(content => {
                    const items = new Map<string, CompletionItem>();
                    this.parseTextToItems(content.toString(), items);

                    const watcher = workspace.createFileSystemWatcher(file.fsPath, true);
                    const updater = (e: Uri) => this.cache.delete(key);
                    this.disposables.push(
                        watcher.onDidChange(updater),
                        watcher.onDidDelete(updater),
                        watcher);

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
                        this.findDocumentStyles(uri, text)
                    ]).then(keys => resolve(this.buildItems(keys, type)));
                } else {
                    reject();
                }
            }
        });
    }
}

export function activate(context: ExtensionContext) {

    const config = workspace.getConfiguration("css");
    const enabledLanguages = config.get<string[]>("enabledLanguages", ["html"]);
    const triggerCharacters = ["\"", "'"];

    const provider = new ClassCompletionItemProvider();

    context.subscriptions.push(languages.registerCompletionItemProvider(
        enabledLanguages,
        provider,
        ...triggerCharacters), provider);
}

export function deactivate() { }
