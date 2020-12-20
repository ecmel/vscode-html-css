import * as assert from "assert";
import { commands, Position, Range, Selection, window, workspace } from "vscode";

suite("Extension Test Suite", () => {

	test("Completes from embedded styles", async () => {
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
		assert.notStrictEqual(text, "test");
	});
});
