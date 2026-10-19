export function validateRepository(repository) {
  if (typeof repository !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(repository)) {
    throw new Error("Invalid GitHub repository");
  }
  return repository;
}

export function createGitHubClient({ token, fetcher = fetch } = {}) {
  return async function request(path, { method = "GET", body, token: requestToken = token } = {}) {
    if (!path.startsWith("/") || path.startsWith("//")) throw new Error("GitHub API path must be relative to api.github.com");
    const response = await fetcher(`https://api.github.com${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
}
