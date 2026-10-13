export function exactPaytrAmountMatches(payment,totalAmount){
  if(payment?.currency!=="TRY"||typeof totalAmount!=="string"||!/^[0-9]+$/.test(totalAmount))return false;
  const amount=Number(totalAmount);
  const setup=Number(payment.setupAmount),monthly=Number(payment.monthlyAmount);
  if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(setup)||!Number.isSafeInteger(monthly)||setup<0||monthly<0)return false;
  const expected=(setup+monthly)*100;
  return Number.isSafeInteger(expected)&&expected>0&&amount===expected;
}
