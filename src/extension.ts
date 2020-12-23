import { clearCache } from "./commands";
import { ClassCompletionItemProvider } from "./completion";
import { ExtensionContext, languages, workspace, commands } from "vscode";

export function activate(context: ExtensionContext) {

    const config = workspace.getConfiguration("css");
    const enabledLanguages = config.get<string[]>("enabledLanguages", ["html"]);
    const triggerCharacters = ["\"", "'"];

    const provider = new ClassCompletionItemProvider();

    context.subscriptions.push(
        languages.registerCompletionItemProvider(
            enabledLanguages,
            provider,
            ...triggerCharacters),
        provider,
        commands.registerCommand("vscode-html-css.clearCache", clearCache(provider)));
}

export function deactivate() { }
