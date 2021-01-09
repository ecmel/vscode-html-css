import { SelectorCompletionItemProvider } from "./completion";
import { ExtensionContext, languages, workspace } from "vscode";

export function activate(context: ExtensionContext) {
    const config = workspace.getConfiguration("css");
    const enabledLanguages = config.get<string[]>("enabledLanguages", ["html"]);
    const provider = new SelectorCompletionItemProvider();

    context.subscriptions.push(
        languages.registerCompletionItemProvider(enabledLanguages, provider),
        provider
    );
}

export function deactivate() { }
