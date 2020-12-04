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

import fetch from 'node-fetch';

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
		const config = workspace.getConfiguration('css');
		const hrefs = config.get('remoteStyleSheets') as string[];

		if (hrefs) {
			this.remoteStyles = hrefs;
		}
	}

	fetchRemoteStyleSheet(href: string): Thenable<Map<string, CompletionItem>> {

		return new Promise(resolve => {
			const selectors = this.cache.get(href);

			if (selectors) {
				resolve(selectors);
			} else {
				const selectors = new Map<string, CompletionItem>();

				fetch(href).then(res => {
					if (res.status === 200) {
						res.text().then(text => {
							walk(parse(text), (node) => {
								if (node.type === "ClassSelector") {
									selectors.set(node.name, new CompletionItem(node.name));
								};
							});
							this.cache.set(href, selectors);
							resolve(selectors);
						}, () => {
							resolve(selectors);
						});
					} else {
						resolve(selectors);
					}
				}, () => resolve(selectors));
			}
		});
	}

	findDocumentLinks(text: string): Thenable<Map<string, CompletionItem>> {
		return new Promise(resolve => {
			const links = new Map<string, CompletionItem>();
			const findLinks = /<link([^>]+)>/gi;
			const promises = [];

			let link;

			while ((link = findLinks.exec(text)) !== null) {
				const rel = this.findLinkRel.exec(link[1]);

				if (rel && rel[2] === "stylesheet") {
					const href = this.findLinkHref.exec(link[1]);

					if (href && href[2].startsWith("http")) {
						promises.push(this.fetchRemoteStyleSheet(href[2]).then(items => {
							items.forEach((value, key) => links.set(key, value));
						}));
					}
				}
			}

			Promise.all(promises).then(() => resolve(links));
		});
	}

	findRemoteStyles(): Thenable<Map<string, CompletionItem>> {
		return new Promise(resolve => {
			const links = new Map<string, CompletionItem>();
			const promises = [];

			for (let i = 0; i < this.remoteStyles.length; i++) {
				promises.push(this.fetchRemoteStyleSheet(this.remoteStyles[i]).then(items => {
					items.forEach((value, key) => links.set(key, value));
				}));
			}

			Promise.all(promises).then(() => resolve(links));
		});
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
				const styles = new Map<string, CompletionItem>();
				const findStyles = /<style[^>]*>([^<]+)<\/style>/gi;

				let style;

				while ((style = findStyles.exec(text)) !== null) {
					walk(parse(style[1]), (node) => {
						if (node.type === "ClassSelector") {
							styles.set(node.name, new CompletionItem(node.name));
						}
					});
				}

				this.findDocumentLinks(text).then(links => {
					styles.forEach((value, key) => links.set(key, value));

					this.findRemoteStyles().then(styles => {
						styles.forEach((value, key) => links.set(key, value));
						resolve([...links.values()]);
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
