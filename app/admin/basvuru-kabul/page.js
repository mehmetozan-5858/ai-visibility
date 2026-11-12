import Link from 'next/link';
import ApplicantIntakeConsole from '../../../components/ApplicantIntakeConsole';
export const metadata={title:'Başvuru Kabulü',robots:{index:false,follow:false,nocache:true}};
export default function Page(){return <main style={{maxWidth:860,margin:'0 auto',padding:'28px 20px 70px'}}><Link href="/admin/lansman-kontrol">← Lansman kontrolü</Link><h1>Başvuru kabulü</h1><ApplicantIntakeConsole/></main>}
