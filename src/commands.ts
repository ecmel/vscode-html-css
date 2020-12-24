import { TextDocument, workspace } from "vscode";
import { ClassCompletionItemProvider } from "./completion";

export type Command = (...args: any[]) => any;

export function dispose(provider: ClassCompletionItemProvider): Command {
    return () => provider.dispose();
}

export function validate(provider: ClassCompletionItemProvider): Command {
    return (document: TextDocument) => {
        const text = document.getText();
        const findAttribute = /(id|class|className)\s*=\s*("|')((?:(?!\2).)+)\2/gsi;

        let attribute;

        while ((attribute = findAttribute.exec(text)) !== null) {
            console.log(attribute[3]);
        }
    };
}
