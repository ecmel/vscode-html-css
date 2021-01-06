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

export type Validation = {
    id: boolean,
    class: boolean
};

export type Selectors = {
    ids: Map<string, CompletionItem>,
    classes: Map<string, CompletionItem>
};

export class SelectorCompletionItemProvider implements CompletionItemProvider, Disposable {

    readonly start = new Position(0, 0);
    readonly cache = new Map<string, Map<string, CompletionItem>>();
    readonly watchers = new Map<string, Disposable>();
    readonly collection = languages.createDiagnosticCollection();
    readonly isRemote = /^https?:\/\//i;
    readonly canComplete = /(id|class|className)\s*=\s*("|')(?:(?!\2).)*$/si;
    readonly findLinkRel = /rel\s*=\s*("|')((?:(?!\1).)+)\1/si;
    readonly findLinkHref = /href\s*=\s*("|')((?:(?!\1).)+)\1/si;
    readonly findExtended = /(?:{{<|{{>|{%\s*extends|@extends\s*\()\s*("|')?([./A-Za-z_0-9\\\-]+)\1\s*(?:\)|%}|}})/i;

    dispose() {
        this.watchers.forEach(v => v.dispose());
        this.cache.clear();
        this.watchers.clear();
        this.collection.dispose();
    }

    watchFile(uri: Uri, listener: (e: Uri) => any) {
        const key = uri.toString();

        if (!this.watchers.has(key)) {
            const watcher = workspace.createFileSystemWatcher(uri.fsPath);

            watcher.onDidCreate(listener);
            watcher.onDidChange(listener);
            watcher.onDidDelete(listener);

            this.watchers.set(key, watcher);
        }
    }

    getStyleSheets(uri: Uri): string[] {
        return workspace.getConfiguration("css", uri).get<string[]>("styleSheets", []);
    }

    getValidation(uri: Uri): Validation {
        const config = workspace.getConfiguration("css", uri);

        return {
            id: config.get<boolean>("validation.id", false),
            class: config.get<boolean>("validation.class", true)
        };
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

    async fetchLocal(key: string, uri: Uri): Promise<void> {
        if (!this.cache.has(key)) {
            const items = new Map<string, CompletionItem>();
            const file = Uri.file(this.getRelativePath(uri, key));

            try {
                const content = await workspace.fs.readFile(file);
                this.parseTextToItems(content.toString(), items);
            } catch (error) {
            }

            this.cache.set(key, items);
            this.watchFile(file, e => this.cache.delete(key));
        }
    }

    async fetchRemote(key: string): Promise<void> {
        if (!this.cache.has(key)) {
            const items = new Map<string, CompletionItem>();

            try {
                const res = await fetch(key);

                if (res.ok) {
                    const text = await res.text();
                    this.parseTextToItems(text, items);
                }
            } catch (error) {
            }

            this.cache.set(key, items);
        }
    }

    async fetchStyleSheet(key: string, uri: Uri): Promise<void> {
        if (this.isRemote.test(key)) {
            await this.fetchRemote(key);
        } else {
            await this.fetchLocal(key, uri);
        }
    }

    findDocumentStyles(uri: Uri, keys: Set<string>, text: string) {
        const key = uri.toString();
        const items = new Map<string, CompletionItem>();
        const findStyles = /<style[^>]*>([^<]+)<\/style>/gi;

        let style;

        while ((style = findStyles.exec(text)) !== null) {
            this.parseTextToItems(style[1], items);
        }

        this.cache.set(key, items);
        keys.add(key);
    }

    async findStyleSheets(uri: Uri, keys: Set<string>): Promise<void> {
        for (const key of this.getStyleSheets(uri)) {
            await this.fetchStyleSheet(key, uri);
            keys.add(key);
        }
    }

    async findDocumentLinks(uri: Uri, keys: Set<string>, text: string): Promise<void> {
        const findLinks = /<link([^>]+)>/gi;

        let link;

        while ((link = findLinks.exec(text)) !== null) {
            const rel = this.findLinkRel.exec(link[1]);

            if (rel && rel[2] === "stylesheet") {
                const href = this.findLinkHref.exec(link[1]);

                if (href) {
                    const key = href[2];

                    await this.fetchStyleSheet(key, uri);
                    keys.add(key);
                }
            }
        }
    }

    async findExtendedStyles(uri: Uri, keys: Set<string>, text: string): Promise<void> {
        const extended = this.findExtended.exec(text);

        if (extended) {
            const name = extended[2];
            const ext = extname(name) || extname(uri.fsPath);
            const key = this.getRelativePath(uri, name, ext);
            const file = Uri.file(key);

            try {
                const content = await workspace.fs.readFile(file);
                const text = content.toString();

                this.findDocumentStyles(file, keys, text);
                await this.findDocumentLinks(file, keys, text);
            } catch (error) {
            }
        }
    }

    async validate(document: TextDocument): Promise<Selectors> {
        const keys = new Set<string>();
        const uri = document.uri;
        const text = document.getText();

        this.findDocumentStyles(uri, keys, text);
        await this.findStyleSheets(uri, keys);
        await this.findDocumentLinks(uri, keys, text);
        await this.findExtendedStyles(uri, keys, text);

        const ids = new Map<string, CompletionItem>();
        const classes = new Map<string, CompletionItem>();
        const validation = this.getValidation(uri);

        keys.forEach(key => this.cache.get(key)?.forEach((v, k) =>
            (v.kind === CompletionItemKind.Value ? ids : classes).set(k, v)));

        const diagnostics: Diagnostic[] = [];
        const findAttribute = /(id|class|className)\s*=\s*("|')(.+?)\2/gsi;

        let attribute;

        while ((attribute = findAttribute.exec(text)) !== null) {
            const offset = findAttribute.lastIndex
                - attribute[3].length
                + attribute[3].indexOf(attribute[2]);

            const findSelector = /([a-zA-Z0-9_\-]+)(?![^(\[{]*[}\])])/gi;

            let value;

            while ((value = findSelector.exec(attribute[3])) !== null) {
                const anchor = findSelector.lastIndex + offset;
                const end = document.positionAt(anchor);
                const start = document.positionAt(anchor - value[1].length);

                if (attribute[1] === "id") {
                    if (validation.id && !ids.has(value[1])) {
                        diagnostics.push(new Diagnostic(new Range(start, end),
                            `CSS id selector '${value[1]}' not found.`,
                            DiagnosticSeverity.Information));
                    }
                } else {
                    if (validation.class && !classes.has(value[1])) {
                        diagnostics.push(new Diagnostic(new Range(start, end),
                            `CSS class selector '${value[1]}' not found.`,
                            DiagnosticSeverity.Warning));
                    }
                }
            }
        }

        this.collection.set(uri, diagnostics);

        return {
            ids, classes
        };
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
                    this.validate(document).then(selectors => resolve([
                        ...(canComplete[1] === "id"
                            ? selectors.ids
                            : selectors.classes).values()
                    ]));
                } else {
                    reject();
                }
            }
        });
    }
}
