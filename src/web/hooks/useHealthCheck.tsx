import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../lib/api";

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
}

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const STORAGE_KEY = "backlog-health-status";

export function useHealthCheck() {
	const [state, setState] = useState<HealthCheckState>(() => {
		// Load initial state from localStorage
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				return {
					isOnline: parsed.isOnline ?? true,
					lastCheck: parsed.lastCheck ?? null,
					isChecking: false,
					consecutiveFailures: parsed.consecutiveFailures ?? 0,
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
		};
	});

	// Persist state to localStorage
	useEffect(() => {
		const stateToSave = {
			isOnline: state.isOnline,
			lastCheck: state.lastCheck,
			consecutiveFailures: state.consecutiveFailures,
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
	}, [state.isOnline, state.lastCheck, state.consecutiveFailures]);

	const performHealthCheck = useCallback(async () => {
		setState(prev => ({ ...prev, isChecking: true }));

		try {
			const healthData = await apiClient.checkHealth();
			
			const newStatus: HealthStatus = {
				status: healthData.status,
				timestamp: healthData.timestamp,
				responseTime: healthData.responseTime,
				project: healthData.project,
				checks: healthData.checks,
				error: healthData.error,
			};

			setState(prev => {
				const wasOffline = !prev.isOnline;
				const isNowOnline = healthData.status === "healthy";

				return {
					isOnline: isNowOnline,
					lastCheck: newStatus,
					isChecking: false,
					consecutiveFailures: isNowOnline ? 0 : prev.consecutiveFailures + 1,
				};
			});

		} catch (error) {
			const errorStatus: HealthStatus = {
				status: "unhealthy",
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : "Unknown error",
			};

			setState(prev => ({
				isOnline: false,
				lastCheck: errorStatus,
				isChecking: false,
				consecutiveFailures: prev.consecutiveFailures + 1,
			}));
		}
	}, []);

	// Manual retry function
	const retry = useCallback(() => {
		performHealthCheck();
	}, [performHealthCheck]);

	// Set up periodic health checks
	useEffect(() => {
		// Perform initial health check
		performHealthCheck();

		// Set up interval for periodic checks
		const interval = setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL);

		return () => clearInterval(interval);
	}, [performHealthCheck]);

	// Expose connection status and functions
	return {
		isOnline: state.isOnline,
		lastCheck: state.lastCheck,
		isChecking: state.isChecking,
		consecutiveFailures: state.consecutiveFailures,
		retry,
	};
}