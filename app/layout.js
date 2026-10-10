import "./globals.css";
import "./mobile-dashboard.css";
import DemoReportGate from "../components/DemoReportGate";
import {LanguageProvider} from "../components/LanguageProvider";

export const metadata={
  metadataBase:new URL("https://www.aivisibilityworks.com"),
  title:{default:"AI Visibility | Yapay Zekâ Görünürlük Platformu",template:"%s | AI Visibility"},
  description:"Markanızın ChatGPT, Google AI ve diğer yapay zekâ platformlarındaki görünürlüğünü ölçün, kanıtlarla doğrulayın ve büyüme fırsatlarını aksiyona dönüştürün.",
  applicationName:"AI Visibility",
  keywords:["AI visibility","GEO","AEO","yapay zekâ görünürlüğü","AI search visibility","brand visibility"],
  alternates:{canonical:"/"},
  openGraph:{
    title:"AI Visibility | Yapay Zekâ Görünürlük Platformu",
    description:"Markanızın yapay zekâ platformlarındaki görünürlüğünü ölçün, kanıtlarla doğrulayın ve aksiyona dönüştürün.",
    url:"https://www.aivisibilityworks.com",
    siteName:"AI Visibility",
    locale:"tr_TR",
    type:"website"
  },
  twitter:{
    card:"summary_large_image",
    title:"AI Visibility | Yapay Zekâ Görünürlük Platformu",
    description:"Markanızın yapay zekâ platformlarındaki görünürlüğünü ölçün, kanıtlarla doğrulayın ve aksiyona dönüştürün."
  },
  robots:{index:true,follow:true}
};

export default function RootLayout({children}){
  return <html lang="tr" suppressHydrationWarning><body><LanguageProvider><DemoReportGate/>{children}</LanguageProvider></body></html>;
}
