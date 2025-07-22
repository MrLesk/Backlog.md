import { useCallback, useEffect, useRef, useState } from "react";

const RECONNECT_DELAY = 5000; // 5 seconds

export function useHealthCheck() {
	const [isOnline, setIsOnline] = useState(true);
	const [wasDisconnected, setWasDisconnected] = useState(false);
	
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isMountedRef = useRef(true);

	const connectWebSocket = useCallback(() => {
		if (!isMountedRef.current) {
			return; // Don't connect if component is unmounted
		}

		// Check if already connected or connecting
		if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
			return;
		}

		// Clean up any existing connection before creating a new one
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}

		try {
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			const wsUrl = `${protocol}//${window.location.host}`;
			
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = () => {
				setIsOnline(true);
				setWasDisconnected(false);
			};

			ws.onclose = () => {
				setIsOnline(false);
				setWasDisconnected(true);
				// Attempt to reconnect after delay if still mounted
				if (isMountedRef.current) {
					reconnectTimeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
				}
			};

			ws.onerror = () => {
				setIsOnline(false);
				setWasDisconnected(true);
			};

		} catch (error) {
			console.error("[WebSocket Client] Failed to create WebSocket:", error);
			setIsOnline(false);
			setWasDisconnected(true);
		}
	}, []);

	// Manual retry function
	const retry = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
		}
		connectWebSocket();
	}, [connectWebSocket]);

	// Set up WebSocket connection
	useEffect(() => {
		isMountedRef.current = true;
		
		// Add a small delay to avoid rapid connect/disconnect in StrictMode
		const connectTimer = setTimeout(() => {
			connectWebSocket();
		}, 100);

		return () => {
			// Mark as unmounted
			isMountedRef.current = false;
			
			// Clear the connect timer if it hasn't fired yet
			clearTimeout(connectTimer);
			
			// Cleanup on unmount
			if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
				wsRef.current.close();
				wsRef.current = null;
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = null;
			}
		};
	}, [connectWebSocket]);

	return {
		isOnline,
		wasDisconnected,
		retry,
	};
}