export const onRequest: PagesFunction<{ UPLOAD_PASSWORD?: string; STREAM_BUCKET: R2Bucket }> = async (context) => {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (!env.STREAM_BUCKET) {
    return new Response(JSON.stringify({ error: "STREAM_BUCKET não configurado" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const uploadPassword = env.UPLOAD_PASSWORD;
  if (!uploadPassword) {
    return new Response(JSON.stringify({ error: "UPLOAD_PASSWORD não configurada" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const formData = await request.formData();
    const password = formData.get("password");
    const file = formData.get("file");

    if (typeof password !== "string" || password.length === 0) {
      return new Response(JSON.stringify({ error: "Senha inválida" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (password !== uploadPassword) {
      return new Response(JSON.stringify({ error: "Senha incorreta" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Arquivo não enviado" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!file.type.startsWith("video/")) {
      return new Response(JSON.stringify({ error: "Tipo de arquivo inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    await env.STREAM_BUCKET.put("stream.mp4", file.stream(), {
      httpMetadata: {
        contentType: file.type || "video/mp4",
      },
      customMetadata: {
        originalFileName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({ success: true, key: "stream.mp4" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Erro ao processar upload" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};
