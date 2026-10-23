import http from "node:http";
import https from "node:https";
import tls from "node:tls";

const PLAN_DOCUMENT_USER_AGENT = "LDT-AI/1.0";
const MAX_REDIRECTS = 5;
const TLS_CERTIFICATE_ERROR_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_HAS_EXPIRED",
]);

/**
 * Sectigo Public Server Authentication CA DV R36, issued by the Sectigo Public Server Authentication Root R46.
 * Official CA hierarchy and download: https://support.sectigo.com/Com_KnowledgeDetailPage?Id=kA0Uj0000004IrB
 * SHA-256 fingerprint of the DER certificate: 8C54C334B66BA4E426772AF4A3F9136C19A1AEC729FDB28C535C07A5A4EF22E0
 */
const PLAN_DOCUMENT_INTERMEDIATE_CERTIFICATE = String.raw`
-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq
RPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH
12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja
EMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm
M64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv
38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB
pXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn
2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN
xx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
YtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8
ze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d
q1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF
h2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH
5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD
4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd
unQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536
WrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l
7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW
r8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh
JEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=
-----END CERTIFICATE-----
`;
export const PLAN_DOCUMENT_INTERMEDIATE_CERTIFICATE_SHA256 =
  "8C54C334B66BA4E426772AF4A3F9136C19A1AEC729FDB28C535C07A5A4EF22E0";

type PlanDocumentFetchResult = {
  body: Buffer;
  contentType: string;
  finalUrl: string;
  usedCustomCa: boolean;
};

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const code = "code" in error ? error.code : null;

  if (typeof code === "string") {
    return code;
  }

  const cause = "cause" in error ? error.cause : null;

  if (!cause || typeof cause !== "object") {
    return null;
  }

  const causeCode = "code" in cause ? cause.code : null;
  return typeof causeCode === "string" ? causeCode : null;
}

export function isNodeTlsCertificateError(error: unknown) {
  const code = getErrorCode(error);
  return code ? TLS_CERTIFICATE_ERROR_CODES.has(code) : false;
}

export function canUseTrustedTlsForPlanDocumentUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (parsed.hostname === "gov.zm" || parsed.hostname.endsWith(".gov.zm"));
  } catch {
    return false;
  }
}

/** @deprecated Use canUseTrustedTlsForPlanDocumentUrl. */
export const canUseRelaxedTlsForPlanDocumentUrl = canUseTrustedTlsForPlanDocumentUrl;

export function getPlanDocumentHttpsOptions(): https.RequestOptions {
  return {
    headers: {
      "user-agent": PLAN_DOCUMENT_USER_AGENT,
    },
    ca: [...tls.rootCertificates, PLAN_DOCUMENT_INTERMEDIATE_CERTIFICATE],
    rejectUnauthorized: true,
  };
}

async function readFetchResponse(response: Response, requestedUrl: string): Promise<PlanDocumentFetchResult> {
  if (!response.ok) {
    throw new Error(`Unable to fetch plan document (${response.status})`);
  }

  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "",
    finalUrl: response.url || requestedUrl,
    usedCustomCa: false,
  };
}

function fetchWithTrustedTls(url: string, redirectCount = 0): Promise<PlanDocumentFetchResult> {
  if (redirectCount > MAX_REDIRECTS) {
    return Promise.reject(new Error("Unable to fetch plan document: too many redirects"));
  }

  if (!canUseTrustedTlsForPlanDocumentUrl(url)) {
    return Promise.reject(new Error(`Trusted TLS is not allowed for ${url}`));
  }

  const target = new URL(url);
  const client = target.protocol === "https:" ? https : http;
  const requestOptions: http.RequestOptions | https.RequestOptions =
    target.protocol === "https:"
      ? getPlanDocumentHttpsOptions()
      : {
          headers: {
            "user-agent": PLAN_DOCUMENT_USER_AGENT,
          },
        };

  return new Promise((resolve, reject) => {
    const request = client.request(target, requestOptions, (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;

      if (
        location &&
        [301, 302, 303, 307, 308].includes(statusCode)
      ) {
        const redirectUrl = new URL(location, target).href;

        response.resume();
        fetchWithTrustedTls(redirectUrl, redirectCount + 1).then(resolve, reject);
        return;
      }

      const chunks: Buffer[] = [];

      response.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("error", reject);
      response.on("end", () => {
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`Unable to fetch plan document (${statusCode})`));
          return;
        }

        const contentType = response.headers["content-type"];

        resolve({
          body: Buffer.concat(chunks),
          contentType: Array.isArray(contentType) ? contentType[0] ?? "" : contentType ?? "",
          finalUrl: target.href,
          usedCustomCa: true,
        });
      });
    });

    request.on("error", reject);
    request.end();
  });
}

export async function fetchPlanDocument(url: string): Promise<PlanDocumentFetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": PLAN_DOCUMENT_USER_AGENT,
      },
    });
    return readFetchResponse(response, url);
  } catch (error) {
    if (isNodeTlsCertificateError(error) && canUseTrustedTlsForPlanDocumentUrl(url)) {
      return fetchWithTrustedTls(url);
    }

    throw error;
  }
}
