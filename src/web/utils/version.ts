// Version utility for web UI
export async function getWebVersion(): Promise<string> {
	try {
		const response = await fetch("/api/version");
		const data = await response.json();
		return data.version;
	} catch {
		// If API call fails, just return empty string - UI can decide what to show
		return "";
	}
}
