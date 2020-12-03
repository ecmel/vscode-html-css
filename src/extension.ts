import {
	workspace,
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
	readonly selectors = new Map<string, CompletionItem>();
	readonly stylesheets = new Set<string>();
	readonly canComplete = /class\s*=\s*(["'])(?:(?!\1).)*$/si;
	readonly findLinkRel = /rel\s*=\s*(["'])(.*)\1/i;
	readonly findLinkHref = /href\s*=\s*(["'])(.*)\1/i;

	constructor(context: ExtensionContext) {
		if (workspace.workspaceFolders) {
			const glob = "**/*.html";

			workspace.findFiles(glob).then(uris => uris.forEach(uri => {
				workspace.fs.readFile(uri).then(file => {
					const findLinks = /<link([^>]+)>/gi;
					const text = file.toString();

					let link;

					while ((link = findLinks.exec(text)) !== null) {
						const rel = this.findLinkRel.exec(link[1]);
						if (rel) {
							if (rel[2] === "stylesheet") {
								const href = this.findLinkHref.exec(link[1]);
								if (href) {
									if (href[2].startsWith("http")) {
										if (!this.stylesheets.has(href[2])) {
											this.stylesheets.add(href[2]);
											fetch(href[2]).then(res => {
												if (res.status === 200) {
													console.info(`[vscode-html-css]: Fetched ${href[2]}`);
													res.text().then(text => {
														walk(parse(text), (node) => {
															if (node.type === "ClassSelector") {
																this.selectors.set(node.name, new CompletionItem(node.name));
															};
														});
													});
												} else {
													console.warn(`[vscode-html-css]: Unable to fetch ${href[2]} Status: ${res.status}`);
												}
											}).catch(reason => {
												console.error(`[vscode-html-css]: ${reason}`);
											});
										}
									}
								}
							}
						}
					}
				});
			}));
		}
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
				const selectors = new Map<string, CompletionItem>();
				const findStyles = /<style[^>]*>([^<]+)<\/style>/gi;

				let style;

				while ((style = findStyles.exec(text)) !== null) {
					walk(parse(style[1]), (node) => {
						if (node.type === "ClassSelector") {
							selectors.set(node.name, new CompletionItem(node.name));
						};
					});
				}

				resolve([...selectors, ...this.selectors].map(o => o[1]));
			} else {
				reject();
			}
		});
	}
}

export function activate(context: ExtensionContext) {
	context.subscriptions.push(
		languages.registerCompletionItemProvider("html",
			new ClassCompletionItemProvider(context), "\"", "'"));
}

export function deactivate() { }
