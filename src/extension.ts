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

import {
	parse,
	walk
} from "css-tree";

import fetch from "node-fetch";

class ClassCompletionItemProvider implements CompletionItemProvider {

	readonly start = new Position(0, 0);
	readonly cache = new Map<string, Map<string, CompletionItem>>();
	readonly canComplete = /class\s*=\s*(["'])(?:(?!\1).)*$/si;
	readonly findLinkRel = /rel\s*=\s*(["'])((?:(?!\1).)+)\1/si;
	readonly findLinkHref = /href\s*=\s*(["'])((?:(?!\1).)+)\1/si;

	remoteStyles: string[] = [];

	constructor(context: ExtensionContext) {
		this.parseRemoteConfig();

		context.subscriptions.push(workspace.onDidChangeConfiguration(e => this.parseRemoteConfig()));
	}

	parseRemoteConfig() {
		const config = workspace.getConfiguration("css");
		const keys = config.get("remoteStyleSheets") as string[];

		if (keys) {
			this.remoteStyles = keys;
		}
	}

	fetchRemoteStyleSheet(key: string): Thenable<Map<string, CompletionItem>> {
		return new Promise(resolve => {
			const items = this.cache.get(key);

			if (items) {
				resolve(items);
			} else {
				const items = new Map<string, CompletionItem>();

				fetch(key).then(res => {
					if (res.status === 200) {
						res.text().then(text => {
							walk(parse(text), (node) => {
								if (node.type === "ClassSelector") {
									items.set(node.name, new CompletionItem(node.name));
								};
							});
							this.cache.set(key, items);
							resolve(items);
						}, () => {
							resolve(items);
						});
					} else {
						resolve(items);
					}
				}, () => resolve(items));
			}
		});
	}

	findDocumentLinks(text: string): Thenable<Map<string, CompletionItem>> {
		return new Promise(resolve => {
			const items = new Map<string, CompletionItem>();
			const findLinks = /<link([^>]+)>/gi;
			const promises = [];

			let link;

			while ((link = findLinks.exec(text)) !== null) {
				const rel = this.findLinkRel.exec(link[1]);

				if (rel && rel[2] === "stylesheet") {
					const href = this.findLinkHref.exec(link[1]);

					if (href && href[2].startsWith("http")) {
						promises.push(this.fetchRemoteStyleSheet(href[2]).then(items => {
							items.forEach((value, key) => items.set(key, value));
						}));
					}
				}
			}

			Promise.all(promises).then(() => resolve(items));
		});
	}

	findRemoteStyles(): Thenable<Map<string, CompletionItem>> {
		return new Promise(resolve => {
			const items = new Map<string, CompletionItem>();
			const promises = [];

			for (let i = 0; i < this.remoteStyles.length; i++) {
				promises.push(this.fetchRemoteStyleSheet(this.remoteStyles[i]).then(found => {
					found.forEach((value, key) => items.set(key, value));
				}));
			}

			Promise.all(promises).then(() => resolve(items));
		});
	}

	findDocumentStyles(text: string): Map<string, CompletionItem> {
		const items = new Map<string, CompletionItem>();
		const findStyles = /<style[^>]*>([^<]+)<\/style>/gi;

		let style;

		while ((style = findStyles.exec(text)) !== null) {
			walk(parse(style[1]), (node) => {
				if (node.type === "ClassSelector") {
					items.set(node.name, new CompletionItem(node.name));
				}
			});
		}

		return items;
	}

	provideCompletionItems(
		document: TextDocument,
		position: Position,
		token: CancellationToken,
		context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {

		return new Promise((resolve, reject) => {
			const range = new Range(this.start, position);
			const text = document.getText(range);
			const canComplete = this.canComplete.test(text);

			if (canComplete) {
				const styles = this.findDocumentStyles(text);

				this.findRemoteStyles().then(items => {
					styles.forEach((value, key) => items.set(key, value));

					this.findDocumentLinks(text).then(links => {
						links.forEach((value, key) => items.set(key, value));

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
