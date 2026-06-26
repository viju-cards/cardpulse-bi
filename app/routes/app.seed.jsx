import { useFetcher } from "react-router";
import { authenticate } from "../shopify.server";

// Test-Produkte: Mix aus sauberen und chaotischen Namen, 3 TCGs,
// plus 2 Nicht-Treffer (Mystery Box, Zubehör) für den manuellen Fall.
const TEST_PRODUCTS = [
  { title: "Prismatic Evolutions Elite Trainer Box", price: "44.90", qty: 14 },
  { title: "PRI EVO ETB englisch", price: "46.50", qty: 6 },
  { title: "Pokémon Obsidian Flames Booster Box", price: "139.00", qty: 6 },
  { title: "SV 151 Display EN", price: "159.00", qty: 9 },
  { title: "Disney Lorcana - The First Chapter - Booster Display (24)", price: "119.00", qty: 3 },
  { title: "One Piece Romance Dawn OP-01 Booster Box", price: "175.00", qty: 5 },
  { title: "Pokémon Mystery Box (eigene Zusammenstellung)", price: "29.99", qty: 20 },
  { title: "Sleeves & Toploader Bundle 100x", price: "12.99", qty: 40 },
];

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const created = [];

  for (const item of TEST_PRODUCTS) {
    // 1. Produkt anlegen
    const res = await admin.graphql(
      `#graphql
        mutation createProduct($product: ProductCreateInput!) {
          productCreate(product: $product) {
            product {
              id
              title
              variants(first: 1) { edges { node { id } } }
            }
            userErrors { field message }
          }
        }`,
      { variables: { product: { title: item.title } } },
    );
    const json = await res.json();
    const product = json.data.productCreate.product;
    if (!product) continue;

    // 2. Preis der Standard-Variante setzen
    const variantId = product.variants.edges[0].node.id;
    await admin.graphql(
      `#graphql
        mutation setPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors { field message }
          }
        }`,
      {
        variables: {
          productId: product.id,
          variants: [{ id: variantId, price: item.price }],
        },
      },
    );

    created.push({ title: product.title, price: item.price });
  }

  return { created };
};

export default function Seed() {
  const fetcher = useFetcher();
  const isLoading = ["loading", "submitting"].includes(fetcher.state);
  const seed = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="Test-Produkte anlegen">
      <s-section heading="TCG-Sealed-Produkte für Tests">
        <s-paragraph>
          Legt 8 Test-Produkte an (Pokémon, Lorcana, One Piece) – teils mit
          sauberen, teils mit chaotischen Namen, plus 2 Nicht-Treffer. Nur im
          Dev-Store verwenden.
        </s-paragraph>
        <s-button
          onClick={seed}
          {...(isLoading ? { loading: true } : {})}
        >
          Test-Produkte anlegen
        </s-button>

        {fetcher.data?.created && (
          <s-section heading={`${fetcher.data.created.length} Produkte angelegt`}>
            <s-unordered-list>
              {fetcher.data.created.map((p, i) => (
                <s-list-item key={i}>
                  {p.title} — {p.price} €
                </s-list-item>
              ))}
            </s-unordered-list>
          </s-section>
        )}
      </s-section>
    </s-page>
  );
}