import PaddlePaymentLink from '../../components/PaddlePaymentLink';
import {sandboxClientToken, sandboxEnabled} from '../../lib/paddle-sandbox';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Güvenli ödeme', robots: {index: false, follow: false}, referrer: 'no-referrer'};

export default function PaddleCheckoutPage() {
  const sandbox = sandboxEnabled();
  const token = sandbox ? sandboxClientToken() : (process.env.VERCEL_ENV === 'production' ? process.env.NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN || '' : '');
  return <main style={{maxWidth:720,margin:'80px auto',padding:24}}>
    <h1>Güvenli ödeme</h1>
    <p>Ödeme pencereniz açılmıyorsa bağlantınızı kontrol edin veya destek ekibimizle iletişime geçin.</p>
    <PaddlePaymentLink token={token} sandbox={sandbox}/>
  </main>;
}
