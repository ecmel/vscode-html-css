import { TextDocument, workspace, window, CompletionItemKind } from "vscode";
import { ClassCompletionItemProvider } from "./completion";

export type Command = (...args: any[]) => any;

export function dispose(provider: ClassCompletionItemProvider): Command {
    return () => provider.dispose();
}

export function validate(provider: ClassCompletionItemProvider): Command {
    return () => {
        const editor = window.activeTextEditor;

        if (editor) {
            const uri = editor.document.uri;
            const text = editor.document.getText();
            const ids = new Set<string>();
            const classes = new Set<string>();

            provider.findAll(uri, text).then(sets => {
                for (const set of sets) {
                    for (const key of set) {
                        const items = provider.getItems(key);
                        if (items) {
                            for (const item of items.values()) {
                                if (item.kind === CompletionItemKind.Value) {
                                    ids.add(item.label);
                                } else {
                                    classes.add(item.label);
                                }
                            }
                        }
                    }
                }

                const findAttribute = /(id|class|className)\s*=\s*("|')((?:(?!\2).)+)\2/gsi;

                let attribute;

                while ((attribute = findAttribute.exec(text)) !== null) {
                    const findWords = /([^\s]+)/gi;

                    let word;

                    while ((word = findWords.exec(attribute[3])) !== null) {
                        if (attribute[1] === "id") {
                            if (!ids.has(word[1])) {
                                console.log(word[1]);
                            }
                        } else {
                            if (!classes.has(word[1])) {
                                console.log(word[1]);
                            }
                        }
                    }
                }
            });
        }
    };
}
