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
	window.showInformationMessage('Start all tests.');

	test('Completes empty document with no items.', done => {
		const provider = new ClassCompletionItemProvider();

		const document = new MockTextDocument("");
		const position = new Position(0, 0);
		const token = new MockCancellationToken(false);
		const context = new MockCompletionContext();

		const result = provider.provideCompletionItems(document, position, token, context) as Thenable<CompletionItem[]>;

		result.then((items) => {
			assert.strictEqual(items.length, 0);
		}, done);
	});
});
