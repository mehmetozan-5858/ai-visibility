import "./globals.css";
import "./mobile-dashboard.css";
import DemoReportGate from "../components/DemoReportGate";
export const metadata={title:"AI Visibility",description:"GEO/AEO executive dashboard"};
export default function RootLayout({children}){return <html lang="tr"><body><DemoReportGate/>{children}</body></html>}