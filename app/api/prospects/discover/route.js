import {seedProspects} from "../../../../lib/prospects";
const STARTER=[
{name:"DentSivas Özel Diş Polikliniği ve İmplant Merkezi",domain:"",sector:"Diş Kliniği",city:"Sivas",source:"research"},
{name:"Sivas Aydent Ağız ve Diş Sağlığı Polikliniği",domain:"",sector:"Diş Kliniği",city:"Sivas",source:"research"},
{name:"Dent Bağdat Ağız ve Diş Sağlığı Polikliniği",domain:"",sector:"Diş Kliniği",city:"Sivas",source:"research"},
{name:"Asya Ağız Ve Diş Sağlığı Polikliniği",domain:"",sector:"Diş Kliniği",city:"Sivas",source:"research"},
{name:"MyBeauty Güzellik Merkezi",domain:"",sector:"Güzellik Salonu",city:"Sivas",source:"research"},
{name:"Estedermal Sivas Güzellik Salonu",domain:"",sector:"Güzellik Salonu",city:"Sivas",source:"research"},
{name:"EOSS BEAUTY SİVAS",domain:"",sector:"Güzellik Salonu",city:"Sivas",source:"research"},
{name:"KURT HOME",domain:"",sector:"Mobilya Mağazası",city:"Sivas",source:"research"},
{name:"Lusse Home Mobilya Mağazası Sivas",domain:"",sector:"Mobilya Mağazası",city:"Sivas",source:"research"},
{name:"Sivas Sultan Otel",domain:"",sector:"Otel",city:"Sivas",source:"research"},
{name:"Özkaya Otel",domain:"",sector:"Otel",city:"Sivas",source:"research"},
{name:"Beyaz İnci Otel",domain:"",sector:"Otel",city:"Sivas",source:"research"}
];
export async function POST(){try{const prospects=await seedProspects(STARTER);return Response.json({prospects,count:prospects.length,mode:process.env.DATABASE_URL?"database":"demo-only"})}catch(e){return Response.json({error:"Aday keşfi kaydedilemedi."},{status:500})}}