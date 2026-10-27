// This opens only an existing provider transaction. It never creates a payment,
// marks an invoice paid, grants access or accepts a client-selected amount.
export function validPaddleTransaction(value){
 return typeof value==='string'&&/^txn_[a-z0-9]{26}$/.test(value);
}
export function initializePaymentLink({ready,transactionId,clientToken,paddle}={}){
 if(ready!==true||!validPaddleTransaction(transactionId)||typeof clientToken!=='string'||!clientToken.startsWith('live_'))return false;
 if(!paddle||typeof paddle.Initialize!=='function')return false;
 // Paddle.js reads _ptxn from the URL when initialized. Do not call
 // Checkout.open as well: it would override its default payment-link flow.
 if(!paddle.Initialized)paddle.Initialize({token:clientToken});
 return true;
}
