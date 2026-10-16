const SUPPORTED_CURRENCIES=new Set(['TRY','EUR','GBP','USD']);
const MONTHLY_KINDS=new Set(['monthly']);

export function minorUnitAmount(amount,currency){
  const code=String(currency||'').toUpperCase();
  if(!SUPPORTED_CURRENCIES.has(code))throw Error('unsupported-currency');
  const n=Number(amount);
  if(!Number.isFinite(n)||n<=0)throw Error('invalid-amount');
  return String(Math.round(n*100));
}

export function buildPaddleTransactionPayload({plan,payment,clientId,taxCategory='saas'}={}){
  if(!plan?.code||!plan?.name||!payment?.id||!clientId)throw Error('invalid-checkout-context');
  const currency=String(plan.currency||'').toUpperCase();
  const amount=minorUnitAmount(plan.firstPayment,currency);
  const recurring=MONTHLY_KINDS.has(String(plan.kind||''));
  const price={
    description:`AI Visibility ${plan.code}`.slice(0,500),
    name:String(plan.name).slice(0,150),
    billing_cycle:recurring?{interval:'month',frequency:1}:null,
    tax_mode:'internal',
    unit_price:{amount,currency_code:currency},
    product:{
      name:String(plan.name).slice(0,200),
      description:'Cloud-based AI visibility measurement, evidence analysis and monitoring software.',
      tax_category:String(taxCategory||'saas')
    }
  };
  return {
    items:[{quantity:1,price}],
    collection_mode:'automatic',
    enable_checkout:true,
    currency_code:currency,
    custom_data:{
      payment_id:String(payment.id),
      client_id:String(clientId),
      service:String(plan.code),
      source:'ai-visibility-production'
    }
  };
}

export async function probePaddleLiveApi({apiKey,fetchImpl=fetch,signal}={}){
  if(!apiKey)return {configured:false,reachable:false,authenticated:false,status:0,eventTypes:0};
  try{
    const response=await fetchImpl('https://api.paddle.com/event-types',{
      method:'GET',
      headers:{authorization:`Bearer ${apiKey}`,'accept':'application/json','Paddle-Version':'1'},
      signal
    });
    if(!response.ok)return {configured:true,reachable:true,authenticated:false,status:Number(response.status)||0,eventTypes:0};
    let body={};
    try{body=await response.json()}catch{}
    return {configured:true,reachable:true,authenticated:true,status:Number(response.status)||200,eventTypes:Array.isArray(body?.data)?body.data.length:0};
  }catch{
    return {configured:true,reachable:false,authenticated:false,status:0,eventTypes:0};
  }
}

export async function createPaddleLiveTransaction({apiKey,payload,fetchImpl=fetch}={}){
  if(!apiKey)throw Error('paddle-live-api-key-missing');
  const response=await fetchImpl('https://api.paddle.com/transactions',{
    method:'POST',
    headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify(payload)
  });
  let body={};
  try{body=await response.json()}catch{}
  if(!response.ok){
    const code=String(body?.error?.code||body?.error?.type||'paddle-api-error').slice(0,80);
    const error=new Error(code);error.status=response.status;throw error;
  }
  const transactionId=String(body?.data?.id||'');
  if(!/^txn_[a-z0-9]{26}$/i.test(transactionId))throw Error('invalid-paddle-transaction');
  return {transactionId,status:String(body?.data?.status||''),checkoutUrl:body?.data?.checkout?.url||null};
}
