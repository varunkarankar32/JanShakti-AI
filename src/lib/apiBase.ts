const DEFAULT_BACKEND_BASE_URL = "https://varunka-janshakti-backend.hf.space";

export function getBackendBaseUrl(rawEnvValue?: string): string {
    const raw = (rawEnvValue || DEFAULT_BACKEND_BASE_URL).trim();
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    // Keep local dev URLs as-is, but enforce HTTPS for remote deployments.
    const normalizedProtocol =
        /^http:\/\//i.test(withProtocol) && !/localhost|127\.0\.0\.1/i.test(withProtocol)
            ? withProtocol.replace(/^http:\/\//i, "https://")
            : withProtocol;

    return normalizedProtocol.replace(/\/+$/, "");
}
