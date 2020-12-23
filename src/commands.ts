import { ClassCompletionItemProvider } from "./completion";

export function clearCache(provider: ClassCompletionItemProvider): (...args: any[]) => any {
    return () => provider.dispose();
}
