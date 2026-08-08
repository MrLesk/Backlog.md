// react-dom decides once, while its module is evaluated, whether it can listen for `input`
// events. Evaluated without a DOM on globalThis - which happens whenever the jsdom preload is
// not the module instance a realm ends up using, as under `bun test --isolate` - it falls back
// to its legacy focus + keyup value polyfill and ignores `input` entirely, silently dropping the
// typed value. Driving both paths keeps the value reaching onChange exactly once either way: the
// polyfill ignores `input`, and the modern path ignores `keyup`.
//
// The value has to go through the prototype setter because react-dom overwrites `value` on the
// element itself to track what it last rendered, and a write it can see is a write it ignores.
//
// The polyfill also watches the focused element through IE's `onpropertychange` hook, so a jsdom
// window rendered into by these tests needs the `attachEvent`/`detachEvent` no-ops its setup
// installs - react-dom throws out of its own focus listener otherwise.
//
// Callers keep their own `act` wrapping: how much each of them needs to flush afterwards differs.
export function setNativeInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
	const ownerWindow = element.ownerDocument.defaultView ?? window;
	element.focus();
	const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
	valueSetter?.call(element, value);
	element.dispatchEvent(new ownerWindow.Event("input", { bubbles: true }));
	element.dispatchEvent(new ownerWindow.KeyboardEvent("keyup", { bubbles: true }));
}
