import {
    CancellationToken,
    CompletionContext,
    CompletionTriggerKind,
    EndOfLine,
    Event,
    Position,
    Range,
    TextDocument,
    TextLine,
    Uri
} from "vscode";

export class MockCancellationToken implements CancellationToken {
    isCancellationRequested: boolean;
    onCancellationRequested!: Event<any>;

    constructor(isCancellationRequested: boolean) {
        this.isCancellationRequested = isCancellationRequested;
    }
}

export class MockCompletionContext implements CompletionContext {
    triggerKind = CompletionTriggerKind.Invoke;
    triggerCharacter: string | undefined;
}

export class MockDocument implements TextDocument {
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
