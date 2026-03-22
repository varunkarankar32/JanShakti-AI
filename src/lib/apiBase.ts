const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8010";

export function getBackendBaseUrl(rawEnvValue?: string): string {
    const envValue = (rawEnvValue || "").trim();

    let raw = envValue;
    if (!raw) {
        if (typeof window !== "undefined") {
            const host = window.location.hostname;
            const protocol = window.location.protocol === "https:" ? "https" : "http";
            if (host && host !== "localhost" && host !== "127.0.0.1") {
                raw = `${protocol}://${host}:8010`;
            }
        }
    }

    if (!raw) {
        raw = DEFAULT_BACKEND_BASE_URL;
    }

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    // Keep local dev URLs as-is, but enforce HTTPS for remote deployments.
    const normalizedProtocol =
        /^http:\/\//i.test(withProtocol) && !/localhost|127\.0\.0\.1/i.test(withProtocol)
            ? withProtocol.replace(/^http:\/\//i, "https://")
            : withProtocol;

    return normalizedProtocol.replace(/\/+$/, "");
}
