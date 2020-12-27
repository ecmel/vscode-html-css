import { SelectorCompletionItemProvider } from "./completion";
import {
    ExtensionContext,
    languages,
    TextDocument,
    TextDocumentChangeEvent,
    workspace
} from "vscode";

export function activate(context: ExtensionContext) {
    const config = workspace.getConfiguration("css");
    const enabledLanguages = config.get<string[]>("enabledLanguages", ["html"]);
    const timeouts = new Map<string, NodeJS.Timeout>();
    const provider = new SelectorCompletionItemProvider();

    const validate = (e: TextDocumentChangeEvent | TextDocument) => {
        const document = (e as TextDocumentChangeEvent).document || e;

        if (enabledLanguages.includes(document.languageId)) {
            const uri = document.uri.toString();
            const timeout = timeouts.get(uri);

            if (timeout) {
                clearTimeout(timeout);
            }

            timeouts.set(uri, setTimeout(() => {
                timeouts.delete(uri);
                provider.validate(document);
            }, 500));
        }
    };

    workspace.textDocuments.forEach(validate);

    context.subscriptions.push(
        workspace.onDidOpenTextDocument(validate),
        workspace.onDidChangeTextDocument(validate),
        languages.registerCompletionItemProvider(enabledLanguages, provider),
        provider
    );
}

export function deactivate() { }
