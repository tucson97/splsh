const API_VERSION = "2025-07";

let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;

  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    }
  );

  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`No se pudo obtener el access token: ${JSON.stringify(json)}`);
  }

  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 86400) * 1000,
  };
  return tokenCache.token;
}

export async function adminGraphQL(query, variables = {}) {
  const token = await getAccessToken();

  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}
