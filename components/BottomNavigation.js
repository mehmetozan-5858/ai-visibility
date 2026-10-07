"use client";
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {useLanguage} from './LanguageProvider';
const links=[['/admin','⌂','home'],['/musteriler','♙','clients'],['/isletme-hesabi','◎','business'],['/taramalar','⌕','scans'],['/raporlar','▥','reports'],['/ajanlar','⌘','agents'],['/ayarlar','⚙','settings']];
const secondary=new Set(['business','agents','settings']);
const tools=[['/lead-finder','⌕','leadFinder'],['/yanit-kanitlari','◉','answerEvidence'],['/bekleyen-isler','✓','pendingWork']];
const matches=(path,href)=>path===href||path.startsWith(href+'/');
export default function BottomNavigation(){
 const pathname=usePathname()||'',{t}=useLanguage(),dialog=useRef(null),trigger=useRef(null),[open,setOpen]=useState(false);
 const extra=[...links.filter(x=>secondary.has(x[2])),...tools],extraActive=extra.some(x=>matches(pathname,x[0]));
 function close(){dialog.current?.close()}
 useEffect(()=>{close()},[pathname]);
 useEffect(()=>{const media=window.matchMedia('(min-width:721px)'),changed=()=>{if(media.matches)close()};media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed)},[]);
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[open]);
 return <><nav className="bottom-nav admin-bottom-nav" aria-label={t('mainNavigation')}>{links.map(([href,icon,key])=>{const active=matches(pathname,href);return <a href={href} key={href} className={[secondary.has(key)?'nav-secondary':'',active?'active':''].filter(Boolean).join(' ')} aria-current={active?'page':undefined}><b aria-hidden="true">{icon}</b><span>{t(key)}</span></a>})}<button type="button" ref={trigger} className={'nav-more'+(extraActive?' active':'')} aria-haspopup="dialog" aria-expanded={open} aria-controls="admin-more-navigation" onClick={()=>{dialog.current?.showModal();setOpen(true)}}><b aria-hidden="true">•••</b><span>{t('more')}</span></button></nav><dialog id="admin-more-navigation" className="admin-nav-dialog" ref={dialog} aria-labelledby="admin-more-title" onClose={()=>{setOpen(false);trigger.current?.focus()}} onClick={e=>{if(e.target===e.currentTarget)close()}}><header><h2 id="admin-more-title">{t('moreSections')}</h2><button type="button" onClick={close} aria-label={t('closeNavigation')}>×</button></header><div className="admin-nav-links">{extra.map(([href,icon,key])=><a href={href} key={href} className={matches(pathname,href)?'active':''} aria-current={matches(pathname,href)?'page':undefined} onClick={close}><b aria-hidden="true">{icon}</b><span>{t(key)}</span><span aria-hidden="true">→</span></a>)}</div></dialog></>;
}
