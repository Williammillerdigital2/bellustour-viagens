// ============================================================================
// CLOUDFLARE PAGES FUNCTION — /api/config
// Persists Admin Panel settings & packages in Cloudflare KV (BELLUSTOUR_KV)
// ============================================================================

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const isRollback = url.searchParams.get("rollback") === "1";
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  if (env && env.BELLUSTOUR_KV) {
    try {
      const key = isRollback ? "site_config_prev" : "site_config";
      const saved = await env.BELLUSTOUR_KV.get(key);
      if (saved) {
        return new Response(saved, { status: 200, headers });
      }
    } catch (e) {
      // Fall back to static default
    }
  }

  return new Response(JSON.stringify({ status: "default" }), {
    status: 404,
    headers
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = { "Content-Type": "application/json; charset=utf-8" };

  try {
    const body = await request.json();
    if (!body || !body.packages || !body.brand) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers
      });
    }

    if (env && env.BELLUSTOUR_KV) {
      const existing = await env.BELLUSTOUR_KV.get("site_config");
      if (existing) {
        await env.BELLUSTOUR_KV.put("site_config_prev", existing);
      }
      await env.BELLUSTOUR_KV.put("site_config", JSON.stringify(body));
      return new Response(JSON.stringify({ ok: true, storage: "cloudflare_kv" }), {
        status: 200,
        headers
      });
    }

    return new Response(JSON.stringify({ ok: true, storage: "local_only" }), {
      status: 200,
      headers
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers
    });
  }
}
