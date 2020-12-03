import {
	languages,
	Range,
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
	readonly findLinkRel = /rel\s*=\s*(["'])(.*)\1/i;
	readonly findLinkHref = /href\s*=\s*(["'])(.*)\1/i;

	fetchRemoteStyleSheet(link: string): Thenable<string> {
		return new Promise((resolve, reject) => {

			const rel = this.findLinkRel.exec(link);

			if (rel && rel[2] === "stylesheet") {

				const href = this.findLinkHref.exec(link);

				if (href && href[2].startsWith("http")) {
					if (this.cache.has(href[2])) {
						resolve(href[2]);
					} else {
						const selectors = new Map<string, CompletionItem>();
						this.cache.set(href[2], selectors);

						fetch(href[2]).then(res => {
							if (res.status === 200) {
								res.text().then(text => {
									walk(parse(text), (node) => {
										if (node.type === "ClassSelector") {
											selectors.set(node.name, new CompletionItem(node.name));
										};
									});
									resolve(href[2]);
								}, () => {
									resolve();
								});
							} else {
								resolve();
							}
						}, () => resolve());
					}
				} else {
					resolve();
				}

			} else {
				resolve();
			}
		});
	}

	findRemoteStyleSheets(text: string): Thenable<Map<string, CompletionItem>> {
		return new Promise((resolve, reject) => {
			const links = new Map<string, CompletionItem>();
			const findLinks = /<link([^>]+)>/gi;
			const promises = [];

			let link;

			while ((link = findLinks.exec(text)) !== null) {
				promises.push(this.fetchRemoteStyleSheet(link[1]).then(href => {
					if (href) {
						const items = this.cache.get(href);
						if (items) {
							items.forEach((value, key) => links.set(key, value));
						}
					}
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
						};
					});
				}

				this.findRemoteStyleSheets(text).then(links => {
					styles.forEach((value, key) => links.set(key, value));
					resolve([...links.values()]);
				});
			} else {
				reject();
			}
		});
	}
}

export function activate(context: ExtensionContext) {
	context.subscriptions.push(
		languages.registerCompletionItemProvider("html",
			new ClassCompletionItemProvider(), "\"", "'"));
}

export function deactivate() { }
