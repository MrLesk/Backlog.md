declare module "neo-neo-bblessed" {
	export interface ProgramInterface {
		pause?: () => (() => void) | undefined;
	}

	export interface ScreenOptions {
		smartCSR?: boolean;
		program?: ProgramInterface;
		title?: string;
		[key: string]: unknown;
	}

	export interface ScreenInterface {
		program?: ProgramInterface;
		key(keys: string | string[], callback: (...args: unknown[]) => void): void;
		on(event: string, callback: (...args: unknown[]) => void): void;
		append(el: ElementInterface): void;
		render(): void;
		destroy(): void;
		clearRegion(x1: number, x2: number, y1: number, y2: number): void;
		width: number;
		height: number;
		emit(event: string): void;
		title?: string;
	}

	export interface ElementInterface {
		setContent(content: string): void;
		focus(): void;
		key(keys: string | string[], callback: (...args: unknown[]) => void): void;
		on(
			event: string,
			callback:
				| ((ch: string, key: { name: string; ctrl?: boolean; meta?: boolean }) => void)
				| ((...args: unknown[]) => void),
		): void;
		destroy(): void;
		setFront?: () => void;
		setScrollPerc?: (value: number) => void;
		getLines: () => string[];
		width?: number | string;
		height?: number | string;
		top?: number | string;
		left?: number | string;
		bottom?: number | string;
		right?: number | string;
		options: { wrap?: boolean };
		style?: unknown;
		[key: string]: unknown;
	}

	export interface BoxInterface extends ElementInterface {
		setLabel?(label: string): void;
	}
	export interface LineInterface extends ElementInterface {}
	export interface ListInterface extends ElementInterface {
		setItems(items: string[]): void;
		select(i: number): void;
		selected?: number;
		items: Array<unknown>;
		style: { selected?: { bg?: string } } & Record<string, unknown>;
	}
	export interface ScrollableTextInterface extends ElementInterface {}
	export interface ScrollableBoxInterface extends BoxInterface {
		getScroll(): number;
		scrollTo(index: number): void;
	}
	export interface LogInterface extends ElementInterface {
		log(message: string): void;
	}
	export interface TextboxInterface extends ElementInterface {
		value?: string;
		getValue(): string;
		setValue(value: string): void;
		clearValue(): void;
		submit(): void;
		cancel(): void;
		readInput(callback?: (error?: Error, value?: string) => void): void;
	}

	export function screen(options?: ScreenOptions): ScreenInterface;
	export function program(options?: Record<string, unknown>): ProgramInterface;
	export function box(options?: Record<string, unknown>): BoxInterface;
	export function line(options?: Record<string, unknown>): LineInterface;
	export function list(options?: Record<string, unknown>): ListInterface;
	export function scrollablebox(options?: Record<string, unknown>): ScrollableBoxInterface;
	export function scrollabletext(options?: Record<string, unknown>): ScrollableTextInterface;
	export function log(options?: Record<string, unknown>): LogInterface;
	export function textbox(options?: Record<string, unknown>): TextboxInterface;
}
