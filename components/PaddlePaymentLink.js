"use client";
import Script from 'next/script';
import {useState} from 'react';
import {initializePaymentLink,validPaddleTransaction} from '../lib/paddle-payment-link.mjs';

export default function PaddlePaymentLink({ready=false,transactionId=''}){
 const [message,setMessage]=useState('Güvenli ödeme ekranı hazırlanıyor.');
 if(!validPaddleTransaction(transactionId))return <p role="status">Ödeme bağlantısı eksik veya geçersiz. Size gönderilen bağlantıyı kullanın.</p>;
 if(!ready)return <p role="status">Kartla ödeme henüz kullanıma açık değil. Lütfen destek ekibiyle iletişime geçin.</p>;
 function initialize(){
  try{
   const ok=initializePaymentLink({ready,transactionId,clientToken:process.env.NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN||'',paddle:window.Paddle});
   setMessage(ok?'Ödemenizi Paddle’ın güvenli penceresinde kontrol edin. Bu sayfanın açılması ödeme onayı değildir.':'Güvenli ödeme ekranı açılamadı. Lütfen destek ekibiyle iletişime geçin.');
  }catch{setMessage('Güvenli ödeme ekranı açılamadı. Lütfen destek ekibiyle iletişime geçin.')}
 }
 return <><p role="status">{message}</p><Script id="paddle-payment-link" src="https://cdn.paddle.com/paddle/v2/paddle.js" onReady={initialize} onError={()=>setMessage('Güvenli ödeme ekranı yüklenemedi. Lütfen daha sonra tekrar deneyin.')}/></>;
}
