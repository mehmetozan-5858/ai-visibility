export function integrationStatus(){
 const check=(keys)=>({configured:keys.every(key=>Boolean(process.env[key])),missing:keys.filter(key=>!process.env[key])});
 return {
  sms:check(['ADMIN_RECOVERY_PHONE','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER']),
  card:check(['PAYTR_MERCHANT_ID','PAYTR_MERCHANT_KEY','PAYTR_MERCHANT_SALT']),
  shopier:check(['SHOPIER_PRODUCTS_JSON']),
  inbox:check(['RESEND_API_KEY','RESEND_WEBHOOK_SECRET','INBOUND_EMAIL_ADDRESS']),
  cms:check(['WORDPRESS_SITE_URL','WORDPRESS_USERNAME','WORDPRESS_APPLICATION_PASSWORD']),
  budget:check(['DAILY_AI_BUDGET_USD','MONTHLY_AI_BUDGET_USD'])
 };
}
