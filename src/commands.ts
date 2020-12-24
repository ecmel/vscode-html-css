import { window, languages, CompletionItemKind, Diagnostic, Range } from "vscode";
import { ClassCompletionItemProvider } from "./completion";

export type Command = (...args: any[]) => any;

export function dispose(provider: ClassCompletionItemProvider): Command {
    return () => provider.dispose();
}

export function validate(provider: ClassCompletionItemProvider): Command {
    return () => {
        const editor = window.activeTextEditor;

        if (editor) {
            const doc = editor.document;
            const uri = doc.uri;
            const text = doc.getText();
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
                    const offset = findAttribute.lastIndex
                        - attribute[3].length
                        + attribute[3].indexOf(attribute[2]);

                    const findValue = /([^\s]+)/gi;

                    let value;

                    while ((value = findValue.exec(attribute[3])) !== null) {
                        const anchor = findValue.lastIndex + offset;
                        const end = doc.positionAt(anchor);
                        const start = doc.positionAt(anchor - value[1].length);

                        if (attribute[1] === "id") {
                            if (!ids.has(value[1])) {

                            }
                        } else {
                            if (!classes.has(value[1])) {
                                const d = languages.createDiagnosticCollection();
                                const a = [new Diagnostic(new Range(start, end), "CSS selector not found.")];
                                d.set(doc.uri, a);
                            }
                        }
                    }
                }
            });
        }
    };
}
