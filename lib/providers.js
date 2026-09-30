export const PROVIDERS=["ChatGPT","Gemini","Perplexity"];
export function providerStatus(){return PROVIDERS.map(name=>({name,status:"not-connected"}))}
export async function runProviderCheck(){throw new Error("Live provider not configured. Demo mode is active.")}
