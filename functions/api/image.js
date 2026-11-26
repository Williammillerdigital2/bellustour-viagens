// ============================================================================
// CLOUDFLARE PAGES FUNCTION — /api/image
// Stores & serves mobile-uploaded WebP/JPEG images in Cloudflare Free KV
// (BELLUSTOUR_KV) with Edge CDN caching headers.
// ============================================================================

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Missing image id", { status: 400 });
  }

  if (env && env.BELLUSTOUR_KV) {
    try {
      const recordRaw = await env.BELLUSTOUR_KV.get(`img_${id}`);
      if (recordRaw) {
        const record = JSON.parse(recordRaw);
        const binaryStr = atob(record.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return new Response(bytes.buffer, {
          status: 200,
          headers: {
            "Content-Type": record.mime || "image/webp",
            "Cache-Control": "public, max-age=31536000, immutable"
          }
        });
      }
    } catch (e) {
      return new Response("Error loading image", { status: 500 });
    }
  }

  return new Response("Image not found", { status: 404 });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const headers = { "Content-Type": "application/json; charset=utf-8" };

  try {
    const body = await request.json();
    const dataUrl = body && body.dataUrl;
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "Invalid image data" }), {
        status: 400,
        headers
      });
    }

    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: "Malformed dataUrl" }), {
        status: 400,
        headers
      });
    }

    const mime = match[1];
    const base64 = match[2];
    const id =
      (body.id || "photo")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 24) +
      "_" +
      Date.now();

    if (env && env.BELLUSTOUR_KV) {
      await env.BELLUSTOUR_KV.put(
        `img_${id}`,
        JSON.stringify({ mime, base64, createdAt: Date.now() })
      );
      return new Response(
        JSON.stringify({
          ok: true,
          id,
          url: `/api/image?id=${id}`,
          storage: "cloudflare_kv"
        }),
        { status: 200, headers }
      );
    }

    // Fallback when KV is not bound yet: return optimized dataUrl
    return new Response(
      JSON.stringify({
        ok: true,
        id,
        url: dataUrl,
        storage: "inline_fallback"
      }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers
    });
  }
}
