import { useI18nContext } from "../contexts/I18nContext";

export const useI18n = () => {
	const { t, locale } = useI18nContext();
	return { t, locale };
};
