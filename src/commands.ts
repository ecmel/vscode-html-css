import { ClassCompletionItemProvider } from "./completion";
import {
    window,
    languages,
    workspace,
    CompletionItemKind,
    Diagnostic,
    DiagnosticSeverity,
    Range,
    TextDocumentChangeEvent
} from "vscode";

export type Command = (...args: any[]) => any;

export function dispose(provider: ClassCompletionItemProvider): Command {
    return () => provider.dispose();
}

export function validate(provider: ClassCompletionItemProvider): Command {
    const collection = languages.createDiagnosticCollection("vscode-html-css");

    workspace.onDidChangeTextDocument(e => collection.delete(e.document.uri));

    return () => {
        const editor = window.activeTextEditor;

        if (editor) {
            const doc = editor.document;
            const uri = doc.uri;
            const text = doc.getText();

            provider.findAll(uri, text).then(sets => {
                const ids = new Set<string>();
                const classes = new Set<string>();

                sets.forEach(set => set.forEach(key => provider.getItems(key)?.forEach((v, k) => {
                    if (v.kind === CompletionItemKind.Value) {
                        ids.add(k);
                    } else {
                        classes.add(k);
                    }
                })));

                const diagnostics: Diagnostic[] = [];
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
                                diagnostics.push(new Diagnostic(new Range(start, end),
                                    `CSS id selector '${value[1]}' not found.`,
                                    DiagnosticSeverity.Warning));
                            }
                        } else {
                            if (!classes.has(value[1])) {
                                diagnostics.push(new Diagnostic(new Range(start, end),
                                    `CSS class selector '${value[1]}' not found.`,
                                    DiagnosticSeverity.Warning));
                            }
                        }
                    }
                }

                collection.set(uri, diagnostics);
            });
        }
    };
}
