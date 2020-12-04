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
	CompletionList
} from "vscode";

const NONE = "<NONE>";

class ClassCompletionItemProvider implements CompletionItemProvider {

	readonly start = new Position(0, 0);
	readonly cache = new Map<string, Map<string, CompletionItem>>();
	readonly canComplete = /class\s*=\s*(["'])(?:(?!\1).)*$/si;
	readonly findLinkRel = /rel\s*=\s*(["'])((?:(?!\1).))+\1/si;
	readonly findLinkHref = /href\s*=\s*(["'])((?:(?!\1).))+\1/si;

	remoteStyles: string[] = [];

	constructor(context: ExtensionContext) {
		this.parseRemoteConfig();

		context.subscriptions.push(workspace
			.onDidChangeConfiguration(e => this.parseRemoteConfig()));
	}

	parseRemoteConfig() {
		const config = workspace.getConfiguration("css");
		const keys = config.get("remoteStyleSheets") as string[];

		if (keys) {
			this.remoteStyles = keys;
		}
	}

	parseTextToItems(text: string, items: Map<string, CompletionItem>) {
		walk(parse(text), (node) => {
			if (node.type === "ClassSelector") {
				items.set(node.name, new CompletionItem(node.name));
			}
		});
	}

	fetchRemoteStyleSheet(key: string): Thenable<string> {
		return new Promise(resolve => {

			if (key === NONE) {
				resolve(NONE);
				return;
			}

			const items = this.cache.get(key);

			if (items) {
				resolve(key);
			} else {
				const items = new Map<string, CompletionItem>();

				fetch(key).then(res => {
					if (res.status < 400) {
						res.text().then(text => {
							this.parseTextToItems(text, items);
							this.cache.set(key, items);
							resolve(key);
						}, () => resolve(NONE));
					} else {
						resolve(NONE);
					}
				}, () => resolve(NONE));
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

					if (href && href[2].startsWith("http")) {
						promises.push(this.fetchRemoteStyleSheet(href[2])
							.then(key => keys.add(key)));
					}
				}
			}

			Promise.all(promises).then(() => resolve(keys));
		});
	}

	findRemoteStyles(): Thenable<Set<string>> {
		return new Promise(resolve => {

			const keys = new Set<string>();
			const promises = [];

			for (let i = 0; i < this.remoteStyles.length; i++) {
				promises.push(this.fetchRemoteStyleSheet(this.remoteStyles[i])
					.then(key => keys.add(key)));
			}

			Promise.all(promises).then(() => resolve(keys));
		});
	}

	findDocumentStyles(text: string): Map<string, CompletionItem> {
		const items = new Map<string, CompletionItem>();
		const findStyles = /<style[^>]*>([^<]+)<\/style>/gi;

		let style;

		while ((style = findStyles.exec(text)) !== null) {
			this.parseTextToItems(text, items);
		}

		return items;
	}

	provideCompletionItems(
		document: TextDocument,
		position: Position,
		token: CancellationToken,
		context: CompletionContext)
		: ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {

		return new Promise((resolve, reject) => {
			const range = new Range(this.start, position);
			const text = document.getText(range);
			const canComplete = this.canComplete.test(text);

			if (canComplete) {
				const items = this.findDocumentStyles(text);

				this.findRemoteStyles().then(styles => {
					this.findDocumentLinks(text).then(links => {
						links.forEach(key => styles.add(key));

						styles.forEach(key => this.cache.get(key)
							?.forEach((value, name) => items.set(name, value)));

						resolve([...items.values()]);
					});
				});
			} else {
				reject();
			}
		});
	}
}

export function activate(context: ExtensionContext) {
	context.subscriptions.push(languages
		.registerCompletionItemProvider("html",
			new ClassCompletionItemProvider(context)));
}

export function deactivate() { }
