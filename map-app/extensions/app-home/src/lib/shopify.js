/** @param {string} url @param {RequestInit} [options] */
export const fetchWithIdToken = async (url, options = {}) => {
  const token = await shopify.auth.idToken();
  if (!token) throw new Error('Shopify authentication token unavailable');
  return fetch(url, {...options, headers: {...options.headers, Authorization: `Bearer ${token}`}});
};
