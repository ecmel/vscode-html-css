import * as assert from "assert";
import { ClassCompletionItemProvider } from "../../completion";
import { MockCancellationToken, MockCompletionContext, MockDocument } from "./mocks";
import { CompletionItem, Position, Uri } from "vscode";

suite("ClassCompletionItemProvider Test Suite", () => {

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
            getStyleSheets(uri: Uri): string[] {
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
});
