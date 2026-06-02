type DeepString<T> = T extends (...args: infer P) => infer R
	? (...args: P) => DeepString<R>
	: T extends object
		? { [K in keyof T]: DeepString<T[K]> }
		: string;

export type TranslationDict = DeepString<typeof import("./en").en>;
