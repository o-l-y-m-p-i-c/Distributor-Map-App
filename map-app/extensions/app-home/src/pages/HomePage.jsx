export default function HomePage() {
  return (
    <s-page heading="Distributor Map">
      <s-section slot="aside" heading="Store locator">
        <s-paragraph>Manage physical retail locations and publish them to your storefront.</s-paragraph>
      </s-section>
      <s-section heading="Location management">
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-box padding="base" background="subdued" border="base" borderRadius="base">
            <s-heading>Locations</s-heading>
            <s-paragraph>Add stores, stockists, distributors, and dealers.</s-paragraph>
            <s-button href="/locations">Open locations</s-button>
          </s-box>
          <s-box padding="base" background="subdued" border="base" borderRadius="base">
            <s-heading>Storefront locator</s-heading>
            <s-paragraph>Configure the map and add the Store Locator block to your theme.</s-paragraph>
            <s-button href="/settings">Open settings</s-button>
          </s-box>
        </s-grid>
      </s-section>
      <s-section heading="Next steps">
        <s-unordered-list>
          <s-list-item>Create your first location.</s-list-item>
          <s-list-item>Set the search radius and visible contact fields.</s-list-item>
          <s-list-item>Add the Store Locator block in the Theme Editor.</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
