export default function SettingsPage() {
  return (
    <s-page heading="Store locator settings">
      <s-button slot="primary-action" variant="primary" href="https://distributor-map-app.onrender.com/settings">Open full settings</s-button>
      <s-section heading="Storefront display">
        <s-paragraph>Configure map style, search radius, geolocation, contact fields, and location card visibility.</s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-badge tone="success">Store Locator extension deployed</s-badge>
          <s-badge tone="neutral">OpenFreeMap</s-badge>
        </s-stack>
      </s-section>
    </s-page>
  );
}
