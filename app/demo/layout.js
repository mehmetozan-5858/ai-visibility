export const metadata={
  title:{absolute:"AI Visibility Demo | Örnek Müşteri Paneli"},
  description:"AI Visibility müşteri panelinin örnek görünümünü inceleyin; görünürlük skorları, öneriler ve raporlama akışını gerçek müşteri verisi olmadan keşfedin.",
  alternates:{canonical:"/demo"},
  openGraph:{
    title:"AI Visibility Demo | Örnek Müşteri Paneli",
    description:"AI Visibility müşteri panelinin örnek görünümünü inceleyin.",
    url:"https://www.aivisibilityworks.com/demo"
  }
};

const structuredData={
  "@context":"https://schema.org",
  "@type":"WebPage",
  "@id":"https://www.aivisibilityworks.com/demo#webpage",
  url:"https://www.aivisibilityworks.com/demo",
  name:"AI Visibility Demo | Örnek Müşteri Paneli",
  description:"AI Visibility müşteri panelinin örnek görünümü; görünürlük skorları, öneriler ve raporlama akışını gerçek müşteri verisi olmadan açıklar.",
  isPartOf:{"@id":"https://www.aivisibilityworks.com/#website"},
  inLanguage:"tr"
};

export default function DemoLayout({children}){
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData).replace(/</g,"\\u003c")}}/>{children}</>;
}
