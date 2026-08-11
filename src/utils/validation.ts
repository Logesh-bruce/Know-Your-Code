export function validateRepoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") {
      return false;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.length >= 2 && segments[0].length > 0 && segments[1].length > 0;
  } catch {
    return false;
  }
}

export const SESSION_KEY = "kyc-repo-url";
export const MAX_REPO_URL_LENGTH = 2048;