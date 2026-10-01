import {NextResponse} from "next/server";
import {verifyAdminToken,authConfigured} from "./lib/admin-auth";

export async function proxy(req){
  if(!authConfigured())return NextResponse.next();
  const {pathname}=req.nextUrl;
  const publicPath=pathname==="/login"||pathname.startsWith("/api/auth/")||pathname.startsWith("/odeme")||pathname.startsWith("/api/payment")||pathname.startsWith("/api/paytr/");
  if(publicPath)return NextResponse.next();
  const token=req.cookies.get("ai_admin")?.value||"";
  if(await verifyAdminToken(token))return NextResponse.next();
  if(pathname.startsWith("/api/"))return Response.json({error:"Yetkisiz erişim."},{status:401});
  const url=req.nextUrl.clone();url.pathname="/login";url.search="";
  return NextResponse.redirect(url);
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)"]};
