// ============================================================================
// CLOUDFLARE PAGES MIDDLEWARE — functions/_middleware.js
// Redundant Anti-404 Router:
// 1. Normalizes /admin, /admin/, /painel -> /admin.html
// 2. Normalizes /privacidade, /privacy -> /privacy.html
// 3. Normalizes /termos, /terms -> /terms.html
// 4. Maps category slugs (/cruzeiros, /nacionais, etc.) and any unknown route
//    gracefully to /index.html (HTTP 200) so visitors NEVER hit a 404 page.
// ============================================================================

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // 1. Pass through all /api/* endpoints directly
  if (path.startsWith("/api/")) {
    return next();
  }

  // 2. Friendly aliases for Admin, Privacy & Terms
  if (path === "/admin" || path === "/painel" || path === "/login") {
    return env.ASSETS.fetch(new URL("/admin.html" + url.search, url.origin));
  }
  if (path === "/privacidade" || path === "/politica-de-privacidade" || path === "/privacy") {
    return env.ASSETS.fetch(new URL("/privacy.html" + url.search, url.origin));
  }
  if (path === "/termos" || path === "/termos-de-uso" || path === "/terms") {
    return env.ASSETS.fetch(new URL("/terms.html" + url.search, url.origin));
  }

  // 3. Try serving the requested static asset
  const response = await next();

  // 4. If a route would return 404 (and is not a missing image/css/js asset),
  //    serve /index.html with HTTP 200 so no visitor or Google Ad link ever hits a 404 error!
  if (response.status === 404 && !/\.(css|js|png|jpe?g|webp|svg|ico|json|xml|txt)$/i.test(path)) {
    const indexRes = await env.ASSETS.fetch(new URL("/index.html", url.origin));
    return new Response(indexRes.body, {
      status: 200,
      headers: indexRes.headers
    });
  }

  return response;
}
