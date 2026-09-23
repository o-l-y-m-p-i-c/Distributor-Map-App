export default function SettingsPage() {
  return (
    <s-page heading="Store locator settings">
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
