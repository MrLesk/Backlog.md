import { useCallback, useEffect, useRef, useState } from "react";

export interface HealthStatus {
	status: "healthy" | "unhealthy" | "unknown";
	timestamp: string;
	responseTime?: number;
	project?: string;
	checks?: {
		filesystem: string;
		config: string;
	};
	error?: string;
}

export interface HealthCheckState {
	isOnline: boolean;
	lastCheck: HealthStatus | null;
	isChecking: boolean;
	consecutiveFailures: number;
	wasDisconnected: boolean; // Track if we were previously disconnected
}

// No periodic health checks needed - WebSocket connection state IS the health status
const STORAGE_KEY = "backlog-health-status";
const RECONNECT_DELAY = 5000; // 5 seconds

export function useHealthCheck() {
	const [state, setState] = useState<HealthCheckState>(() => {
		// Load initial state from localStorage, but always start wasDisconnected as false
		// We only want to show "restored" during the same browser session
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				return {
					isOnline: parsed.isOnline ?? true,
					lastCheck: parsed.lastCheck ?? null,
					isChecking: false,
					consecutiveFailures: parsed.consecutiveFailures ?? 0,
					wasDisconnected: false, // Always start fresh on page load
				};
			}
		} catch (error) {
			console.warn("Failed to load health status from localStorage:", error);
		}

		return {
			isOnline: true,
			lastCheck: null,
			isChecking: false,
			consecutiveFailures: 0,
			wasDisconnected: false,
		};
	});

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Persist state to localStorage
	useEffect(() => {
		const stateToSave = {
			isOnline: state.isOnline,
			lastCheck: state.lastCheck,
			consecutiveFailures: state.consecutiveFailures,
			// Don't persist wasDisconnected - it's only for current session
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
	}, [state.isOnline, state.lastCheck, state.consecutiveFailures, state.wasDisconnected]);


	const connectWebSocket = useCallback(() => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			return; // Already connected
		}

		try {
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			const wsUrl = `${protocol}//${window.location.host}`;
			
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = () => {
				setState(prev => {
					const wasReconnecting = prev.wasDisconnected;
					if (wasReconnecting) {
						console.log("Server connection restored");
					}
					// No message for initial connection - it's expected
					
					return { 
						...prev, 
						isOnline: true, 
						consecutiveFailures: 0,
						wasDisconnected: false,
						lastCheck: {
							status: "healthy",
							timestamp: new Date().toISOString(),
						}
					};
				});
			};

			ws.onmessage = (event) => {
				// We don't need to process messages for health check
				// Connection being open IS healthy
			};

			ws.onclose = () => {
				console.log("Server disconnected");
				setState(prev => ({
					...prev,
					isOnline: false,
					wasDisconnected: true, // Mark that we got disconnected
					consecutiveFailures: prev.consecutiveFailures + 1,
					lastCheck: {
						status: "unhealthy",
						timestamp: new Date().toISOString(),
						error: "Server disconnected",
					},
				}));

				// Attempt to reconnect after delay
				reconnectTimeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
			};

			ws.onerror = (error) => {
				console.error("Server connection error:", error);
			};

		} catch (error) {
			console.error("Failed to create WebSocket connection:", error);
			setState(prev => ({
				...prev,
				isOnline: false,
				wasDisconnected: true,
				consecutiveFailures: prev.consecutiveFailures + 1,
				lastCheck: {
					status: "unhealthy",
					timestamp: new Date().toISOString(),
					error: error instanceof Error ? error.message : "WebSocket creation failed",
				},
			}));
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
		connectWebSocket();

		return () => {
			// Cleanup on unmount
			if (wsRef.current) {
				wsRef.current.close();
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
		};
	}, [connectWebSocket]);

	// Expose connection status and functions
	return {
		isOnline: state.isOnline,
		lastCheck: state.lastCheck,
		isChecking: state.isChecking,
		consecutiveFailures: state.consecutiveFailures,
		retry,
	};
}