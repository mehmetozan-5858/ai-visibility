const STORAGE_KEY="aiv_launch_qa_status_v1";

function normalize(value){
  const v=value&&typeof value==="object"?value:{};
  return {
    stage5At:typeof v.stage5At==="string"?v.stage5At:"",
    stage6At:typeof v.stage6At==="string"?v.stage6At:""
  };
}

export function readLaunchQaStatus(){
  if(typeof window==="undefined")return normalize(null);
  try{return normalize(JSON.parse(window.localStorage.getItem(STORAGE_KEY)||"{}"));}
  catch{return normalize(null);}
}

export function markLaunchQaStage(stage){
  if(typeof window==="undefined")return normalize(null);
  const current=readLaunchQaStatus();
  const at=new Date().toISOString();
  const next={...current,[stage==="stage6"?"stage6At":"stage5At"]:at};
  try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{}
  return next;
}

export function formatLaunchQaTime(value){
  if(!value)return "";
  try{return new Intl.DateTimeFormat("tr-TR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value));}
  catch{return value;}
}

export {STORAGE_KEY as LAUNCH_QA_STORAGE_KEY};
