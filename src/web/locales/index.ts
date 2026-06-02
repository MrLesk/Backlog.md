import { en } from "./en";
import { ja } from "./ja";
import type { TranslationDict } from "./types";
import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";

export type Locale = "en" | "ja" | "zh-CN" | "zh-TW";

export type { TranslationDict };

const dictionaries: Record<Locale, TranslationDict> = {
	en,
	ja,
	"zh-CN": zhCN,
	"zh-TW": zhTW,
};

export function getDictionary(locale: Locale): TranslationDict {
	return dictionaries[locale] ?? dictionaries.en;
}

export function isValidLocale(value: string): value is Locale {
	return value === "en" || value === "ja" || value === "zh-CN" || value === "zh-TW";
}
