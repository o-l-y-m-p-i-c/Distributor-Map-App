/** @param {string} url @param {RequestInit} [options] */
export const fetchWithIdToken = async (url, options = {}) => {
  const token = await shopify.auth.idToken();
  if (!token) throw new Error('Shopify authentication token unavailable');
  return fetch(url, {...options, headers: {...options.headers, Authorization: `Bearer ${token}`}});
};

/** @returns {Promise<string>} URL of Content → Files in the merchant's Shopify admin */
export const getFilesUrl = async () => {
  try {
    const token = await shopify.auth.idToken();
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const handle = String(new URL(payload.dest).hostname).replace(/\.myshopify\.com$/, '');
    return `https://admin.shopify.com/store/${handle}/content/files`;
  } catch {
    return '';
  }
};
