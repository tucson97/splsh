// Cliente mínimo del Admin API (GraphQL) usando el token de una custom app.
// Variables necesarias: SHOPIFY_STORE (ej: cultr-au.myshopify.com) y SHOPIFY_ADMIN_TOKEN.

const API_VERSION = "2025-07";

export async function adminGraphQL(query, variables = {}) {
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
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
