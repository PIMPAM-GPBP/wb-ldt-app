import assert from "node:assert/strict";
import { createHash, X509Certificate } from "node:crypto";
import test from "node:test";
import tls from "node:tls";

import {
  canUseRelaxedTlsForPlanDocumentUrl,
  fetchPlanDocument,
  isNodeTlsCertificateError,
} from "../src/lib/ai/plan-document-fetch.ts";

test("plan document fetch helper recognizes Node certificate-chain fetch failures", () => {
  const error = new TypeError("fetch failed", {
    cause: Object.assign(new Error("unable to verify the first certificate"), {
      code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    }),
  });

  assert.equal(isNodeTlsCertificateError(error), true);
});

test("relaxed TLS fallback is limited to known planning-document hosts", () => {
  assert.equal(
    canUseRelaxedTlsForPlanDocumentUrl(
      "https://www.cabinet.gov.zm/newsite/wp-content/uploads/2023/12/8NDP-2022-2026.pdf",
    ),
    true,
  );
  assert.equal(
    canUseRelaxedTlsForPlanDocumentUrl("https://example.com/not-a-plan.pdf"),
    false,
  );
});

test("relaxed TLS fallback includes Zambia government local-plan hosts", () => {
  assert.equal(
    canUseRelaxedTlsForPlanDocumentUrl(
      "https://www.chitambocouncil.gov.zm/wp-content/uploads/2024/08/CHITAMBO-IDP_SIMPLIFIED-VERSION-2024.pdf",
    ),
    true,
  );
  assert.equal(
    canUseRelaxedTlsForPlanDocumentUrl("https://ziflp.org.zm/wp-content/uploads/2024/02/Katete_District-IDP.pdf"),
    false,
  );
});

test("trusted TLS options preserve Node roots and certificate validation", async () => {
  const { getPlanDocumentHttpsOptions, PLAN_DOCUMENT_INTERMEDIATE_CERTIFICATE_SHA256 } =
    await import("../src/lib/ai/plan-document-fetch.ts");
  const options = getPlanDocumentHttpsOptions();

  assert.equal(options.rejectUnauthorized, true);
  assert.ok(Array.isArray(options.ca));
  assert.deepEqual(options.ca.slice(0, -1), tls.rootCertificates);
  assert.equal(options.ca.length, tls.rootCertificates.length + 1);

  const intermediate = new X509Certificate(options.ca.at(-1));
  const fingerprint = createHash("sha256").update(intermediate.raw).digest("hex").toUpperCase();
  assert.equal(fingerprint, PLAN_DOCUMENT_INTERMEDIATE_CERTIFICATE_SHA256);
});

test("real Zambia HTTPS fallback uses the verified chain", { skip: !process.env.RUN_ZAMBIA_TLS_TESTS }, async () => {
  const result = await fetchPlanDocument(
    process.env.ZAMBIA_TLS_TEST_URL ?? "https://www.chadizacouncil.gov.zm/",
  );

  assert.equal(result.usedCustomCa, true);
  assert.equal("relaxedTls" in result, false);
  assert.ok(result.body.length > 0);
});
