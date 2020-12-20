import { ClassCompletionItemProvider } from "./completion";
import { ExtensionContext, languages, workspace } from "vscode";

export function activate(context: ExtensionContext) {

    const config = workspace.getConfiguration("css");
    const enabledLanguages = config.get<string[]>("enabledLanguages", ["html"]);
    const triggerCharacters = ["\"", "'"];

    const provider = new ClassCompletionItemProvider();

    context.subscriptions.push(languages.registerCompletionItemProvider(
        enabledLanguages,
        provider,
        ...triggerCharacters), provider);
}

export function deactivate() { }
