import { ClassCompletionItemProvider } from "./completion";
import { ExtensionContext, languages, workspace, commands } from "vscode";

export function activate(context: ExtensionContext) {
    const config = workspace.getConfiguration("css");
    const enabledLanguages = config.get<string[]>("enabledLanguages", ["html"]);
    const collection = languages.createDiagnosticCollection();
    const provider = new ClassCompletionItemProvider(collection);

    workspace.textDocuments.forEach(document => {
        if (enabledLanguages.includes(document.languageId)) {
            provider.validate(document);
        }
    });

    let timeout: NodeJS.Timeout;

    context.subscriptions.push(
        workspace.onDidOpenTextDocument(document => {
            if (enabledLanguages.includes(document.languageId)) {
                provider.validate(document);
            }
        }),

        workspace.onDidChangeTextDocument(e => {
            if (enabledLanguages.includes(e.document.languageId)) {
                clearTimeout(timeout);
                timeout = setTimeout(() => provider.validate(e.document), 500);
            }
        }),

        languages.registerCompletionItemProvider(
            enabledLanguages,
            provider
        ),

        collection,
        provider
    );
}

export function deactivate() { }
