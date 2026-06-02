export const LABEL_COLOR_PRESETS = [
	"red",
	"orange",
	"amber",
	"yellow",
	"lime",
	"green",
	"emerald",
	"teal",
	"cyan",
	"sky",
	"blue",
	"indigo",
	"violet",
	"purple",
	"fuchsia",
	"pink",
	"rose",
] as const;

export type LabelColorKey = (typeof LABEL_COLOR_PRESETS)[number];

export function isValidLabelColor(value: string): value is LabelColorKey {
	return LABEL_COLOR_PRESETS.includes(value as LabelColorKey);
}

export function getLabelColorClasses(colorKey?: string): { bg: string; text: string } {
	switch (colorKey) {
		case "red":
			return { bg: "bg-red-200 dark:bg-red-800", text: "text-red-800 dark:text-red-200" };
		case "orange":
			return { bg: "bg-orange-200 dark:bg-orange-800", text: "text-orange-800 dark:text-orange-200" };
		case "amber":
			return { bg: "bg-amber-200 dark:bg-amber-800", text: "text-amber-800 dark:text-amber-200" };
		case "yellow":
			return { bg: "bg-yellow-200 dark:bg-yellow-800", text: "text-yellow-800 dark:text-yellow-200" };
		case "lime":
			return { bg: "bg-lime-200 dark:bg-lime-800", text: "text-lime-800 dark:text-lime-200" };
		case "green":
			return { bg: "bg-green-200 dark:bg-green-800", text: "text-green-800 dark:text-green-200" };
		case "emerald":
			return { bg: "bg-emerald-200 dark:bg-emerald-800", text: "text-emerald-800 dark:text-emerald-200" };
		case "teal":
			return { bg: "bg-teal-200 dark:bg-teal-800", text: "text-teal-800 dark:text-teal-200" };
		case "cyan":
			return { bg: "bg-cyan-200 dark:bg-cyan-800", text: "text-cyan-800 dark:text-cyan-200" };
		case "sky":
			return { bg: "bg-sky-200 dark:bg-sky-800", text: "text-sky-800 dark:text-sky-200" };
		case "blue":
			return { bg: "bg-blue-200 dark:bg-blue-800", text: "text-blue-800 dark:text-blue-200" };
		case "indigo":
			return { bg: "bg-indigo-200 dark:bg-indigo-800", text: "text-indigo-800 dark:text-indigo-200" };
		case "violet":
			return { bg: "bg-violet-200 dark:bg-violet-800", text: "text-violet-800 dark:text-violet-200" };
		case "purple":
			return { bg: "bg-purple-200 dark:bg-purple-800", text: "text-purple-800 dark:text-purple-200" };
		case "fuchsia":
			return { bg: "bg-fuchsia-200 dark:bg-fuchsia-800", text: "text-fuchsia-800 dark:text-fuchsia-200" };
		case "pink":
			return { bg: "bg-pink-200 dark:bg-pink-800", text: "text-pink-800 dark:text-pink-200" };
		case "rose":
			return { bg: "bg-rose-200 dark:bg-rose-800", text: "text-rose-800 dark:text-rose-200" };
		default:
			return { bg: "bg-gray-100 dark:bg-gray-600", text: "text-gray-600 dark:text-gray-300" };
	}
}
