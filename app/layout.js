import "./globals.css";
import "./mobile-dashboard.css";
import "./admin-premium.css";
import "./admin-workspace-premium.css";
import "./professional-public.css";
import "./customer-portal-premium.css";
import DemoReportGate from "../components/DemoReportGate";
import {LanguageProvider} from "../components/LanguageProvider";

const explicit=String(process.env.NEXT_PUBLIC_SITE_URL||"").trim().replace(/\/$/,"");
const vercel=String(process.env.VERCEL_PROJECT_PRODUCTION_URL||"").trim();
const siteUrl=explicit||(vercel?`https://${vercel}`:"https://ai-visibility.vercel.app");

export const metadata={
  metadataBase:new URL(siteUrl),
  title:"AI Visibility",
  description:"AI görünürlüğünü kaynaklarla ölçen, bulguları önceliklendiren ve iyileştirme sürecini yöneten Digital Visibility Intelligence platformu.",
  applicationName:"AI Visibility",
  robots:{index:true,follow:true}
};

export default function RootLayout({children}){return <html lang="tr" suppressHydrationWarning><body><LanguageProvider><DemoReportGate/>{children}</LanguageProvider></body></html>}
