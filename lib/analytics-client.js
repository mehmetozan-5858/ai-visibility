export function trackAnalyticsEvent(name,params={}){
  if(typeof window==="undefined"||window.__aivAnalyticsAllowed!==true||typeof window.gtag!=="function")return false;
  const safeName=String(name||"").replace(/[^a-zA-Z0-9_]/g,"").slice(0,40);
  if(!safeName)return false;
  window.gtag("event",safeName,params);
  return true;
}
