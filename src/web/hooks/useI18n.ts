import { useI18nContext } from "../contexts/I18nContext";

export const useI18n = () => {
	const { t } = useI18nContext();
	return { t };
};
