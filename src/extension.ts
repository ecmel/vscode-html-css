import fetch from "node-fetch";
import { FSWatcher, watch } from "chokidar";
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

    readonly start = new Position(0, 0);
    readonly files = new Set<string>();
    readonly cache = new Map<string, Map<string, CompletionItem>>();
    readonly none = "__!NONE!__";
    readonly isRemote = /^https?:\/\//i;
    readonly canComplete = /class\s*=\s*(["'])(?:(?!\1).)*$/si;
    readonly findLinkRel = /rel\s*=\s*(["'])((?:(?!\1).)+)\1/si;
    readonly findLinkHref = /href\s*=\s*(["'])((?:(?!\1).)+)\1/si;

    getRemoteStyleSheets(uri: Uri): string[] {
        return workspace.getConfiguration("css", uri).get<string[]>("remoteStyleSheets", []);
    }

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
                    }, () => resolve(this.none));
                } else {
                    this.cache.set(key, items);
                    resolve(key);
                }
            }, () => resolve(this.none));
        });
    }

    fetchLocal(key: string): Thenable<string> {
        return new Promise(resolve => {
            const items = new Map<string, CompletionItem>();

            workspace.fs.readFile(Uri.file(key)).then(content => {
                this.parseTextToItems(content.toString(), items);
                this.cache.set(key, items);
                resolve(key);
            }, () => resolve(this.none));
        });
    }

    fetchStyleSheet(key: string): Thenable<string> {
        return new Promise(resolve => {
            if (key === this.none) {
                resolve(this.none);
            } else {
                if (this.cache.get(key)) {
                    resolve(key);
                } else if (this.isRemote.test(key)) {
                    this.fetchRemote(key).then(key => resolve(key));
                } else if (key.startsWith("/")) {
                    this.fetchLocal(key).then(key => resolve(key));
                } else {
                    resolve(this.none);
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

                    this.findLocalStyles().then(locals =>
                        this.findRemoteStyles(document.uri).then(styles =>
                            this.findDocumentLinks(text).then(links =>
                                resolve(this.buildItems(items, styles, links, locals)))));
                } else {
                    reject();
                }
            }
        });
    }
}

export let watcher: FSWatcher;

export function activate(context: ExtensionContext) {
    const provider = new ClassCompletionItemProvider();

    const config = workspace.getConfiguration("css");
    const enabledLanguages = config.get<string[]>("enabledLanguages", ["html"]);
    const triggerCharacters = config.get<string[]>("triggerCharacters", ["\"", "'"]);

    context.subscriptions.push(languages
        .registerCompletionItemProvider(enabledLanguages, provider, ...triggerCharacters));

    const glob = "**/*.css";
    const folders = workspace.workspaceFolders?.map(folder => `${folder.uri.fsPath}/${glob}`);

    if (folders) {
        watcher = watch(folders, { ignored: ["**/node_modules/**", "**/test*/**"] })
            .on("add", key => provider.files.add(key))
            .on("unlink", key => provider.files.delete(key))
            .on("change", key => provider.cache.delete(key));

        workspace.onDidChangeWorkspaceFolders(e => {
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
    }
}

export function deactivate() {
    return watcher?.close();
}
