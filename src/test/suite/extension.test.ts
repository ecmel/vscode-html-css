import * as assert from 'assert';
import { ClassCompletionItemProvider } from '../../extension';
import {
	workspace,
	Position,
	CancellationToken,
	Event,
	CompletionContext,
	CompletionTriggerKind,
	Uri,
	CompletionItem
} from 'vscode';

class MockCancellationToken implements CancellationToken {
	isCancellationRequested: boolean;
	onCancellationRequested!: Event<any>;

	constructor(isCancellationRequested: boolean) {
		this.isCancellationRequested = isCancellationRequested;
	}
}

class MockCompletionContext implements CompletionContext {
	triggerKind = CompletionTriggerKind.Invoke;
	triggerCharacter?: string | undefined;
}

suite('Extension Test Suite', () => {

	const position = new Position(0, 0);
	const token = new MockCancellationToken(false);
	const context = new MockCompletionContext();

	test('RegEx: isRemote', () => {
		const provider = new ClassCompletionItemProvider();

		assert.strictEqual(provider.isRemote.test("http://example.com/example.css"), true);
		assert.strictEqual(provider.isRemote.test("https://example.com/example.css"), true);
	});

	test('RegEx: canComplete', () => {
		const provider = new ClassCompletionItemProvider();

		assert.strictEqual(provider.canComplete.test(``), false);
		assert.strictEqual(provider.canComplete.test(`class="`), true);
		assert.strictEqual(provider.canComplete.test(`class=""`), false);
		assert.strictEqual(provider.canComplete.test(`class = "`), true);
		assert.strictEqual(provider.canComplete.test(`class = ""`), false);

		assert.strictEqual(provider.canComplete.test(`
			class = "someClass
		`), true);

		assert.strictEqual(provider.canComplete.test(`
			class 
			= "someClass
		`), true);
		assert.strictEqual(provider.canComplete.test(`
			class = 
					"someClass

		`), true);
		assert.strictEqual(provider.canComplete.test(`
			class = 
					"someClass
					
		"`), false);
		assert.strictEqual(provider.canComplete.test(`
			class = "some"
			class = 
					"someClass
					
		"`), false);
	});

	test('RegEx: findLinkRel', () => {
		const provider = new ClassCompletionItemProvider();

		assert.strictEqual(provider.findLinkRel.exec(`
			<link rel="stylesheet" href="http://example.com/example.css">
		"`)?.[2], "stylesheet");
	});

	test('RegEx: findLinkHref', () => {
		const provider = new ClassCompletionItemProvider();

		assert.strictEqual(provider.findLinkHref.exec(`
			<link rel="stylesheet" href="http://example.com/example.css">
		"`)?.[2], "http://example.com/example.css");
	});

	test('Rejects outside class attribute', async () => {
		const provider = new ClassCompletionItemProvider();
		const content = `<a class=""></a>`;
		const document = await workspace.openTextDocument({ content, language: "html" });

		try {
			const items = await (provider.provideCompletionItems(
				document,
				document.positionAt(content.length),
				token,
				context) as Thenable<CompletionItem[]>);

			assert.strictEqual(items.length, 0);
		} catch (e) {
			assert.strictEqual(e, undefined);
		}
	});

	test('Completes from style tag', async () => {
		const provider = new ClassCompletionItemProvider();
		const content = `<style>.test{}</style><a class="`;
		const document = await workspace.openTextDocument({ content, language: "html" });

		const items = await (provider.provideCompletionItems(
			document,
			document.positionAt(content.length),
			token,
			context) as Thenable<CompletionItem[]>);

		assert.strictEqual(items.length, 1);
	});

	test('Completes from link tag', async () => {
		const provider = new ClassCompletionItemProvider();
		const content = `
			<link 
				href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css" 
				rel="stylesheet"
			>
			<a class="`;
		const document = await workspace.openTextDocument({ content, language: "html" });

		const items = await (provider.provideCompletionItems(
			document,
			document.positionAt(content.length),
			token,
			context) as Thenable<CompletionItem[]>);

		assert.notStrictEqual(items.length, 0);
	});


	test('Completes from remote style', async () => {
		const provider = new class extends ClassCompletionItemProvider {
			getRemoteStyleSheets(uri: Uri): string[] {
				return [
					"https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css"
				];
			}
		}();

		const content = `<a class="`;
		const document = await workspace.openTextDocument({ content, language: "html" });

		const items = await (provider.provideCompletionItems(
			document,
			document.positionAt(content.length),
			token,
			context) as Thenable<CompletionItem[]>);

		assert.notStrictEqual(items.length, 0);
	});
});
