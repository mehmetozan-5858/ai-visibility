export function answerEvidenceSelection(search){
 const params=new URLSearchParams(search),client=params.get('clientId'),prospect=params.get('prospectId'),uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
 if(client&&prospect)return {type:'prospect',id:''};
 if(uuid(client))return {type:'client',id:client};
 return {type:'prospect',id:uuid(prospect)?prospect:''};
}
