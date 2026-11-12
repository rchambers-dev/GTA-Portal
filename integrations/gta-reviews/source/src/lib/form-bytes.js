export async function fetchFormBytes(urls, errorMessage) {
  let lastError = null;
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
      lastError = new Error(errorMessage);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(errorMessage);
}
