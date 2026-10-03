import {NextResponse} from "next/server";
import {verifyAdminToken,verifyClientToken,authConfigured} from "./lib/admin-auth";

export async function proxy(req){
  if(!authConfigured())return NextResponse.next();
  const {pathname}=req.nextUrl;
  const publicPages=["/hizmetler","/hakkimizda","/iletisim","/gizlilik","/kvkk","/iptal-iade","/mesafeli-hizmet-sozlesmesi","/musteri-giris","/musteri-sifre-sifirla","/demo","/yeni-musteri"];
  const publicPath=pathname==="/login"||pathname==="/sifremi-unuttum"||publicPages.includes(pathname)||pathname==="/api/leads"||pathname.startsWith("/api/auth/")||pathname.startsWith("/api/client-auth/")||pathname.startsWith("/odeme")||pathname.startsWith("/api/payment")||pathname.startsWith("/api/paytr/");
  if(publicPath)return NextResponse.next();

  if(pathname==="/musteri-panel"||pathname.startsWith("/api/client-portal")){
    const clientToken=req.cookies.get("ai_client")?.value||"";
    if(await verifyClientToken(clientToken))return NextResponse.next();
    if(pathname.startsWith("/api/"))return Response.json({error:"Müşteri oturumu gerekli."},{status:401});
    const url=req.nextUrl.clone();url.pathname="/musteri-giris";url.search="";
    return NextResponse.redirect(url);
  }

  const token=req.cookies.get("ai_admin")?.value||"";
  if(await verifyAdminToken(token))return NextResponse.next();
  if(pathname.startsWith("/api/"))return Response.json({error:"Yetkisiz erişim."},{status:401});
  const url=req.nextUrl.clone();url.pathname="/login";url.search="";
  return NextResponse.redirect(url);
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)"]};
