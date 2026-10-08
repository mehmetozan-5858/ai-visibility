import {createHash} from 'node:crypto';
export const replyFingerprint=body=>createHash('sha256').update(String(body)).digest('hex');
export function validateInboxReviews(input){
 if(!Array.isArray(input?.reviews)||!input.reviews.length||input.reviews.length>10)throw Error('invalid-reviews');
 const seen=new Set();
 return input.reviews.map(x=>{
  if(!x||typeof x.eventId!=='string'||!x.eventId||x.eventId.length>200||seen.has(x.eventId)||!Number.isInteger(x.version)||x.version<0||!/^([a-f0-9]{64})$/.test(x.bodyHash||''))throw Error('invalid-reviews');
  seen.add(x.eventId);
  const bounded=(value,min,max)=>{if(typeof value!=='string'||value.trim().length<min||value.length>max)throw Error('invalid-reviews');return value.trim()};
  if(!['interested','question','meeting','not-interested','opt-out','other'].includes(x.classification))throw Error('invalid-reviews');
  const draft=bounded(x.draft,0,10000);
  if(['not-interested','opt-out'].includes(x.classification)&&draft)throw Error('stop-contact-draft');
  return {eventId:x.eventId,version:x.version,bodyHash:x.bodyHash,classification:x.classification,excerpt:bounded(x.excerpt,5,500),summary:bounded(x.summary,12,2000),nextAction:bounded(x.nextAction,12,600),draft};
 });
}
export function assertReviewMatches(row,review){
 if(!row||!['awaiting-review','analyzed'].includes(row.status)||!row.matched_id||!['business','creator'].includes(row.matched_type)||row.review_reason)throw Error('unverified-message');
 if(row.draft_version!==review.version||replyFingerprint(row.body)!==review.bodyHash)throw Error('stale-message');
 if(!row.body.includes(review.excerpt))throw Error('excerpt-not-found');
}
