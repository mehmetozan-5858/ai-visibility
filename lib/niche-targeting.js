// Sector fit is a routing preference, not evidence of a visibility defect.
export const NICHE_SECTORS=[
 'CNC / Hassas Talaşlı İmalat',
 'Makine / Endüstriyel Ekipman Üretimi',
 'Endüstriyel Yedek Parça Üretimi',
 'Ambalaj / Paketleme Üretimi',
 'Test / Kalibrasyon Laboratuvarı',
 'Endüstriyel Test / Analiz Laboratuvarı',
 'Sertifikasyon / Uygunluk Değerlendirme',
 'Teknik / Mühendislik Danışmanlığı'
];
export const NICHE_PATTERN='cnc|talaşlı|hassas.*imalat|makine|machin|industrial equipment|yedek parça|spare parts|ambalaj|packaging|kalibrasyon|calibration|laboratuvar|laboratory|laboratories|sertifikasyon|certification|uygunluk değerlendirme|conformity assessment|teknik.*danışman|technical consulting|mühendislik.*danışman|engineering consult';
export function nicheFit(sector='',source=''){return new RegExp(NICHE_PATTERN,'i').test(String(sector))||String(source).startsWith('specialist-evidence: ')}
export function nicheSearchSector(slot,index=0){
 // Four focused hours, then one broad exploration hour. Rotate all eight niches.
 if(((slot%5)+5)%5===4)return '';
 return NICHE_SECTORS[((Math.floor(slot/5)*4+(slot%5))*3+index)%NICHE_SECTORS.length];
}
