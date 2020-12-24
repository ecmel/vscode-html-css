import { TextDocument, workspace, window } from "vscode";
import { ClassCompletionItemProvider } from "./completion";

export type Command = (...args: any[]) => any;

export function dispose(provider: ClassCompletionItemProvider): Command {
    return () => provider.dispose();
}

export function validate(provider: ClassCompletionItemProvider): Command {
    return () => {
        const editor = window.activeTextEditor;

        if (editor) {
            const text = editor.document.getText();
            const findAttribute = /(id|class|className)\s*=\s*("|')((?:(?!\2).)+)\2/gsi;

            let attribute;

            while ((attribute = findAttribute.exec(text)) !== null) {
                console.log(attribute[3]);
            }
        }
    };
}
