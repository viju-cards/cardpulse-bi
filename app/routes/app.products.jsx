import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

// Der loader läuft auf dem Server, BEVOR die Seite angezeigt wird.
// Er holt die ersten 50 Produkte samt Bestand aus dem Shop.
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
      query getProducts {
        products(first: 50) {
          edges {
            node {
              id
              title
              status
              totalInventory
            }
          }
        }
      }`,
  );

  const data = await response.json();

  // Die Antwort kommt verschachtelt als "edges/node" – wir glätten sie
  // zu einer einfachen Liste, mit der sich leichter arbeiten lässt.
  const products = data.data.products.edges.map((edge) => edge.node);

  return { products };
};

export default function Products() {
  const { products } = useLoaderData();

  return (
    <s-page heading="Produkte aus deinem Shop">
      <s-section heading={`${products.length} Produkte gefunden`}>
        <s-table>
          <s-table-header-row>
            <s-table-header>Produkt</s-table-header>
            <s-table-header>Status</s-table-header>
            <s-table-header>Bestand</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {products.map((product) => (
              <s-table-row key={product.id}>
                <s-table-cell>{product.title}</s-table-cell>
                <s-table-cell>{product.status}</s-table-cell>
                <s-table-cell>{product.totalInventory ?? "–"}</s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}