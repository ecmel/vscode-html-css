import * as assert from "assert";
import { CompletionList, Position, commands, workspace } from "vscode";

suite("Extension Test Suite", () => {

	test("Completes for html", async () => {
		const document = await workspace.openTextDocument({
			language: "html",
			content: "<style>.some{}</style>\n<a class='some'></a>"
		});

		const list = await commands.executeCommand<CompletionList>(
			"vscode.executeCompletionItemProvider",
			document.uri,
			new Position(1, 14)
		);

		assert.strictEqual(list?.items[0].insertText, "some");
	});
});
