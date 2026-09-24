import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/AppHome.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/pages/HomePage.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/pages/LocationsPage.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/pages/SettingsPage.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/pages/NewLocationPage.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/pages/EditLocationPage.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/pages/ImportPage.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/components/LocationForm.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}
