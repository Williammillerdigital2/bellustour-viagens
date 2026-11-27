// ============================================================================
// CLOUDFLARE PAGES FUNCTION — /api/auth
// Server-side authentication & password change using Worker Environment
// Variables / Secrets (env.ADMIN_USER, env.ADMIN_PASS) + server-only KV hash.
// Credentials are NEVER exposed in public JSON or client code.
// ============================================================================

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getStoredCredentials(env) {
  const defaultUser = (env && env.ADMIN_USER) || "matheus";
  const defaultPass = (env && env.ADMIN_PASS) || "matheus";
  const defaultHash = await sha256Hex(`${defaultUser.toLowerCase()}:${defaultPass}:bellustour_salt_v1`);

  if (env && env.BELLUSTOUR_KV) {
    try {
      const customRaw = await env.BELLUSTOUR_KV.get("admin_auth_secret_v1");
      if (customRaw) {
        const parsed = JSON.parse(customRaw);
        if (parsed && parsed.user && parsed.passHash) {
          return parsed;
        }
      }
    } catch (_) {}
  }

  return {
    user: defaultUser.toLowerCase(),
    passHash: defaultHash
  };
}

export async function verifySessionToken(env, token) {
  if (!token) return false;
  const creds = await getStoredCredentials(env);
  const expectedToken = await sha256Hex(`session:${creds.user}:${creds.passHash}:bellustour_token_v1`);
  return token === expectedToken;
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  try {
    const body = await request.json();
    const action = body.action || "login";
    const creds = await getStoredCredentials(env);

    // 1. Verify existing session token
    if (action === "verify") {
      const valid = await verifySessionToken(env, body.token);
      return new Response(
        JSON.stringify({ ok: valid, user: valid ? creds.user : null }),
        { status: valid ? 200 : 401, headers }
      );
    }

    // 2. Login with Username & Password
    if (action === "login") {
      const inputUser = String(body.username || "").trim().toLowerCase();
      const inputPass = String(body.password || "");
      const inputHash = await sha256Hex(`${inputUser}:${inputPass}:bellustour_salt_v1`);

      if (inputUser === creds.user && inputHash === creds.passHash) {
        const token = await sha256Hex(`session:${creds.user}:${creds.passHash}:bellustour_token_v1`);
        return new Response(
          JSON.stringify({ ok: true, token, user: creds.user }),
          { status: 200, headers }
        );
      }

      return new Response(
        JSON.stringify({ ok: false, error: "Usuário ou senha incorretos." }),
        { status: 401, headers }
      );
    }

    // 3. Change Password (requires valid current password or valid session token)
    if (action === "change_password") {
      const currentPass = String(body.currentPassword || "");
      const newUser = String(body.newUsername || creds.user).trim().toLowerCase() || creds.user;
      const newPass = String(body.newPassword || "");

      if (newPass.length < 4) {
        return new Response(
          JSON.stringify({ ok: false, error: "A nova senha deve ter pelo menos 4 caracteres." }),
          { status: 400, headers }
        );
      }

      const currentHashCheck = await sha256Hex(`${creds.user}:${currentPass}:bellustour_salt_v1`);
      if (currentHashCheck !== creds.passHash) {
        return new Response(
          JSON.stringify({ ok: false, error: "A senha atual digitada está incorreta." }),
          { status: 401, headers }
        );
      }

      const newPassHash = await sha256Hex(`${newUser}:${newPass}:bellustour_salt_v1`);
      const newRecord = {
        user: newUser,
        passHash: newPassHash,
        updatedAt: Date.now()
      };

      if (env && env.BELLUSTOUR_KV) {
        await env.BELLUSTOUR_KV.put("admin_auth_secret_v1", JSON.stringify(newRecord));
      }

      const newToken = await sha256Hex(`session:${newUser}:${newPassHash}:bellustour_token_v1`);
      return new Response(
        JSON.stringify({ ok: true, token: newToken, user: newUser }),
        { status: 200, headers }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers
    });
  }
}
