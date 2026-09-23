export default function LocationsPage() {
  return (
    <s-page heading="Locations">
      <s-button slot="primary-action" variant="primary" href="https://distributor-map-app.onrender.com/locations">Open full location manager</s-button>
      <s-section heading="Retail network">
        <s-paragraph>Manage stores, retailers, stockists, distributors, and dealers for your storefront locator.</s-paragraph>
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Name</s-table-header>
            <s-table-header>City</s-table-header>
            <s-table-header>Status</s-table-header>
          </s-table-header-row>
          <s-table-body>
            <s-table-row>
              <s-table-cell>Locations will load after the backend is connected.</s-table-cell>
              <s-table-cell>—</s-table-cell>
              <s-table-cell><s-badge tone="neutral">Ready</s-badge></s-table-cell>
            </s-table-row>
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}
