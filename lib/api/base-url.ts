const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1";

export function getApiBaseUrl() {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
  const baseUrl = configuredBaseUrl.replace(/\/+$/, "");

  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}
