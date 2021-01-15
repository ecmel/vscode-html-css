import { SelectorCompletionItemProvider } from "./completion";
import { ExtensionContext, commands, languages, window, workspace } from "vscode";

export function activate(context: ExtensionContext) {
    const config = workspace.getConfiguration("css");
    const enabledLanguages = config.get<string[]>("enabledLanguages", ["html"]);
    const validations = languages.createDiagnosticCollection();
    const provider = new SelectorCompletionItemProvider();

    context.subscriptions.push(
        commands.registerCommand("vscode-html-css.validate", async () => {
            const editor = window.activeTextEditor;

            if (editor) {
                const document = editor.document;

                if (enabledLanguages.includes(document.languageId)) {
                    validations.set(document.uri, await provider.validate(document));
                }
            }
        }),
        commands.registerCommand("vscode-html-css.dispose", () => provider.dispose()),
        workspace.onDidChangeTextDocument(e => validations.delete(e.document.uri)),
        workspace.onDidCloseTextDocument(document => validations.delete(document.uri)),
        languages.registerCompletionItemProvider(enabledLanguages, provider),
        validations,
        provider
    );
}

export function deactivate() { }
