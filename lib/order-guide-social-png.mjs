import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import {renderOrderGuideSocialDraft} from './order-guide-social.mjs';

let font;
function getFont(){
 // Explicit OFL font dependency; literal path for deployment tracing.
 return font??=fontkit.create(readFileSync(join(process.cwd(),'node_modules','@fontsource','noto-sans','files','noto-sans-latin-400-normal.woff')));
}
const entities={'amp':'&','lt':'<','gt':'>','quot':'"','apos':"'"};
export function outlineOrderGuideSocialSvg(svg,face=getFont()){
 const outlined=svg.replace(/<text\b([^>]*?)>([^<]*)<\/text>/g,(_,attrs,encoded)=>{
  const attr=name=>attrs.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))?.[1];
  const value=encoded.replace(/&(amp|lt|gt|quot|apos);/g,(_,key)=>entities[key]);
  const x=Number(attr('x')),y=Number(attr('y')),size=Number(attr('font-size'));
  if(![x,y,size].every(Number.isFinite)||size<=0)throw new Error('Invalid text geometry');
  const run=face.layout(value);
  if(run.glyphs.some(g=>g.id===0))throw new Error('Missing font glyph');
  const scale=size/face.unitsPerEm;
  const advance=run.positions.reduce((sum,p)=>sum+p.xAdvance,0);
  const origin=x-(attr('text-anchor')==='middle'?advance*scale/2:0);
  const bold=attr('font-weight')==='700';
  let penX=0,penY=0;
  const paths=run.glyphs.map((glyph,i)=>{
   const p=run.positions[i];
   const d=glyph.path.toSVG();
   const result=d?'<path d="'+d+'" transform="translate('+(penX+p.xOffset)+' '+(penY+p.yOffset)+')"/>':'';
   penX+=p.xAdvance;penY+=p.yAdvance;
   return result;
  }).join('');
  if(!paths)throw new Error('Empty text outline');
  return '<g fill="#241f1b" '+(bold?'stroke="#241f1b" stroke-width="20" stroke-linejoin="round" ':'')+'transform="translate('+origin+' '+y+') scale('+scale+' '+(-scale)+')">'+paths+'</g>';
 });
 if(/<text\b/.test(outlined)||!/<path\b/.test(outlined))throw new Error('Text outline conversion failed');
 return outlined;
}
export async function exportOrderGuideSocialPng(input,{format='post'}={}){
 const svg=outlineOrderGuideSocialSvg(renderOrderGuideSocialDraft(input,{format}));
 const {default:sharp}=await import('sharp');
 return sharp(Buffer.from(svg),{limitInputPixels:3000000}).png().toBuffer();
}
