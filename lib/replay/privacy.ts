const sensitiveApiPatterns = [
  /\/auth(\/|$)/i,
  /\/chat(\/|$)/i,
  /\/agentic(\/|$)/i,
  /\/planning(\/|$)/i,
  /\/attachments(\/|$)/i,
  /\/optimizations(\/|$)/i,
  /\/geocode(\/|$)/i,
  /\/exports(\/|$)/i,
  /\/trial-sessions(\/|$)/i,
];

const sensitiveQueryKeys = [
  "access_token",
  "auth_code",
  "code",
  "email",
  "id_token",
  "otp",
  "refresh_token",
  "signature",
  "signed",
  "state",
  "token",
];

export const replayPrivateAttribute = "data-openreplay-masked";
export const replayPrivateSelector = "[data-openreplay-masked]";

export function privateReplayProps() {
  return {
    [replayPrivateAttribute]: "true",
    "data-private": "true",
  };
}

export function sanitizeReplayUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl, window.location.origin);
    for (const key of sensitiveQueryKeys) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, "<redacted>");
      }
    }
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return rawUrl.replace(
      /([?&](?:code|state|token|email|otp|signature|signed)=)[^&]+/gi,
      "$1<redacted>",
    );
  }
}

export function sanitizeReplayNetworkData<T extends ReplayNetworkData>(data: T): T {
  data.url = sanitizeReplayUrl(data.url);
  data.request.headers = stripSensitiveHeaders(data.request.headers);
  data.response.headers = stripSensitiveHeaders(data.response.headers);

  if (isSensitiveApiUrl(data.url)) {
    data.request.body = null;
    data.response.body = null;
  }

  return data;
}

export function isSensitiveApiUrl(url: string) {
  return sensitiveApiPatterns.some((pattern) => pattern.test(url));
}

function stripSensitiveHeaders(headers: Record<string, string>) {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (/authorization|cookie|token|secret|otp|set-cookie/i.test(key)) {
      sanitized[key] = "<redacted>";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

type ReplayNetworkData = {
  url: string;
  request: {
    body: string | null;
    headers: Record<string, string>;
  };
  response: {
    body: unknown;
    headers: Record<string, string>;
  };
};
