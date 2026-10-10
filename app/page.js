import SitePreviewHome from "./site-preview/page";

export const metadata={
  title:"AI Visibility | Digital Visibility Intelligence",
  description:"AI arama görünürlüğünü kaynaklarla ölçün, bulguları önceliklendirin ve iyileştirme sürecini tek çalışma alanında yönetin.",
  alternates:{canonical:"/"},
  openGraph:{
    title:"AI Visibility | Digital Visibility Intelligence",
    description:"Yapay zekâ aramalarındaki görünürlüğünüzü kanıt, öncelik ve uygulanabilir aksiyonlarla yönetin.",
    type:"website"
  },
  twitter:{
    card:"summary_large_image",
    title:"AI Visibility | Digital Visibility Intelligence",
    description:"AI görünürlüğünü ölçün, kanıtlayın, önceliklendirin ve geliştirin."
  }
};

export default function Home(){return <SitePreviewHome/>}
