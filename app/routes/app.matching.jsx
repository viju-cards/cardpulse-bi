import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { matchProduct, detectGame } from "../lib/matcher";
import { pool } from "../lib/neon.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Echten Cardmarket-Katalog aus Neon laden (ohne die "kein Treffer"-Markierten)
 // Kompletten Katalog laden – inкl. game-Spalte, damit wir pro Spiel filtern können.
  const catalogResult = await pool.query(
    `SELECT id, tcgplayer_name AS name, game
       FROM sealed_mapping
      WHERE tcg_no_match = false
        AND tcgplayer_name IS NOT NULL`,
  );
  const FULL_CATALOG = catalogResult.rows;

  // Pro Spiel einen Teil-Katalog vorbereiten (einmal, nicht pro Produkt).
  const catalogByGame = {};
  for (const row of FULL_CATALOG) {
    const g = row.game || "pokemon";
    (catalogByGame[g] = catalogByGame[g] || []).push(row);
  }

  // Produkte aus dem Shop holen (nur Titel reicht fürs Matching)

  // Produkte aus dem Shop holen (nur Titel reicht fürs Matching)
  const response = await admin.graphql(
    `#graphql
      query getProducts {
        products(first: 50) {
          edges { node { id title } }
        }
      }`,
  );
  const data = await response.json();
  const products = data.data.products.edges.map((e) => e.node);

  // Jedes Shop-Produkt durch den Matcher schicken
  const results = products.map((p) => {
    // Spiel aus dem Namen erkennen; passenden Teil-Katalog wählen.
    // Unklar → gegen den gesamten Katalog matchen (Rückfall).
    const game = detectGame(p.title);
    const catalog = game ? (catalogByGame[game] || []) : FULL_CATALOG;
    const r = matchProduct(p.title, catalog);
    let stufe;
    if (r.confidence >= 95) stufe = "auto";
    else if (r.confidence >= 70) stufe = "pruefen";
    else stufe = "manuell";
    return {
      shopTitle: p.title,
      matchName: r.match ? r.match.name : null,
      confidence: r.confidence,
      stufe,
    };
  });

  // Nach Confidence sortieren (beste zuerst)
  results.sort((a, b) => b.confidence - a.confidence);

  const auto = results.filter((r) => r.stufe === "auto").length;
  const pruefen = results.filter((r) => r.stufe === "pruefen").length;
  const manuell = results.filter((r) => r.stufe === "manuell").length;

  return { results, counts: { auto, pruefen, manuell } };
};

function badgeTone(stufe) {
  if (stufe === "auto") return "success";
  if (stufe === "pruefen") return "warning";
  return "neutral";
}

function stufeLabel(stufe) {
  if (stufe === "auto") return "Auto";
  if (stufe === "pruefen") return "Prüfen";
  return "Manuell";
}

export default function Matching() {
  const { results, counts } = useLoaderData();

  return (
    <s-page heading="Produkt-Matching">
      <s-section heading="Ergebnis">
        <s-stack direction="inline" gap="base">
          <s-badge tone="success">{counts.auto} automatisch</s-badge>
          <s-badge tone="warning">{counts.pruefen} zu prüfen</s-badge>
          <s-badge tone="neutral">{counts.manuell} manuell</s-badge>
        </s-stack>
      </s-section>

      <s-section heading={`${results.length} Produkte abgeglichen`}>
        <s-table>
          <s-table-header-row>
            <s-table-header>Shop-Produkt</s-table-header>
            <s-table-header>Treffer</s-table-header>
            <s-table-header>Sicherheit</s-table-header>
            <s-table-header>Stufe</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {results.map((r, i) => (
              <s-table-row key={i}>
                <s-table-cell>{r.shopTitle}</s-table-cell>
                <s-table-cell>{r.matchName ?? "—"}</s-table-cell>
                <s-table-cell>{r.confidence}%</s-table-cell>
                <s-table-cell>
                  <s-badge tone={badgeTone(r.stufe)}>
                    {stufeLabel(r.stufe)}
                  </s-badge>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}