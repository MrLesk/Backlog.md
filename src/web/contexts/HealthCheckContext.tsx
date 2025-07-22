import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useHealthCheck } from '../hooks/useHealthCheck';

interface HealthCheckContextType {
	isOnline: boolean;
	wasDisconnected: boolean;
	retry: () => void;
}

const HealthCheckContext = createContext<HealthCheckContextType | undefined>(undefined);

export function HealthCheckProvider({ children }: { children: ReactNode }) {
	const healthCheck = useHealthCheck();
	
	return (
		<HealthCheckContext.Provider value={healthCheck}>
			{children}
		</HealthCheckContext.Provider>
	);
}

export function useHealthCheckContext() {
	const context = useContext(HealthCheckContext);
	if (!context) {
		throw new Error('useHealthCheckContext must be used within HealthCheckProvider');
	}
	return context;
}