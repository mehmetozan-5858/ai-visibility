'use client';
import Script from 'next/script';
import {useState} from 'react';

export default function PaddlePaymentLink({token, sandbox}) {
  const [error, setError] = useState('');
  if (!token || (sandbox ? !token.startsWith('test_') : !token.startsWith('live_'))) {
    return <p role="alert">Ödeme sayfası şu anda kullanılamıyor.</p>;
  }
  function initialize() {
    try {
      if (!window.Paddle) throw new Error('Paddle unavailable');
      if (sandbox) window.Paddle.Environment.set('sandbox');
      if (!window.Paddle.Initialized) window.Paddle.Initialize({token});
    } catch {
      setError('Ödeme penceresi açılamadı. Lütfen tekrar deneyin.');
    }
  }
  return <>
    <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" onReady={initialize} onError={() => setError('Ödeme penceresi yüklenemedi. Lütfen tekrar deneyin.')}/>
    {error && <p role="alert">{error}</p>}
  </>;
}
