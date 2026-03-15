/**
 * xTracky UTM Preserver - Adiciona parâmetros da URL atual + visitor_id + click_id à URL de destino
 * @param {string} url - URL de destino para navegação
 * @returns {string} URL com parâmetros UTM e tracking anexados
 */
export function getUrlWithUtm(url: string): string {
  if (typeof window === 'undefined') return url;

  const currentParams = new URLSearchParams(window.location.search);
  const targetUrl = new URL(url, window.location.origin);

  // Copy all existing URL params
  currentParams.forEach((value, key) => {
    if (!targetUrl.searchParams.has(key)) {
      targetUrl.searchParams.set(key, value);
    }
  });

  // Always inject visitor_id and click_id (fiq_* primary, mesalar_* fallback)
  const visitorId = localStorage.getItem("fiq_visitor_id") || localStorage.getItem("mesalar_visitor_id");
  const clickId = sessionStorage.getItem("fiq_click_id") || sessionStorage.getItem("mesalar_click_id");

  if (visitorId && !targetUrl.searchParams.has("visitor_id")) {
    targetUrl.searchParams.set("visitor_id", visitorId);
  }
  if (clickId && clickId !== "organic" && !targetUrl.searchParams.has("click_id")) {
    targetUrl.searchParams.set("click_id", clickId);
  }

  return targetUrl.pathname + targetUrl.search;
}
