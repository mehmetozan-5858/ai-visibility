"use client";
import {useEffect} from "react";
export default function DemoReportGate(){
  useEffect(()=>{
    if(location.pathname!=="/demo")return;
    let timer;
    const gate=()=>{
      const buttons=[...document.querySelectorAll("button")];
      const reportBtn=buttons.find(b=>/Rapor Örneği|★ Rapor/.test(b.textContent||""));
      if(reportBtn)reportBtn.textContent="★ Rapor";
      const h2=[...document.querySelectorAll("h2")].find(x=>(x.textContent||"").trim()==="Rapor Örneği");
      if(!h2)return;
      const panel=h2.closest("section");
      if(!panel||panel.dataset.proGated)return;
      panel.dataset.proGated="1";
      panel.style.position="relative";
      panel.style.overflow="hidden";
      panel.style.minHeight="390px";
      [...panel.children].forEach(el=>{el.style.filter="blur(7px)";el.style.opacity=".28";el.style.pointerEvents="none";});
      const gateBox=document.createElement("div");
      gateBox.style.cssText="position:absolute;inset:0;display:grid;place-items:center;padding:24px;background:linear-gradient(180deg,rgba(4,14,24,.12),rgba(4,14,24,.84));z-index:5";
      gateBox.innerHTML='<div class="content-plan" style="max-width:520px;text-align:center;padding:24px"><div style="font-size:34px;margin-bottom:8px">★ 🔒</div><h2 style="margin-bottom:8px">Pro Raporu</h2><p>Tam rapor Pro müşterilere özeldir. Pro olduğunda tüm bulguları, öncelikleri, aksiyon planını, önce/sonra karşılaştırmasını ve tam raporu görebilirsin.</p><a href="/yeni-musteri" style="display:inline-block;margin-top:12px;font-weight:800">Pro ile tüm raporu aç →</a></div>';
      panel.appendChild(gateBox);
    };
    const run=()=>{clearTimeout(timer);timer=setTimeout(gate,20)};
    run();
    document.addEventListener("click",run,true);
    const obs=new MutationObserver(run);obs.observe(document.body,{childList:true,subtree:true});
    return()=>{clearTimeout(timer);document.removeEventListener("click",run,true);obs.disconnect()};
  },[]);
  return null;
}
