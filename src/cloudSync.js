import { supabase } from "./supabase";

/* Sincronizza scalette + libreria (metadati) su Supabase.
   I byte degli allegati PDF/MP3 NON vengono inviati: restano sul dispositivo. */

function stripSongs(arr){
  return (arr||[]).map(s=>{ const { pdfData, mp3Data, ...rest } = s; return rest; });
}
function stripAttachments(data){
  return {
    setlists:(data.setlists||[]).map(sl=>({ ...sl, songs:stripSongs(sl.songs) })),
    library:stripSongs(data.library),
  };
}
// raccoglie i byte degli allegati presenti in locale, per id brano
function collectLocalAttachments(local){
  const map={};
  const add=(arr)=>(arr||[]).forEach(s=>{
    if(s&&s.id&&(s.pdfData||s.mp3Data))
      map[s.id]={pdfData:s.pdfData||null,pdfName:s.pdfName||null,mp3Data:s.mp3Data||null,mp3Name:s.mp3Name||null};
  });
  (local&&local.setlists||[]).forEach(sl=>add(sl.songs));
  add(local&&local.library);
  return map;
}
// reinnesta i byte locali sulla struttura ricevuta dal cloud (per id)
function graft(data, map){
  const g=(arr)=>(arr||[]).map(s=>{
    const a=map[s.id];
    return a?{ ...s, pdfData:a.pdfData, mp3Data:a.mp3Data, pdfName:s.pdfName||a.pdfName, mp3Name:s.mp3Name||a.mp3Name }:s;
  });
  return { setlists:(data.setlists||[]).map(sl=>({ ...sl, songs:g(sl.songs) })), library:g(data.library) };
}
// unione: aggiunge a base gli elementi di extra con id non già presenti
function mergeMissing(base, extra){
  const ids=new Set((base||[]).map(x=>x&&x.id));
  return [ ...(base||[]), ...((extra||[]).filter(x=>x&&x.id&&!ids.has(x.id))) ];
}

export async function saveCloudData(userId, data){
  try{
    await supabase.from("user_data").upsert(
      { user_id:userId, data:stripAttachments(data), updated_at:new Date().toISOString() },
      { onConflict:"user_id" }
    );
    return true;
  }catch{ return false; }
}

let _t=null;
export function saveCloudDebounced(userId, data){
  clearTimeout(_t);
  _t=setTimeout(()=>saveCloudData(userId, data), 1500);
}

/* Carica i dati dal cloud al login e li riconcilia col locale.
   localOwner = id utente a cui appartengono i dati locali (null se anonimi). */
export async function loadCloudData(userId, localData, localOwner){
  const mine = localOwner==null || localOwner===userId; // i dati locali sono miei (o anonimi)
  try{
    const { data: row, error } = await supabase
      .from("user_data").select("data").eq("user_id", userId).maybeSingle();
    if(error) return { data:localData };

    if(!row){
      // niente sul cloud: migro il locale solo se è mio (o anonimo), altrimenti parto pulito
      const base = mine ? localData : { setlists:[], library:[] };
      await saveCloudData(userId, base);
      return { data: base };
    }

    const cloud = (row.data && Array.isArray(row.data.setlists))
      ? { setlists:row.data.setlists, library:row.data.library||[] }
      : { setlists:[], library:[] };

    if(!mine){
      // i dati locali sono di un altro account: adotto solo il cloud, niente unione/innesto
      return { data: cloud };
    }

    // miei: unione di sicurezza (non perdo modifiche locali non sincronizzate) + innesto allegati
    const merged = {
      setlists: mergeMissing(cloud.setlists, localData&&localData.setlists),
      library:  mergeMissing(cloud.library,  localData&&localData.library),
    };
    const grafted = graft(merged, collectLocalAttachments(localData));
    const grew = merged.setlists.length !== cloud.setlists.length
              || merged.library.length  !== cloud.library.length;
    if(grew) await saveCloudData(userId, grafted);
    return { data: grafted };
  }catch{
    return { data: localData };
  }
}
