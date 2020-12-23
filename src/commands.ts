import { ClassCompletionItemProvider } from "./completion";

export type Command = (...args: any[]) => any;

export function clearCache(provider: ClassCompletionItemProvider): Command {
    return () => provider.dispose();
}
