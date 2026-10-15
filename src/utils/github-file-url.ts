function encodePath(value: string): string {
	return value.split("/").map(encodeURIComponent).join("/");
}

function githubRepositoryPath(remoteUrl: string): string | null {
	const scpRemote = remoteUrl.match(/^git@github\.com:(.+)$/i);
	let repositoryPath: string;
	if (scpRemote?.[1]) {
		repositoryPath = scpRemote[1];
	} else {
		try {
			const remote = new URL(remoteUrl);
			if (remote.hostname.toLowerCase() !== "github.com" || !["http:", "https:", "ssh:"].includes(remote.protocol)) {
				return null;
			}
			repositoryPath = remote.pathname;
		} catch {
			return null;
		}
	}

	const segments = repositoryPath
		.replace(/^\/+|\/+$/g, "")
		.replace(/\.git$/i, "")
		.split("/");
	if (segments.length !== 2 || segments.some((segment) => !segment)) return null;
	return segments.map(encodeURIComponent).join("/");
}

export function buildGitHubFileUrl(remoteUrl: string, branch: string, repositoryRelativePath: string): string | null {
	const repositoryPath = githubRepositoryPath(remoteUrl);
	const normalizedPath = repositoryRelativePath.replaceAll("\\", "/");
	if (
		!repositoryPath ||
		!branch.trim() ||
		!normalizedPath ||
		normalizedPath === ".." ||
		normalizedPath.startsWith("../") ||
		normalizedPath.startsWith("/")
	) {
		return null;
	}
	return `https://github.com/${repositoryPath}/blob/${encodePath(branch)}/${encodePath(normalizedPath)}`;
}
