import fetch from "node-fetch";
import { watch } from "chokidar";
import { parse, walk } from "css-tree";
import {
    CancellationToken,
    CompletionContext,
    CompletionItem,
    CompletionItemKind,
    CompletionItemProvider,
    CompletionList,
    ExtensionContext,
    languages,
    Position,
    ProviderResult,
    Range,
    TextDocument,
    Uri,
    workspace
} from "vscode";

export class ClassCompletionItemProvider implements CompletionItemProvider {

    readonly none = "__!NONE!__";
    readonly fixed = "__!FIXED!__";
    readonly start = new Position(0, 0);
    readonly files = new Set<string>();
    readonly styles = new Set<string>([this.fixed]);
    readonly cache = new Map<string, Map<string, CompletionItem>>();
    readonly isRemote = /^https?:\/\//i;
    readonly canComplete = /(id|class|className)\s*=\s*(["'])(?:(?!\2).)*$/si;
    readonly findLinkRel = /rel\s*=\s*(["'])((?:(?!\1).)+)\1/si;
    readonly findLinkHref = /href\s*=\s*(["'])((?:(?!\1).)+)\1/si;

    getRemoteStyleSheets(uri: Uri): string[] {
        return workspace.getConfiguration("css", uri).get<string[]>("remoteStyleSheets", []);
    }

    parseTextToItems(text: string, items: Map<string, CompletionItem>) {
        walk(parse(text), node => {
            if (node.type === "ClassSelector") {
                items.set(node.name, new CompletionItem(node.name, CompletionItemKind.Enum));
            } else if (node.type === "IdSelector") {
                items.set(node.name, new CompletionItem(node.name, CompletionItemKind.Value));
            }
        });
    }

    fetchLocal(key: string): Thenable<string> {
        return new Promise(resolve => {
            workspace.fs.readFile(Uri.file(key)).then(content => {
                const items = new Map<string, CompletionItem>();

                this.parseTextToItems(content.toString(), items);
                this.cache.set(key, items);
                resolve(key);
            }, () => resolve(this.none));
        });
    }

    fetchRemote(key: string): Thenable<string> {
        return new Promise(resolve => {
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
        });
    }

    fetchStyleSheet(key: string): Thenable<string> {
        return new Promise(resolve => {
            if (key === this.none) {
                resolve(this.none);
            } else if (this.cache.get(key)) {
                resolve(key);
            } else if (key.startsWith("/")) {
                this.fetchLocal(key).then(key => resolve(key));
            } else if (this.isRemote.test(key)) {
                this.fetchRemote(key).then(key => resolve(key));
            } else {
                resolve(this.none);
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
            const remoteStyleSheets = this.getRemoteStyleSheets(uri);

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

    findLocalStyles(): Thenable<Set<string>> {
        return new Promise(resolve => {
            const promises = [];
            const keys = new Set<string>();

            for (const path of this.files) {
                promises.push(this.fetchStyleSheet(path).then(k => keys.add(k)));
            }

            Promise.all(promises).then(() => resolve(keys));
        });
    }

    findDocumentStyles(text: string): Thenable<Set<string>> {
        return new Promise(resolve => {
            const items = new Map<string, CompletionItem>();
            const findStyles = /<style[^>]*>([^<]+)<\/style>/gi;

            let style;

            while ((style = findStyles.exec(text)) !== null) {
                this.parseTextToItems(style[1], items);
            }

            this.cache.set(this.fixed, items);

            resolve(this.styles);
        });
    }

    buildItems(sets: Set<string>[], type: CompletionItemKind): CompletionItem[] {
        const items = new Map<string, CompletionItem>();
        const keys = new Set<string>();

        sets.forEach(v => v.forEach(v => keys.add(v)));

        keys.forEach(k => this.cache.get(k)?.forEach((v, k) => {
            if (type === v.kind) {
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

                    Promise.all([
                        this.findLocalStyles(),
                        this.findDocumentLinks(text),
                        this.findDocumentStyles(text),
                        this.findRemoteStyles(document.uri),
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
        ...triggerCharacters));

    const glob = "**/*.css";
    const folders = workspace.workspaceFolders?.map(folder => `${folder.uri.fsPath}/${glob}`);

    if (folders) {
        const ignored = config.get<string[]>("ignoredFolders", ["**/node_modules/**"]);

        const watcher = watch(folders, {
            ignored,
            ignoreInitial: false,
            ignorePermissionErrors: true,
            useFsEvents: true,
            followSymlinks: false
        })
            .on("add", key => provider.files.add(key))
            .on("unlink", key => provider.files.delete(key))
            .on("change", key => provider.cache.delete(key));

        const changes = workspace.onDidChangeWorkspaceFolders(e => {
            e.removed.forEach(folder => {
                watcher.unwatch(`${folder.uri.fsPath}/${glob}`);

                for (const key of provider.files) {
                    if (key.startsWith(folder.uri.fsPath)) {
                        provider.files.delete(key);
                    }
                }
            });

            e.added.forEach(folder => watcher.add(`${folder.uri.fsPath}/${glob}`));
        });

        context.subscriptions.push(changes, { dispose: watcher.close });
    }
}

export function deactivate() { }
