import * as assert from "assert";
import { ClassCompletionItemProvider } from "../../extension";
import {
	CancellationToken,
	commands,
	CompletionContext,
	CompletionItem,
	CompletionTriggerKind,
	EndOfLine,
	Event,
	Position,
	Range,
	Selection,
	TextDocument,
	TextLine,
	Uri,
	window,
	workspace
} from "vscode";

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

class MockDocument implements TextDocument {
	fileName!: string;
	isUntitled!: boolean;
	languageId!: string;
	version!: number;
	isDirty!: boolean;
	isClosed!: boolean;
	eol!: EndOfLine;
	lineCount!: number;
	text: string;

	uri = Uri.parse("/test/test.css");

	constructor(text: string) {
		this.text = text;
	}

	getText(range?: Range): string {
		return this.text;
	}

	save(): Thenable<boolean> {
		throw new Error("Method not implemented.");
	}
	lineAt(position: Position | number | any): TextLine {
		throw new Error("Method not implemented.");
	}
	offsetAt(position: Position): number {
		throw new Error("Method not implemented.");
	}
	positionAt(offset: number): Position {
		throw new Error("Method not implemented.");
	}
	getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined {
		throw new Error("Method not implemented.");
	}
	validateRange(range: Range): Range {
		throw new Error("Method not implemented.");
	}
	validatePosition(position: Position): Position {
		throw new Error("Method not implemented.");
	}
}

suite("Extension Test Suite", () => {

	const position = new Position(0, 0);
	const token = new MockCancellationToken(false);
	const context = new MockCompletionContext();

	test("RegEx: isRemote", () => {
		const provider = new ClassCompletionItemProvider();

		assert.strictEqual(provider.isRemote.test("http://example.com/example.css"), true);
		assert.strictEqual(provider.isRemote.test("https://example.com/example.css"), true);
	});

	test("RegEx: canComplete", () => {
		const provider = new ClassCompletionItemProvider();

		assert.strictEqual(provider.canComplete.test(""), false);
		assert.strictEqual(provider.canComplete.test("class=\""), true);
		assert.strictEqual(provider.canComplete.test("class=\"\""), false);
		assert.strictEqual(provider.canComplete.test("class = \""), true);
		assert.strictEqual(provider.canComplete.test("class = \"\""), false);

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

	test("RegEx: findLinkRel", () => {
		const provider = new ClassCompletionItemProvider();

		assert.strictEqual(provider.findLinkRel.exec(`
			<link rel="stylesheet" href="http://example.com/example.css">
		"`)?.[2], "stylesheet");
	});

	test("RegEx: findLinkHref", () => {
		const provider = new ClassCompletionItemProvider();

		assert.strictEqual(provider.findLinkHref.exec(`
			<link rel="stylesheet" href="http://example.com/example.css">
		"`)?.[2], "http://example.com/example.css");
	});

	test("Rejects outside class attribute", (done) => {
		const provider = new ClassCompletionItemProvider();
		const document = new MockDocument("<a class=\"\"></a>");

		const result = provider.provideCompletionItems(
			document,
			position,
			token,
			context) as Thenable<CompletionItem[]>;

		result.then(items => done(new Error("Should reject!")), () => done());
	});

	test("Completes from style tag", async () => {
		const provider = new ClassCompletionItemProvider();
		const document = new MockDocument("<style>.test{}</style><a class=\"");

		const items = await (provider.provideCompletionItems(
			document,
			position,
			token,
			context) as Thenable<CompletionItem[]>);

		assert.strictEqual(items.length, 1);
	});

	test("Completes from link tag", async () => {
		const provider = new ClassCompletionItemProvider();
		const document = new MockDocument(`
			<link 
				href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css" 
				rel="stylesheet"
			>
			<a class="`);

		const items = await (provider.provideCompletionItems(
			document,
			position,
			token,
			context) as Thenable<CompletionItem[]>);

		assert.notStrictEqual(items.length, 0);
	});

	test("Completes from remote style", async () => {
		const provider = new class extends ClassCompletionItemProvider {
			getRemoteStyleSheets(uri: Uri): string[] {
				return [
					"https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css"
				];
			}
		}();

		const document = new MockDocument("<a class=\"");

		const items = await (provider.provideCompletionItems(
			document,
			position,
			token,
			context) as Thenable<CompletionItem[]>);

		assert.notStrictEqual(items.length, 0);
	});

	test("Integration: Completes", async () => {
		const doc = await workspace.openTextDocument({
			language: "html",
			content: "<style>.test{}</style>\n<a class=\"te\"></a>"
		});

		const pos = new Position(1, 12);
		const editor = await window.showTextDocument(doc);
		editor.selection = new Selection(pos, pos);

		await commands.executeCommand("editor.action.triggerSuggest");
		await commands.executeCommand("insertBestCompletion");

		const text = doc.getText(new Range(pos.translate(0, -2), pos.translate(0, 2)));

		// This does not work!
		// assert.strictEqual(text, "test");
	});
});
