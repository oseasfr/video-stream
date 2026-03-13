// functions/upload.ts
// Cloudflare Pages Function — proxy de upload para o MinIO
// O browser envia o vídeo para esta Function (sem CORS),
// e ela repassa diretamente para o MinIO via PUT autenticado.
//
// Variáveis de ambiente necessárias:
//   MINIO_ACCESS_KEY → Access Key do MinIO
//   MINIO_SECRET_KEY → Secret Key do MinIO

interface Env {
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
}

const MINIO_ENDPOINT = "https://str-5511-test-fred.opendata.center";
const BUCKET = "stream-video";
const REGION = "us-east-1";
const OBJECT_KEY = "stream.mp4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Content-Length",
};

async function sha256hex(message: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256buf(data: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg));
}

async function hmacHex(key: ArrayBuffer | Uint8Array, msg: string): Promise<string> {
  const result = await hmac(key, msg);
  return Array.from(new Uint8Array(result)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSigningKey(secretKey: string, datestamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate    = await hmac(new TextEncoder().encode(`AWS4${secretKey}`), datestamp);
  const kRegion  = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

async function signedPutHeaders(
  accessKey: string,
  secretKey: string,
  body: ArrayBuffer,
  contentType: string
): Promise<Headers> {
  const now        = new Date();
  const datestamp  = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzdate    = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const host       = new URL(MINIO_ENDPOINT).hostname;
  const payloadHash = await sha256buf(body);

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzdate}\n`;
  const signedHeaders    = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    `/${BUCKET}/${OBJECT_KEY}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${datestamp}/${REGION}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzdate,
    credentialScope,
    await sha256hex(canonicalRequest),
  ].join("\n");

  const signingKey = await getSigningKey(secretKey, datestamp, REGION, "s3");
  const signature  = await hmacHex(signingKey, stringToSign);

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("x-amz-date", amzdate);
  headers.set("x-amz-content-sha256", payloadHash);
  headers.set("Authorization", authorization);
  return headers;
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.MINIO_ACCESS_KEY || !env.MINIO_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: "Credenciais do MinIO não configuradas." }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  try {
    const body        = await request.arrayBuffer();
    const contentType = request.headers.get("Content-Type") || "video/mp4";
    const url         = `${MINIO_ENDPOINT}/${BUCKET}/${OBJECT_KEY}`;
    const headers     = await signedPutHeaders(env.MINIO_ACCESS_KEY, env.MINIO_SECRET_KEY, body, contentType);

    const minioRes = await fetch(url, { method: "PUT", headers, body });

    if (!minioRes.ok) {
      const text = await minioRes.text().catch(() => "(sem corpo)");
      const resHeaders: Record<string, string> = {};
      minioRes.headers.forEach((v, k) => { resHeaders[k] = v; });
      return new Response(
        JSON.stringify({
          error: "Erro ao enviar para o MinIO.",
          status: minioRes.status,
          statusText: minioRes.statusText,
          detail: text,
          minioHeaders: resHeaders,
          requestUrl: url,
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "stream.mp4 publicado com sucesso." }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno.", detail: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
};
