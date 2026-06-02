import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getDictionary, type Locale, type TranslationDict, isValidLocale } from "../locales";
import { apiClient } from "../lib/api";

interface I18nContextType {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: TranslationDict;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Components rendered without a provider (e.g. in isolated tests) fall back to English.
const fallbackContext: I18nContextType = {
	locale: "en",
	setLocale: () => {},
	t: getDictionary("en"),
};

export const useI18nContext = () => {
	return useContext(I18nContext) ?? fallbackContext;
};

interface I18nProviderProps {
	children: React.ReactNode;
	initialLocale?: Locale;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
	children,
	initialLocale = "en",
}) => {
	const [locale, setLocaleState] = useState<Locale>(initialLocale);

	useEffect(() => {
		apiClient.fetchConfig().then((config) => {
			if (config.locale && isValidLocale(config.locale)) {
				setLocaleState(config.locale);
			}
		}).catch(() => {
			// ignore: fallback to initialLocale
		});
	}, []);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
	}, []);

	const t = getDictionary(locale);

	return (
		<I18nContext.Provider value={{ locale, setLocale, t }}>
			{children}
		</I18nContext.Provider>
	);
};
