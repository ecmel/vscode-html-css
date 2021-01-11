import { SelectorCompletionItemProvider } from "./completion";
import { ExtensionContext, commands, languages, window, workspace } from "vscode";

export function activate(context: ExtensionContext) {
    const validations = languages.createDiagnosticCollection();
    const config = workspace.getConfiguration("css");
    const enabledLanguages = config.get<string[]>("enabledLanguages", ["html"]);
    const provider = new SelectorCompletionItemProvider();

    context.subscriptions.push(
        commands.registerCommand("vscode-html-css.validate", async () => {
            const editor = window.activeTextEditor;

            if (editor) {
                const document = editor.document;

                if (enabledLanguages.includes(document.languageId)) {
                    const diagnostics = await provider.validate(document);
                    validations.set(document.uri, diagnostics);
                }
            }
        }),
        workspace.onDidChangeTextDocument(e => validations.delete(e.document.uri)),
        workspace.onDidCloseTextDocument(document => validations.delete(document.uri)),
        languages.registerCompletionItemProvider(enabledLanguages, provider),
        provider,
        validations
    );
}

export function deactivate() { }
