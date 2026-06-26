import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { pool } from "../lib/neon.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  try {
    const result = await pool.query("SELECT * FROM sealed_mapping LIMIT 1");
    const spalten = result.rows.length > 0 ? Object.keys(result.rows[0]) : [];
    return { ok: true, spalten, beispiel: result.rows[0] ?? null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

export default function DbTest() {
  const data = useLoaderData();

  return (
    <s-page heading="DB-Struktur prüfen">
      <s-section heading="Spalten in sealed_mapping">
        {data.ok ? (
          <s-stack direction="block" gap="base">
            <s-paragraph>Spalten: {data.spalten.join(", ")}</s-paragraph>
            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <pre style={{ margin: 0 }}>
                <code>{JSON.stringify(data.beispiel, null, 2)}</code>
              </pre>
            </s-box>
          </s-stack>
        ) : (
          <s-paragraph>❌ Fehler: {data.error}</s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}