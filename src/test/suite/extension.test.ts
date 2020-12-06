import * as assert from 'assert';
import { ClassCompletionItemProvider } from '../../extension';
import {
	window,
	TextDocument,
	Position,
	CancellationToken,
	Event,
	CompletionContext,
	CompletionTriggerKind,
	EndOfLine,
	Range,
	TextLine,
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

class MockTextDocument implements TextDocument {
	uri!: Uri;
	fileName!: string;
	isUntitled!: boolean;
	languageId!: string;
	version!: number;
	isDirty!: boolean;
	isClosed!: boolean;
	eol!: EndOfLine;
	lineCount!: number;
	readonly #text: string;

	constructor(text: string) {
		this.#text = text;
	}

	getText(range?: Range): string {
		return this.#text;
	}
	save(): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}
	lineAt(position: Position | number | any): TextLine | any {
		throw new Error('Method not implemented.');
	}
	offsetAt(position: Position): number {
		throw new Error('Method not implemented.');
	}
	positionAt(offset: number): Position {
		throw new Error('Method not implemented.');
	}
	getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined {
		throw new Error('Method not implemented.');
	}
	validateRange(range: Range): Range {
		throw new Error('Method not implemented.');
	}
	validatePosition(position: Position): Position {
		throw new Error('Method not implemented.');
	}
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

	test('Rejects empty documents', done => {
		const provider = new ClassCompletionItemProvider();
		const document = new MockTextDocument(``);
		const result = provider.provideCompletionItems(document, position, token, context) as Thenable<CompletionItem[]>;

		result.then(items => done(items), () => done());
	});

	test('Rejects outside class attribute', done => {
		const provider = new ClassCompletionItemProvider();
		const document = new MockTextDocument(`<a class=""></a>`);
		const result = provider.provideCompletionItems(document, position, token, context) as Thenable<CompletionItem[]>;

		result.then(items => done(items), () => done());
	});

	test('Completes from style tag', done => {
		const provider = new ClassCompletionItemProvider();
		const document = new MockTextDocument(`<style>.test{}</style><a class="`);

		const result = provider.provideCompletionItems(document, position, token, context) as Thenable<CompletionItem[]>;

		result.then(items => {
			try {
				assert.strictEqual(items.length, 1);
				done();
			} catch (e) {
				done(e);
			}
		}, done);
	});

	test('Completes from link tag', done => {
		const provider = new ClassCompletionItemProvider();
		const document = new MockTextDocument(`<link href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css" rel="stylesheet"><a class="`);

		const result = provider.provideCompletionItems(document, position, token, context) as Thenable<CompletionItem[]>;

		result.then(items => {
			try {
				assert.notStrictEqual(items.length, 0);
				done();
			} catch (e) {
				done(e);
			}
		}, done);
	});

	test('Completes from remote config', done => {
		const provider = new ClassCompletionItemProvider();
		const document = new MockTextDocument(`<a class="`);

		provider.remoteStyleSheets = ["https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css"];

		const result = provider.provideCompletionItems(document, position, token, context) as Thenable<CompletionItem[]>;

		result.then(items => {
			try {
				assert.notStrictEqual(items.length, 0);
				done();
			} catch (e) {
				done(e);
			}
		}, done);
	});
});
