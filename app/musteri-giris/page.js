import CustomerLoginForm from "../../components/CustomerLoginForm";

export const metadata={
  title:"Müşteri Girişi",
  description:"AI Visibility müşteri paneline güvenli giriş yapın; raporlarınızı, görünürlük skorlarınızı ve aksiyon planlarınızı takip edin.",
  alternates:{canonical:"/musteri-giris"},
  robots:{index:false,follow:false}
};

export default function Page(){return <main><CustomerLoginForm/></main>}
