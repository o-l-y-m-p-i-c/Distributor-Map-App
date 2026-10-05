export const getIdToken = async () => {
  const token = await shopify.auth.idToken();
  if (!token) throw new Error('Shopify authentication token unavailable');
  return token;
};

/** @param {string} url @param {RequestInit} [options] */
export const fetchWithIdToken = async (url, options = {}) => {
  const token = await getIdToken();
  return fetch(url, {...options, headers: {...options.headers, Authorization: `Bearer ${token}`}});
};
