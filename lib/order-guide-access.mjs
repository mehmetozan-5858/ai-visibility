// Explicit pilot allowlist; disabled unless both settings are configured.
export function orderGuideAllowed(clientId,env=process.env){
 return env.ORDER_GUIDE_PREVIEW_ENABLED==='true'&&typeof clientId==='string'&&clientId.length>0&&clientId===env.ORDER_GUIDE_PREVIEW_CLIENT_ID;
}
