import {renderOrderGuideSocialDraft} from './order-guide-social.mjs';

// Uses the existing Next.js optional image dependency; unavailable renderer fails closed.
export async function exportOrderGuideSocialPng(input,{format='post'}={}){
 const svg=renderOrderGuideSocialDraft(input,{format});
 const {default:sharp}=await import('sharp');
 const png=await sharp(Buffer.from(svg),{limitInputPixels:3000000}).png().toBuffer();
 return png;
}
