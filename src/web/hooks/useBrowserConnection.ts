import { useEffect, useEffectEvent, useRef, useState } from "react";

interface BrowserConnectionOptions {
	enabled: boolean;
	onMessage: (data: unknown) => void;
	onDisconnect: () => void;
	onReconnect: () => void;
}

export function useBrowserConnection({ enabled, onMessage, onDisconnect, onReconnect }: BrowserConnectionOptions) {
	const [isOnline, setIsOnline] = useState(true);
	const retryRef = useRef<(() => void) | null>(null);
	const receive = useEffectEvent(onMessage);
	const disconnected = useEffectEvent(onDisconnect);
	const reconnected = useEffectEvent(onReconnect);

	useEffect(() => {
		if (!enabled) return;
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const url = `${protocol}//${window.location.host}`;
		let socket: WebSocket | null = null;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		let needsCatchUp = false;

		function handleClose() {
			socket = null;
			needsCatchUp = true;
			setIsOnline(false);
			retryTimer = setTimeout(connect, 5000);
			disconnected();
		}

		function connect() {
			if (socket) return;
			clearTimeout(retryTimer);
			try {
				socket = new WebSocket(url);
			} catch (error) {
				console.error("Failed to create browser WebSocket:", error);
				handleClose();
				return;
			}

			socket.onmessage = (event) => receive(event.data);
			socket.onclose = handleClose;
			socket.onopen = () => {
				setIsOnline(true);
				if (needsCatchUp) {
					needsCatchUp = false;
					reconnected();
				}
			};
		}

		retryRef.current = connect;
		connect();
		return () => {
			retryRef.current = null;
			clearTimeout(retryTimer);
			if (socket) {
				socket.onopen = null;
				socket.onmessage = null;
				socket.onclose = null;
				socket.close();
			}
		};
	}, [enabled]);

	return { isOnline, retry: () => retryRef.current?.() };
}
