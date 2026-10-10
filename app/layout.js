import "./globals.css";
import "./mobile-dashboard.css";
import "./professional-public.css";
import DemoReportGate from "../components/DemoReportGate";
import {LanguageProvider} from "../components/LanguageProvider";
export const metadata={title:"AI Visibility",description:"GEO/AEO executive dashboard"};
export default function RootLayout({children}){return <html lang="tr" suppressHydrationWarning><body><LanguageProvider><DemoReportGate/>{children}</LanguageProvider></body></html>}
