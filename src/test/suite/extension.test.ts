import * as assert from "assert";
import { CompletionList, Position, commands, workspace } from "vscode";

function sleep(duration: number): Thenable<void> {
	return new Promise(resolve => setTimeout(resolve, duration));
}

suite("Extension Test Suite", () => {

	test("Completes for html", async () => {
		const document = await workspace.openTextDocument({
			language: "html",
			content: "<style>.some{}</style>\n<a class='some'></a>"
		});

		await sleep(1000);

		const list = await commands.executeCommand<CompletionList>(
			"vscode.executeCompletionItemProvider",
			document.uri,
			new Position(1, 14)
		);

		assert.strictEqual(list?.items[0].label, "some");
	});
});
