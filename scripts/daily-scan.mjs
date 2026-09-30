const now=new Date().toISOString();
console.log(JSON.stringify({ok:true,mode:"demo",task:"daily-visibility-scan",time:now,message:"Provider keys are not configured; no paid calls or outbound messages were made."},null,2));
