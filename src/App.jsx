import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";

const STORAGE_KEY = "setlist_manager_v3";
function loadData() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveData(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }
function uid() { return Math.random().toString(36).slice(2, 9); }

const KEYS   = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const KEYS_IT= ["Do","Do#","Re","Re#","Mi","Fa","Fa#","Sol","Sol#","La","La#","Si"];
const MODES  = ["Maj","min","Dom7","min7","Maj7","sus2","sus4"];
const FREE_LIMIT = 1;
const FREE_SONGS_LIMIT = 3;
const FREE_LIB_LIMIT = 3;

function displayKey(key, useItalian) {
  if (!useItalian) return key;
  const i = KEYS.indexOf(key);
  return i !== -1 ? KEYS_IT[i] : key;
}

const TAG_PRESETS = [
  { id:"rock",   label:"Rock",        color:"#e8604a" },
  { id:"blues",  label:"Blues",       color:"#4aade8" },
  { id:"jazz",   label:"Jazz",        color:"#a78bfa" },
  { id:"pop",    label:"Pop",         color:"#f472b6" },
  { id:"funk",   label:"Funk",        color:"#fb923c" },
  { id:"ballad", label:"Ballad",      color:"#34d399" },
  { id:"opener", label:"Opener",      color:"#e8c84a" },
  { id:"closer", label:"Closer",      color:"#f87171" },
  { id:"energy", label:"Alta energia",color:"#f97316" },
  { id:"slow",   label:"Lenta",       color:"#60a5fa" },
  { id:"cover",  label:"Cover",       color:"#a3e635" },
  { id:"orig",   label:"Originale",   color:"#c084fc" },
];

const CHROMATIC = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function transposeKey(key, semitones) {
  const i = CHROMATIC.indexOf(key);
  if (i === -1) return key;
  return CHROMATIC[(i + semitones + 12) % 12];
}

// Normalizza la durata in formato m:ss — riporta i secondi >= 60 nei minuti.
// Es: "9:75" -> "10:15", "9.75" -> "10:15". Da usare in onBlur (non durante la digitazione).
function normalizeDuration(d){
  if(d==null) return d;
  const raw=String(d).trim();
  if(!raw) return raw;
  const parts=raw.replace(/[.,]/g,":").split(":");
  if(parts.length<2) return raw; // niente separatore ancora: lascia digitare
  let min=parseInt(parts[0],10); if(isNaN(min)) min=0;
  let sec=parseInt(parts[1],10); if(isNaN(sec)) sec=0;
  if(sec<0) sec=0;
  if(sec>59){ min+=Math.floor(sec/60); sec=sec%60; }
  if(min<0) min=0;
  return `${min}:${String(sec).padStart(2,"0")}`;
}

function buildPrintHTML(setlist, useItalian=false) {
  const totalMin = setlist.songs.reduce((acc,s)=>{ const[m,sec]=(s.duration||"0:00").split(":").map(Number); return acc+(m||0)+(sec||0)/60; },0);
  const totalStr=`${Math.floor(totalMin)}:${String(Math.round((totalMin%1)*60)).padStart(2,"0")}`;
  const rows = setlist.songs.map((s,i)=>{
    const tags=(s.tags||[]).map(t=>{ const tp=TAG_PRESETS.find(x=>x.id===t); return tp?`<span style="background:${tp.color}22;color:${tp.color};border:1px solid ${tp.color}55;border-radius:12px;padding:1px 8px;font-size:11px;margin-right:4px">${tp.label}</span>`:""; }).join("");
    return `<tr>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd;color:#000;font-weight:700;width:32px">${i+1}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd;font-weight:600;color:#000">${s.title}${tags?`<br><div style="margin-top:4px">${tags}</div>`:""}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd;text-align:center;font-weight:700;color:#000">${displayKey(s.key,useItalian)} ${s.mode}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd;text-align:center;color:#000">${s.bpm}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd;text-align:center;color:#000">${s.duration}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd;font-size:12px;color:#000;min-width:200px">${s.notes||""}</td>
    </tr>`;
  }).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${setlist.name}</title>
  <style>body{font-family:'Georgia',serif;max-width:800px;margin:40px auto;padding:0 20px;color:#000}h1{font-size:2.2rem;margin:0 0 6px;border-bottom:3px solid #c8a020;padding-bottom:10px;color:#000}.meta{color:#000;font-size:.9rem;margin-bottom:28px;display:flex;gap:20px}table{width:100%;border-collapse:collapse}th{text-align:left;padding:8px;border-bottom:2px solid #000;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:#000}td{color:#000}.footer{margin-top:20px;font-size:.85rem;color:#000;text-align:right;border-top:1px solid #ddd;padding-top:10px}@media print{body{margin:20px}}</style>
  </head><body>
  <h1>${setlist.name}</h1>
  <div class="meta"><span>📅 ${setlist.date}</span>${setlist.venue?`<span>📍 ${setlist.venue}</span>`:""}<span>⏱ ${totalStr} totali</span><span>🎵 ${setlist.songs.length} brani</span></div>
  <table><thead><tr><th style="text-align:left">#</th><th style="text-align:left">Brano</th><th style="text-align:center">🎵</th><th style="text-align:center">♩</th><th style="text-align:center">⏱</th><th style="text-align:left;min-width:200px">Note</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="footer">Generato con SetlistPro · ${new Date().toLocaleDateString("it-IT")}</div>
  <script>window.onload=()=>window.print();</script></body></html>`;
}

function buildShareURL(setlist) {
  const slim={...setlist,songs:setlist.songs.map(s=>({...s,pdfData:null})),history:[]};
  return `${window.location.origin}${window.location.pathname}?setlist=${btoa(unescape(encodeURIComponent(JSON.stringify(slim))))}`;
}

function parseSharedSetlist() {
  try { const raw=new URLSearchParams(window.location.search).get("setlist"); if(!raw)return null; return JSON.parse(decodeURIComponent(escape(atob(raw)))); }
  catch { return null; }
}

const defaultSetlist = () => ({
  id:uid(), name:"Il mio primo live", date:new Date().toISOString().slice(0,10), venue:"",
  songs:[
    {id:uid(),title:"Brano 1",key:"A",mode:"min",bpm:120,duration:"3:30",notes:"",tags:[],pdfName:null,pdfData:null},
    {id:uid(),title:"Brano 2",key:"E",mode:"Maj",bpm:96, duration:"4:00",notes:"",tags:[],pdfName:null,pdfData:null},
  ], history:[]
});

const defaultLibSong = () => ({ id:uid(),title:"",key:"C",mode:"Maj",bpm:120,duration:"3:00",notes:"",tags:[],pdfName:null,pdfData:null });

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ic=({d,size=18})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>);
const IcPlus    =({size=18})=><Ic size={size} d="M12 5v14M5 12h14"/>;
const IcTrash   =()=><Ic d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>;
const IcPDF     =({size=18})=><Ic size={size} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8"/>;
const IcGrip    =()=><Ic d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/>;
const IcEdit    =()=><Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>;
const IcList    =()=><Ic d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>;
const IcMusic   =({size=18})=><Ic size={size} d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>;
const IcClock   =({size=18})=><Ic size={size} d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2"/>;
const IcStar    =({size=18,fill=false})=><svg width={size} height={size} viewBox="0 0 24 24" fill={fill?"currentColor":"none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
const IcChevL   =()=><Ic d="M15 18l-6-6 6-6"/>;
const IcChevR   =()=><Ic d="M9 18l6-6-6-6"/>;
const IcX       =({size=18})=><Ic size={size} d="M18 6L6 18M6 6l12 12"/>;
const IcLeft    =()=><Ic d="M19 12H5M12 5l-7 7 7 7"/>;
const IcRight   =()=><Ic d="M5 12h14M12 19l7-7-7-7"/>;
const IcPlay    =({size=18})=><Ic size={size} d="M5 3l14 9-14 9V3z"/>;
const IcPause   =({size=18})=><Ic size={size} d="M6 4h4v16H6zM14 4h4v16h-4z"/>;
const IcStage   =({size=18})=><Ic size={size} d="M2 20h20M4 20V10l8-7 8 7v10M10 20v-6h4v6"/>;
const IcUser    =({size=18})=><Ic size={size} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>;
const IcMetro   =({size=18})=><Ic size={size} d="M6 21L9.5 3h5L18 21z M4 21h16 M12 21l3-13 M12.3 15l2.4-1"/>;
const IcSkipR   =({size=18})=><Ic size={size} d="M5 4l10 8-10 8V4zM19 5v14"/>;
const IcSkipL   =({size=18})=><Ic size={size} d="M19 20L9 12l10-8v16zM5 19V5"/>;
const IcReset   =({size=18})=><Ic size={size} d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>;
const IcBook    =({size=18})=><Ic size={size} d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/>;
const IcHistory =({size=18})=><Ic size={size} d="M12 8v4l3 3M3.05 11a9 9 0 1 0 .5-3M3 4v4h4"/>;
const IcSearch  =({size=18})=><Ic size={size} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>;
const IcImport  =({size=18})=><Ic size={size} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>;
const IcCheck   =({size=18})=><Ic size={size} d="M20 6L9 17l-5-5"/>;
const IcPrint   =({size=18})=><Ic size={size} d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6v-8z"/>;
const IcShare2  =({size=18})=><Ic size={size} d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>;
const IcTranspose=({size=18})=><Ic size={size} d="M4 6h16M4 12h10M4 18h4M15 15l3 3 3-3M18 18V9"/>;
const IcMp3    =({size=18})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>);

// ── PDF VIEWER ────────────────────────────────────────────────────────────────
function PDFViewer({song,onClose}){
  const canvasRef=useRef(null),renderTaskRef=useRef(null);
  const [pdfDoc,setPdfDoc]=useState(null),[page,setPage]=useState(1),[numPages,setNumPages]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(null);
  useEffect(()=>{
    const load=async()=>{
      if(!window.pdfjsLib){await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";}
      try{const b64=song.pdfData.split(",")[1],bin=atob(b64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);const doc=await window.pdfjsLib.getDocument({data:bytes}).promise;setPdfDoc(doc);setNumPages(doc.numPages);setLoading(false);}
      catch(e){setError("Impossibile aprire: "+e.message);setLoading(false);}
    };load();
  },[song.pdfData]);
  useEffect(()=>{
    if(!pdfDoc||!canvasRef.current)return;
    const canvas=canvasRef.current;
    const render=async()=>{if(renderTaskRef.current){try{renderTaskRef.current.cancel();}catch{}}const p=await pdfDoc.getPage(page);const vp=p.getViewport({scale:1});const cssWidth=canvas.parentElement?.clientWidth||600;const cssScale=cssWidth/vp.width;const dpr=window.devicePixelRatio||1;const renderScale=cssScale*Math.max(2,dpr*1.5);const scaled=p.getViewport({scale:renderScale});const cssVp=p.getViewport({scale:cssScale});canvas.width=Math.floor(scaled.width);canvas.height=Math.floor(scaled.height);canvas.style.width=Math.floor(cssVp.width)+"px";canvas.style.height=Math.floor(cssVp.height)+"px";const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=true;const task=p.render({canvasContext:ctx,viewport:scaled});renderTaskRef.current=task;try{await task.promise;}catch{}};
    render();
  },[pdfDoc,page]);
  return(<div className="pdf-overlay" onClick={onClose}><div className="pdf-modal" onClick={e=>e.stopPropagation()}><div className="pdf-modal-header"><div className="pdf-modal-title"><IcPDF size={15}/><span>{song.pdfName}</span></div><div style={{display:"flex",alignItems:"center",gap:8}}>{numPages>1&&<div className="pdf-nav"><button className="btn-icon" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}><IcLeft/></button><span className="pdf-page-info">{page}/{numPages}</span><button className="btn-icon" onClick={()=>setPage(p=>Math.min(numPages,p+1))} disabled={page>=numPages}><IcRight/></button></div>}<button className="btn-icon" onClick={onClose}><IcX size={20}/></button></div></div><div className="pdf-canvas-wrap">{loading&&<div className="pdf-status"><div className="pdf-spinner"/><span>Caricamento…</span></div>}{error&&<div className="pdf-status pdf-error"><IcPDF size={32}/><span>{error}</span></div>}{!loading&&!error&&<canvas ref={canvasRef} className="pdf-canvas"/>}</div></div></div>);
}

// ── TAG ───────────────────────────────────────────────────────────────────────
function TagPill({tagId,onRemove}){const t=TAG_PRESETS.find(x=>x.id===tagId);if(!t)return null;return(<span className="tag-pill" style={{"--tc":t.color}}>{t.label}{onRemove&&<button onClick={()=>onRemove(tagId)} className="tag-remove">×</button>}</span>);}
function TagPicker({selected,onChange}){return(<div className="tag-picker">{TAG_PRESETS.map(t=>(<button key={t.id} className={`tag-option${selected.includes(t.id)?" selected":""}`} style={{"--tc":t.color}} onClick={()=>onChange(selected.includes(t.id)?selected.filter(x=>x!==t.id):[...selected,t.id])}>{selected.includes(t.id)&&<IcCheck size={11}/>} {t.label}</button>))}</div>);}

// ── MP3 PLAYER ────────────────────────────────────────────────────────────────
function MP3Player({song,onUpdate,isPro}){
  const audioRef=useRef(null),fileRef=useRef(null);
  const [playing,setPlaying]=useState(false),[progress,setProgress]=useState(0),[duration,setDuration]=useState(0);
  useEffect(()=>{if(audioRef.current){audioRef.current.pause();audioRef.current.load();setPlaying(false);setProgress(0);setDuration(0);}},[song.mp3Data]);
  const togglePlay=()=>{if(!audioRef.current)return;if(playing){audioRef.current.pause();setPlaying(false);}else{audioRef.current.play();setPlaying(true);}};
  const openExternal=()=>{if(!song.mp3Data)return;const a=document.createElement("a");a.href=song.mp3Data;a.target="_blank";a.click();};
  const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  if(!isPro)return(<div className="mp3-player mp3-locked"><IcMp3 size={14}/><span className="mp3-name">MP3 disponibile nel piano PRO</span><span className="mp3-pro-badge">🔒 PRO</span></div>);
  return(<div className="mp3-player">{song.mp3Data&&(<audio ref={audioRef} src={song.mp3Data} onTimeUpdate={e=>setProgress(e.target.currentTime)} onLoadedMetadata={e=>setDuration(e.target.duration)} onEnded={()=>{setPlaying(false);setProgress(0);}}/>)}<div className="mp3-player-top"><IcMp3 size={14}/><span className="mp3-name">{song.mp3Name||"Nessun MP3 allegato"}</span>{song.mp3Data?<><button className="mp3-play-btn" onClick={togglePlay}>{playing?<IcPause size={15}/>:<IcPlay size={15}/>}</button><span className="mp3-time">{fmt(progress)}{duration>0&&` / ${fmt(duration)}`}</span><button className="btn-text" onClick={openExternal}>↗ Esterno</button><button className="btn-text red" onClick={()=>onUpdate({...song,mp3Name:null,mp3Data:null})}>Rimuovi</button></>:(<button className="btn-text" onClick={()=>fileRef.current.click()}>+ Allega MP3</button>)}</div>{song.mp3Data&&duration>0&&(<input type="range" className="mp3-progress" min={0} max={duration} step={0.1} value={progress} onChange={e=>{if(audioRef.current){audioRef.current.currentTime=+e.target.value;setProgress(+e.target.value);}}}/>)}<input ref={fileRef} type="file" accept="audio/*" style={{display:"none"}} onChange={e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>onUpdate({...song,mp3Name:file.name,mp3Data:ev.target.result});r.readAsDataURL(file);e.target.value="";}}/>
  </div>);
}

// ── METRONOME ─────────────────────────────────────────────────────────────────
function Metronome({bpm:initialBpm, controlledRunning}){
  const isControlled=controlledRunning!==undefined;
  const [bpm,setBpm]=useState(initialBpm||120),[internalRunning,setInternalRunning]=useState(false),[beat,setBeat]=useState(0),[beatsPerBar,setBeatsPerBar]=useState(4);
  const running=isControlled?controlledRunning:internalRunning;
  useEffect(()=>{ if(initialBpm) setBpm(initialBpm); },[initialBpm]);
  const tapTimesRef=useRef([]),audioCtxRef=useRef(null),intervalRef=useRef(null);
  const getCtx=()=>{if(!audioCtxRef.current)audioCtxRef.current=new(window.AudioContext||window.webkitAudioContext)();return audioCtxRef.current;};
  const playClick=useCallback((isAccent)=>{const ctx=getCtx(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=isAccent?1200:900;gain.gain.setValueAtTime(isAccent?.7:.4,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.06);osc.start();osc.stop(ctx.currentTime+0.06);},[]);
  useEffect(()=>{if(!running){clearInterval(intervalRef.current);return;}let cb=0;const tick=()=>{playClick(cb===0);setBeat(cb);cb=(cb+1)%beatsPerBar;};tick();intervalRef.current=setInterval(tick,(60/bpm)*1000);return()=>clearInterval(intervalRef.current);},[running,bpm,beatsPerBar,playClick]);
  const tapTempo=()=>{const now=Date.now(),taps=tapTimesRef.current;taps.push(now);if(taps.length>8)taps.shift();if(taps.length>=2){const diffs=taps.slice(1).map((t,i)=>t-taps[i]);setBpm(Math.round(60000/(diffs.reduce((a,b)=>a+b,0)/diffs.length)));}};
  return(<div className="metronome"><div className="metro-header"><IcMetro size={16}/><span>Metronomo</span></div><div className="metro-beats">{Array.from({length:beatsPerBar}).map((_,i)=>(<div key={i} className={`beat-dot${running&&beat===i?" beat-active":""}${i===0?" beat-accent":""}`}/>))}</div><div className="metro-bpm-row"><button className="metro-adj" onClick={()=>setBpm(b=>Math.max(20,b-1))}>−</button><div className="metro-bpm">{bpm}<span>BPM</span></div><button className="metro-adj" onClick={()=>setBpm(b=>Math.min(300,b+1))}>+</button></div><input type="range" min={20} max={300} value={bpm} onChange={e=>setBpm(+e.target.value)} className="metro-slider"/><div className="metro-controls"><select className="metro-select" value={beatsPerBar} onChange={e=>setBeatsPerBar(+e.target.value)}>{[2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}/4</option>)}</select><button className="metro-tap" onClick={tapTempo}>TAP</button>{isControlled?(<span className="metro-synced" title="Il metronomo parte e si ferma con il timer">⏱ segue il timer</span>):(<button className={`metro-play${running?" running":""}`} onClick={()=>setInternalRunning(r=>!r)}>{running?<IcPause size={20}/>:<IcPlay size={20}/>}</button>)}</div></div>);
}

// ── STAGE MODE ────────────────────────────────────────────────────────────────
function StageMode({setlist,onClose,useItalian,isPro}){
  const [idx,setIdx]=useState(0),[elapsed,setElapsed]=useState(0),[running,setRunning]=useState(false),[showMetro,setShowMetro]=useState(false),[metroSync,setMetroSync]=useState(false);
  const intervalRef=useRef(null),song=setlist.songs[idx];
  useEffect(()=>{if(running)intervalRef.current=setInterval(()=>setElapsed(e=>e+1),1000);else clearInterval(intervalRef.current);return()=>clearInterval(intervalRef.current);},[running]);
  const goTo=(i)=>{setIdx(i);setElapsed(0);setRunning(false);};
  const fmt=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const parseDur=(d="0:00")=>{const[m,s]=d.split(":").map(Number);return(m||0)*60+(s||0);};
  const expected=parseDur(song?.duration),pct=expected>0?Math.min(1,elapsed/expected):0,over=expected>0&&elapsed>expected;
  return(<div className="stage-overlay"><button className="stage-close" onClick={onClose}><IcX size={24}/></button><div className="stage-progress-bar"><div className="stage-progress-fill" style={{width:`${pct*100}%`,background:over?"#e8604a":"#e8c84a"}}/></div><div className="stage-count">{idx+1} / {setlist.songs.length}</div><div className="stage-main"><div className="stage-song-title">{song?.title}</div><div className="stage-key">{displayKey(song?.key,useItalian)} {song?.mode}</div><div className="stage-bpm">♩ {song?.bpm} BPM</div>{song?.tags?.length>0&&<div className="stage-tags">{song.tags.map(t=><TagPill key={t} tagId={t}/>)}</div>}<div className={`stage-notes${song?.notes?"":" stage-notes-empty"}`}>{song?.notes?song.notes:<span className="stage-notes-placeholder">Nessuna nota per questo brano</span>}</div></div><div className={`stage-timer${over?" stage-timer-over":""}`}>{fmt(elapsed)}{expected>0&&<span className="stage-timer-expected"> / {fmt(expected)}</span>}</div><div className="stage-controls"><button className="stage-btn" onClick={()=>goTo(Math.max(0,idx-1))} disabled={idx===0}><IcSkipL size={28}/></button><button className="stage-btn stage-btn-main" onClick={()=>setRunning(r=>!r)}>{running?<IcPause size={36}/>:<IcPlay size={36}/>}</button><button className="stage-btn" onClick={()=>{setElapsed(0);setRunning(false);}}><IcReset size={24}/></button><button className="stage-btn" onClick={()=>goTo(Math.min(setlist.songs.length-1,idx+1))} disabled={idx===setlist.songs.length-1}><IcSkipR size={28}/></button></div><div className="stage-list">{setlist.songs.map((s,i)=>(<button key={s.id} className={`stage-list-item${i===idx?" active":""}${i<idx?" done":""}`} onClick={()=>goTo(i)}><span className="sli-num">{i+1}</span><span className="sli-title">{s.title}</span><span className="sli-key">{displayKey(s.key,useItalian)} {s.mode}</span></button>))}</div><button className="stage-metro-toggle" onClick={()=>setShowMetro(v=>!v)}><IcMetro size={16}/>{showMetro?"Nascondi":"Metronomo"}</button>{showMetro&&<div className="stage-metro-wrap"><label className="stage-metro-sync"><input type="checkbox" checked={metroSync} onChange={e=>setMetroSync(e.target.checked)}/><span>Avvia col timer ▶</span></label><Metronome bpm={song?.bpm} controlledRunning={metroSync?running:undefined}/></div>}</div>);
}

// ── HISTORY MODAL ─────────────────────────────────────────────────────────────
function HistoryModal({setlist,onUpdate,onClose}){
  const [form,setForm]=useState({date:new Date().toISOString().slice(0,10),venue:setlist.venue||"",notes:"",rating:5});
  const history=setlist.history||[];
  const addEntry=()=>{if(!form.venue&&!form.notes)return;onUpdate({...setlist,history:[{id:uid(),...form},...history]});setForm({date:new Date().toISOString().slice(0,10),venue:"",notes:"",rating:5});};
  return(<div className="modal-overlay" onClick={onClose}><div className="modal-box history-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><IcX/></button><div className="history-header"><IcHistory size={20}/><h2>Storico Live</h2></div><p className="history-sub">Tieni traccia di ogni volta che hai suonato questa scaletta.</p><div className="history-form"><div className="hf-row"><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="hf-input"/><input value={form.venue} placeholder="Venue / locale" onChange={e=>setForm(f=>({...f,venue:e.target.value}))} className="hf-input hf-grow"/></div><textarea value={form.notes} placeholder="Note post-live…" rows={2} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className="hf-textarea"/><div className="hf-row hf-bottom"><div className="rating-row">{[1,2,3,4,5].map(n=>(<button key={n} className={`star-btn${form.rating>=n?" active":""}`} onClick={()=>setForm(f=>({...f,rating:n}))}><IcStar size={20} fill={form.rating>=n}/></button>))}</div><button className="btn-add-history" onClick={addEntry}>+ Aggiungi</button></div></div><div className="history-list">{history.length===0&&<p className="history-empty">Nessun live registrato ancora.</p>}{history.map(h=>(<div key={h.id} className="history-entry"><div className="he-top"><div className="he-info"><span className="he-date">📅 {h.date}</span>{h.venue&&<span className="he-venue">📍 {h.venue}</span>}</div><div className="he-right"><div className="he-stars">{[1,2,3,4,5].map(n=><span key={n} className={`he-star${h.rating>=n?" active":""}`}>★</span>)}</div><button className="btn-icon btn-delete" onClick={()=>onUpdate({...setlist,history:history.filter(x=>x.id!==h.id)})}><IcTrash/></button></div></div>{h.notes&&<p className="he-notes">{h.notes}</p>}</div>))}</div></div></div>);
}

// ── LIBRARY ───────────────────────────────────────────────────────────────────
function Library({library,onUpdate,onClose,onAddToSetlist,isPro,useItalian}){
  const [search,setSearch]=useState(""),[filterTag,setFilterTag]=useState(null),[editId,setEditId]=useState(null),[viewingPDF,setViewingPDF]=useState(null),[libWarning,setLibWarning]=useState(false);
  const fileRefs=useRef({});
  const filtered=library.filter(s=>s.title.toLowerCase().includes(search.toLowerCase())&&(!filterTag||s.tags?.includes(filterTag)));
  const addSong=()=>{if(!isPro&&library.length>=FREE_LIB_LIMIT){setLibWarning(true);return;}const s={...defaultLibSong(),title:"Nuovo brano"};onUpdate([...library,s]);setEditId(s.id);};
  const updateSong=u=>onUpdate(library.map(s=>s.id===u.id?u:s));
  const deleteSong=id=>onUpdate(library.filter(s=>s.id!==id));
  const usedTags=[...new Set(library.flatMap(s=>s.tags||[]))];
  return(<div className="lib-overlay" onClick={onClose}><div className="lib-panel" onClick={e=>e.stopPropagation()}>{viewingPDF&&<PDFViewer song={viewingPDF} onClose={()=>setViewingPDF(null)}/>}<div className="lib-header"><div className="lib-title"><IcBook size={20}/><h2>Libreria Brani</h2></div><button className="btn-icon" onClick={onClose}><IcX size={20}/></button></div><div className="lib-toolbar"><div className="lib-search-wrap"><IcSearch size={16}/><input className="lib-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca brano…"/>{search&&<button className="lib-clear" onClick={()=>setSearch("")}><IcX size={14}/></button>}</div><button className="btn-add-lib" onClick={addSong}><IcPlus size={16}/> Nuovo</button></div>{libWarning&&(<div className="limit-banner" style={{margin:"0 20px 12px"}}><div className="limit-banner-left"><span className="limit-banner-icon">🔒</span><div className="limit-banner-text"><span className="limit-banner-title">Limite piano Free</span><span className="limit-banner-sub">Max {FREE_LIB_LIMIT} brani in libreria. Passa a PRO per illimitati.</span></div></div><div className="limit-banner-right"><button className="limit-banner-pro">PRO — €4,99</button><button className="limit-banner-close" onClick={()=>setLibWarning(false)}>×</button></div></div>)}{usedTags.length>0&&(<div className="lib-tag-filter"><button className={`tag-filter-btn${!filterTag?" active":""}`} onClick={()=>setFilterTag(null)}>Tutti</button>{usedTags.map(t=>{const tp=TAG_PRESETS.find(x=>x.id===t);return tp?(<button key={t} className={`tag-filter-btn${filterTag===t?" active":""}`} style={{"--tc":tp.color}} onClick={()=>setFilterTag(filterTag===t?null:t)}>{tp.label}</button>):null;})}</div>)}<div className="lib-list">{filtered.length===0&&<div className="lib-empty"><IcMusic size={32}/><p>Nessun brano trovato.</p></div>}{filtered.map(song=>(<div key={song.id} className={`lib-song${editId===song.id?" lib-song-open":""}`}><div className="lib-song-main"><div className="lib-song-info"><span className="lib-song-title">{song.title||"Senza titolo"}</span><span className="lib-song-key">{displayKey(song.key,useItalian)} {song.mode} · {song.bpm} BPM · {song.duration}</span>{song.tags?.length>0&&<div className="lib-tags">{song.tags.map(t=><TagPill key={t} tagId={t}/>)}</div>}</div><div className="lib-song-actions">{onAddToSetlist&&<button className="btn-lib-add" onClick={()=>onAddToSetlist(song)}><IcImport size={15}/> Usa</button>}{song.pdfName&&<button className="btn-icon btn-pdf has-pdf" onClick={()=>setViewingPDF(song)}><IcPDF/></button>}<button className="btn-icon" onClick={()=>setEditId(editId===song.id?null:song.id)}><IcEdit/></button><button className="btn-icon btn-delete" onClick={()=>deleteSong(song.id)}><IcTrash/></button></div></div>{editId===song.id&&(<div className="lib-song-edit"><div className="lib-edit-row"><input className="lib-edit-title" value={song.title} onChange={e=>updateSong({...song,title:e.target.value})} placeholder="Titolo"/><select value={song.key} onChange={e=>updateSong({...song,key:e.target.value})}>{KEYS.map((k,i)=><option key={k} value={k}>{useItalian?KEYS_IT[i]:k}</option>)}</select><select value={song.mode} onChange={e=>updateSong({...song,mode:e.target.value})}>{MODES.map(m=><option key={m}>{m}</option>)}</select><div className="meta-icon-input"><IcMusic size={13}/><input type="number" className="bpm-input" value={song.bpm} onChange={e=>updateSong({...song,bpm:+e.target.value})} placeholder="BPM"/></div><div className="meta-icon-input"><IcClock size={13}/><input className="dur-input" value={song.duration} onChange={e=>updateSong({...song,duration:e.target.value})} onBlur={e=>updateSong({...song,duration:normalizeDuration(e.target.value)})} placeholder="0:00"/></div></div><TagPicker selected={song.tags||[]} onChange={tags=>updateSong({...song,tags})}/><textarea value={song.notes} rows={3} placeholder="Note…" onChange={e=>updateSong({...song,notes:e.target.value})} className="lib-edit-notes"/><MP3Player song={song} onUpdate={updateSong} isPro={isPro}/><div className="lib-pdf-row">{song.pdfName?<div className="pdf-badge"><IcPDF/><span>{song.pdfName}</span><button className="btn-text" onClick={()=>setViewingPDF(song)}>Visualizza</button><button className="btn-text red" onClick={()=>updateSong({...song,pdfName:null,pdfData:null})}>Rimuovi</button></div>:<button className="btn-text" onClick={()=>fileRefs.current[song.id]?.click()}>+ Allega PDF</button>}<input ref={el=>fileRefs.current[song.id]=el} type="file" accept=".pdf" style={{display:"none"}} onChange={e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>updateSong({...song,pdfName:file.name,pdfData:ev.target.result});r.readAsDataURL(file);e.target.value="";}}/>
</div></div>)}</div>))}</div><div className="lib-footer">{library.length} brani in libreria</div></div></div>);
}

// ── SONG ROW ──────────────────────────────────────────────────────────────────
function SongRow({song,index,onUpdate,onDelete,onOpenPDF,isPro,onShowProBanner,useItalian,dragging,onDragStart,onDragOver,onDrop,onDragEnd}){
  const [expanded,setExpanded]=useState(false),fileRef=useRef();
  return(<div className={`song-row${dragging?" dragging":""}`} draggable onDragStart={e=>onDragStart(e,index)} onDragOver={e=>onDragOver(e,index)} onDrop={e=>onDrop(e,index)} onDragEnd={onDragEnd}><div className="song-main"><span className="grip"><IcGrip/></span><span className="song-num">{index+1}</span><div className="song-title-col"><input className="song-title" value={song.title} onChange={e=>onUpdate({...song,title:e.target.value})} placeholder="Titolo brano"/>{song.tags?.length>0&&<div className="song-inline-tags">{song.tags.map(t=><TagPill key={t} tagId={t}/>)}</div>}</div><div className="song-meta"><select value={song.key} onChange={e=>onUpdate({...song,key:e.target.value})}>{KEYS.map((k,i)=><option key={k} value={k}>{useItalian?KEYS_IT[i]:k}</option>)}</select><select value={song.mode} onChange={e=>onUpdate({...song,mode:e.target.value})}>{MODES.map(m=><option key={m}>{m}</option>)}</select><div className="meta-icon-input"><IcMusic size={13}/><input type="number" className="bpm-input" value={song.bpm} onChange={e=>onUpdate({...song,bpm:+e.target.value})} placeholder="BPM"/></div><div className="meta-icon-input"><IcClock size={13}/><input className="dur-input" value={song.duration} onChange={e=>onUpdate({...song,duration:e.target.value})} onBlur={e=>onUpdate({...song,duration:normalizeDuration(e.target.value)})} placeholder="0:00"/></div></div><div className="song-actions"><button className={`btn-icon btn-mp3${song.mp3Name?" has-mp3":""}`} title={song.mp3Name||"Allega MP3"} onClick={()=>setExpanded(true)}><IcMp3 size={16}/></button>{song.pdfName?<button className="btn-icon btn-pdf has-pdf" title={`Apri: ${song.pdfName}`} onClick={()=>onOpenPDF(song)}><IcPDF/></button>:<button className="btn-icon btn-pdf" title="Allega PDF" onClick={()=>fileRef.current.click()}><IcPDF/></button>}<button className="btn-icon" onClick={()=>setExpanded(v=>!v)}><IcEdit/></button><button className="btn-icon btn-delete" onClick={()=>onDelete(song.id)}><IcTrash/></button></div><input ref={fileRef} type="file" accept=".pdf" style={{display:"none"}} onChange={e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>onUpdate({...song,pdfName:file.name,pdfData:ev.target.result});r.readAsDataURL(file);e.target.value="";}}/>
</div>{expanded&&(<div className="song-notes"><TagPicker selected={song.tags||[]} onChange={tags=>onUpdate({...song,tags})}/><textarea value={song.notes} rows={2} onChange={e=>onUpdate({...song,notes:e.target.value})} placeholder="Note, intro, accordatura speciale…"/><MP3Player song={song} onUpdate={onUpdate} isPro={isPro}/>{song.pdfName&&(<div className="pdf-badge"><IcPDF/><span>{song.pdfName}</span><button className="btn-text" onClick={()=>onOpenPDF(song)}>📄 Visualizza</button><button className="btn-text red" onClick={()=>onUpdate({...song,pdfName:null,pdfData:null})}>Rimuovi</button></div>)}</div>)}</div>);
}

// ── MODALS ────────────────────────────────────────────────────────────────────
function PrintModal({setlist,onClose,useItalian=false}){
  const totalMin=setlist.songs.reduce((acc,s)=>{const[m,sec]=(s.duration||"0:00").split(":").map(Number);return acc+(m||0)+(sec||0)/60;},0);
  const totalStr=`${Math.floor(totalMin)}:${String(Math.round((totalMin%1)*60)).padStart(2,"0")}`;
  const doPrint=()=>{const html=buildPrintHTML(setlist,useItalian);const blob=new Blob([html],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${setlist.name.replace(/[^a-z0-9]/gi,"_")}_scaletta.html`;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),5000);};
  return(<div className="modal-overlay print-modal-overlay" onClick={onClose}><div className="modal-box print-modal-box" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><IcX/></button><div id="print-content"><div className="pm-header"><h1 className="pm-title">{setlist.name}</h1><div className="pm-meta"><span>📅 {setlist.date}</span>{setlist.venue&&<span>📍 {setlist.venue}</span>}<span>⏱ {totalStr}</span><span>🎵 {setlist.songs.length} brani</span></div></div><table className="pm-table"><thead><tr><th style={{textAlign:"left"}}>#</th><th style={{textAlign:"left"}}>Brano</th><th style={{textAlign:"center"}}>🎵</th><th style={{textAlign:"center"}}>♩</th><th style={{textAlign:"center"}}>⏱</th><th style={{textAlign:"left",minWidth:200}}>Note</th></tr></thead><tbody>{setlist.songs.map((s,i)=>(<tr key={s.id}><td className="pm-num">{i+1}</td><td className="pm-song-title">{s.title}{s.tags?.length>0&&<div className="pm-tags">{s.tags.map(t=>{const tp=TAG_PRESETS.find(x=>x.id===t);return tp?<span key={t} className="pm-tag" style={{background:tp.color+"22",color:tp.color,border:`1px solid ${tp.color}55`}}>{tp.label}</span>:null;})}</div>}</td><td className="pm-key">{displayKey(s.key,useItalian)} {s.mode}</td><td className="pm-bpm">{s.bpm}</td><td className="pm-dur">{s.duration}</td><td className="pm-notes">{s.notes||""}</td></tr>))}</tbody></table><div className="pm-footer">Generato con SetlistPro · {new Date().toLocaleDateString("it-IT")}</div></div><div className="pm-actions no-print"><button className="btn-cancel" onClick={onClose}>Chiudi</button><button className="btn-upgrade" onClick={doPrint}><IcPrint size={16}/> Scarica HTML → Apri → Stampa</button></div></div></div>);
}

function TransposeModal({setlist,onUpdate,onClose}){
  const [semitones,setSemitones]=useState(0);
  const preview=setlist.songs.map(s=>({...s,key:transposeKey(s.key,semitones)}));
  return(<div className="modal-overlay" onClick={onClose}><div className="modal-box transpose-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><IcX/></button><div className="transpose-header"><IcTranspose size={22}/><h2>Trasposizione</h2></div><p className="transpose-sub">Trasporta tutte le tonalità della scaletta in un colpo solo.</p><div className="transpose-control"><button className="metro-adj" onClick={()=>setSemitones(s=>Math.max(-11,s-1))}>−</button><div className="transpose-value"><span className="transpose-num">{semitones===0?"Originale":`${semitones>0?"+":""}${semitones} semitoni`}</span></div><button className="metro-adj" onClick={()=>setSemitones(s=>Math.min(11,s+1))}>+</button></div><input type="range" min={-11} max={11} value={semitones} onChange={e=>setSemitones(+e.target.value)} className="metro-slider"/><div className="transpose-preview">{setlist.songs.map((s,i)=>(<div key={s.id} className="tp-row"><span className="tp-title">{s.title}</span><span className="tp-keys"><span className="tp-old">{s.key} {s.mode}</span>{semitones!==0&&<><span className="tp-arrow">→</span><span className="tp-new">{preview[i].key} {s.mode}</span></>}</span></div>))}</div><div className="transpose-actions"><button className="btn-cancel" onClick={onClose}>Annulla</button><button className="btn-upgrade" onClick={()=>{onUpdate({...setlist,songs:preview});onClose();}} disabled={semitones===0}>Applica trasposizione</button></div></div></div>);
}

function ShareModal({setlist,onClose}){
  const [copied,setCopied]=useState(false);
  const url=buildShareURL(setlist);
  const copy=async()=>{try{await navigator.clipboard.writeText(url);}catch{const el=document.createElement("textarea");el.value=url;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);}setCopied(true);setTimeout(()=>setCopied(false),2500);};
  return(<div className="modal-overlay" onClick={onClose}><div className="modal-box share-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><IcX/></button><div className="share-header"><IcShare2 size={22}/><h2>Condividi Scaletta</h2></div><p className="share-sub">Chiunque abbia questo link può visualizzare la scaletta in sola lettura.</p><div className="share-url-box"><span className="share-url-text">{url.length>80?url.slice(0,80)+"…":url}</span></div><button className={`btn-copy${copied?" copied":""}`} onClick={copy}>{copied?<><IcCheck size={16}/> Copiato!</>:<><IcShare2 size={16}/> Copia link</>}</button><div className="share-info"><div className="share-info-row"><span>🎵</span><span>{setlist.songs.length} brani</span></div><div className="share-info-row"><span>📅</span><span>{setlist.date}</span></div>{setlist.venue&&<div className="share-info-row"><span>📍</span><span>{setlist.venue}</span></div>}</div></div></div>);
}

function SharedView({setlist,onDismiss}){
  return(<div className="app"><header className="app-header"><div className="logo"><IcMusic size={26}/><span>Setlist<b>Pro</b></span></div><span className="shared-badge">👁 Sola lettura</span></header><div className="shared-hero"><h1>{setlist.name}</h1><div className="shared-meta"><span>📅 {setlist.date}</span>{setlist.venue&&<span>📍 {setlist.venue}</span>}<span>🎵 {setlist.songs.length} brani</span></div></div><div className="songs-list">{setlist.songs.map((s,i)=>(<div key={s.id} className="song-row"><div className="song-main"><span className="song-num">{i+1}</span><div className="song-title-col"><span className="song-title" style={{cursor:"default"}}>{s.title}</span>{s.tags?.length>0&&<div className="song-inline-tags">{s.tags.map(t=><TagPill key={t} tagId={t}/>)}</div>}</div><div className="song-meta" style={{pointerEvents:"none"}}><span className="shared-key">{s.key} {s.mode}</span><span className="shared-bpm">{s.bpm} BPM</span><span className="shared-dur">{s.duration}</span></div></div>{s.notes&&<div className="song-notes" style={{paddingTop:8}}><p style={{fontSize:".82rem",color:"var(--muted)"}}>{s.notes}</p></div>}</div>))}</div><div className="shared-footer"><p>Vuoi creare le tue scalette?</p><button className="btn-upgrade" style={{marginTop:8}} onClick={onDismiss}>Prova SetlistPro gratis</button></div></div>);
}

function UpgradeModal({onClose,userEmail}){
  const [loading,setLoading]=useState(false);
  const startCheckout=async()=>{
    setLoading(true);
    try{
      const res=await fetch("/api/create-checkout-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:userEmail})});
      const data=await res.json();
      if(data.url){window.location.href=data.url;}
      else{alert("Errore nel checkout: "+(data.error||"riprova"));setLoading(false);}
    }catch(e){alert("Errore di rete: "+e.message);setLoading(false);}
  };
  return(<div className="modal-overlay" onClick={onClose}><div className="modal-box" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><IcX/></button><div className="modal-icon"><IcStar size={36}/></div><h2>Passa a <span className="pro-label">PRO</span></h2><p>Sblocca tutto il potenziale di SetlistPro e porta la tua musica al livello successivo.</p><ul className="pro-features"><li>✓ Scalette illimitate</li><li>✓ Brani illimitati (scaletta e libreria)</li><li>✓ MP3 basi musicali allegabili</li><li>✓ Tutti gli aggiornamenti futuri</li></ul><div className="pro-price">€4,99 <span>una tantum — promo lancio</span></div><button className="btn-upgrade" onClick={startCheckout} disabled={loading}>{loading?"Attendere…":"Acquista PRO lifetime"}</button><p className="modal-note">Pagamento sicuro tramite Stripe.</p></div></div>);
}

function ProfileModal({user,isPro,onClose,onLogout}){
  const [pw,setPw]=useState(""),[pw2,setPw2]=useState("");
  const [loading,setLoading]=useState(false),[msg,setMsg]=useState(null),[err,setErr]=useState(null);
  const memberSince=user?.created_at?new Date(user.created_at).toLocaleDateString("it-IT"):null;
  const changePassword=async()=>{
    setErr(null);setMsg(null);
    if(pw.length<6){setErr("La password deve avere almeno 6 caratteri.");return;}
    if(pw!==pw2){setErr("Le due password non coincidono.");return;}
    setLoading(true);
    const {error}=await supabase.auth.updateUser({password:pw});
    setLoading(false);
    if(error){setErr(error.message);}
    else{setMsg("Password aggiornata con successo.");setPw("");setPw2("");}
  };
  return(<div className="modal-overlay" onClick={onClose}><div className="modal-box profile-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><IcX/></button>
    <div className="modal-icon"><IcUser size={36}/></div>
    <h2>Il tuo profilo</h2>
    <div className="profile-info">
      <div className="profile-row"><span className="profile-label">Email</span><span className="profile-value">{user?.email}</span></div>
      <div className="profile-row"><span className="profile-label">Piano</span><span className={`profile-plan${isPro?" pro":""}`}>{isPro?"PRO Lifetime":"Free"}</span></div>
      {memberSince&&<div className="profile-row"><span className="profile-label">Membro dal</span><span className="profile-value">{memberSince}</span></div>}
    </div>
    <div className="profile-divider"/>
    <div className="profile-section">
      <h3>Cambia password</h3>
      <input className="profile-input" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Nuova password" autoComplete="new-password"/>
      <input className="profile-input" type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Conferma nuova password" autoComplete="new-password"/>
      {err&&<div className="profile-msg err">⚠️ {err}</div>}
      {msg&&<div className="profile-msg ok">✅ {msg}</div>}
      <button className="btn-upgrade" onClick={changePassword} disabled={loading} style={{marginTop:8}}>{loading?"Attendere…":"Aggiorna password"}</button>
    </div>
    <button className="profile-logout" onClick={onLogout}>Esci dall'account</button>
  </div></div>);
}

// ── SETLIST EDITOR ────────────────────────────────────────────────────────────
function SetlistEditor({setlist,onUpdate,onBack,library,onUpdateLibrary,isPro,useItalian,onToggleItalian}){
  const [dragIdx,setDragIdx]=useState(null),[overIdx,setOverIdx]=useState(null),[viewingPDF,setViewingPDF]=useState(null),[stageMode,setStageMode]=useState(false),[showMetro,setShowMetro]=useState(false),[showLib,setShowLib]=useState(false),[showHistory,setShowHistory]=useState(false),[showTranspose,setShowTranspose]=useState(false),[showShare,setShowShare]=useState(false),[showPrint,setShowPrint]=useState(false),[limitWarning,setLimitWarning]=useState(false);
  const updateSong=u=>onUpdate({...setlist,songs:setlist.songs.map(s=>s.id===u.id?u:s)});
  const deleteSong=id=>onUpdate({...setlist,songs:setlist.songs.filter(s=>s.id!==id)});
  const addSong=()=>{if(!isPro&&setlist.songs.length>=FREE_SONGS_LIMIT){setLimitWarning(true);return;}const s={id:uid(),title:"Nuovo brano",key:"C",mode:"Maj",bpm:120,duration:"3:00",notes:"",tags:[],pdfName:null,pdfData:null};onUpdate({...setlist,songs:[...setlist.songs,s]});};
  const addFromLibrary=(libSong)=>{if(!isPro&&setlist.songs.length>=FREE_SONGS_LIMIT){setLimitWarning(true);return;}onUpdate({...setlist,songs:[...setlist.songs,{...libSong,id:uid()}]});};
  const handleDragStart=(e,i)=>{setDragIdx(i);e.dataTransfer.effectAllowed="move";};
  const handleDragOver=(e,i)=>{e.preventDefault();setOverIdx(i);};
  const handleDrop=(e,i)=>{e.preventDefault();if(dragIdx===null||dragIdx===i)return;const songs=[...setlist.songs];const[m]=songs.splice(dragIdx,1);songs.splice(i,0,m);onUpdate({...setlist,songs});setDragIdx(null);setOverIdx(null);};
  const totalMin=setlist.songs.reduce((acc,s)=>{const[m,sec]=(s.duration||"0:00").split(":").map(Number);return acc+(m||0)+(sec||0)/60;},0);
  const totalStr=`${Math.floor(totalMin)}:${String(Math.round((totalMin%1)*60)).padStart(2,"0")}`;
  if(stageMode)return <StageMode setlist={setlist} onClose={()=>setStageMode(false)} useItalian={useItalian} isPro={isPro}/>;
  return(<div className="editor-page">{viewingPDF&&<PDFViewer song={viewingPDF} onClose={()=>setViewingPDF(null)}/>}{showLib&&<Library library={library} onUpdate={onUpdateLibrary} onClose={()=>setShowLib(false)} onAddToSetlist={s=>{addFromLibrary(s);setShowLib(false);}} isPro={isPro} useItalian={useItalian}/>}{showHistory&&<HistoryModal setlist={setlist} onUpdate={onUpdate} onClose={()=>setShowHistory(false)}/>}{showTranspose&&<TransposeModal setlist={setlist} onUpdate={onUpdate} onClose={()=>setShowTranspose(false)}/>}{showShare&&<ShareModal setlist={setlist} onClose={()=>setShowShare(false)}/>}{showPrint&&<PrintModal setlist={setlist} onClose={()=>setShowPrint(false)} useItalian={useItalian}/>}<div className="editor-header"><div className="editor-header-top"><button className="btn-back" onClick={onBack}><IcChevL/> Scalette</button><div className="editor-header-actions"><button className="btn-note-toggle" onClick={onToggleItalian} title="Cambia notazione">{useItalian?"Do Re Mi":"C D E"}</button><button className="btn-icon-label" onClick={()=>setShowLib(true)}><IcBook size={15}/> Libreria</button><button className="btn-icon-label" onClick={()=>setShowHistory(true)}><IcHistory size={15}/> Storico{(setlist.history?.length||0)>0&&<span className="history-badge">{setlist.history.length}</span>}</button><button className="btn-icon-label" onClick={()=>setShowTranspose(true)}><IcTranspose size={15}/> Trasponi</button><button className="btn-icon-label" onClick={()=>setShowShare(true)}><IcShare2 size={15}/> Condividi</button><button className="btn-icon-label" onClick={()=>setShowPrint(true)}><IcPrint size={15}/> Stampa</button><button className={`btn-icon-label${showMetro?" active":""}`} onClick={()=>setShowMetro(v=>!v)}><IcMetro size={15}/> Metro</button><button className="btn-stage" onClick={()=>setStageMode(true)}><IcStage size={15}/> Palco</button></div></div><input className="setlist-name-input" value={setlist.name} onChange={e=>onUpdate({...setlist,name:e.target.value})}/><div className="editor-meta-row"><label>📅 <input type="date" value={setlist.date} onChange={e=>onUpdate({...setlist,date:e.target.value})}/></label><label>📍 <input value={setlist.venue} placeholder="Venue / locale" onChange={e=>onUpdate({...setlist,venue:e.target.value})}/></label><span className="total-dur"><IcClock/> {totalStr} · {setlist.songs.length} brani</span></div></div>{showMetro&&<div className="metro-panel"><Metronome bpm={setlist.songs[0]?.bpm||120}/></div>}{limitWarning&&(<div className="limit-banner"><div className="limit-banner-left"><span className="limit-banner-icon">🔒</span><div className="limit-banner-text"><span className="limit-banner-title">Funzione PRO</span><span className="limit-banner-sub">Brani illimitati, MP3 basi musicali e altro con il piano PRO.</span></div></div><div className="limit-banner-right"><button className="limit-banner-pro">PRO — €4,99</button><button className="limit-banner-close" onClick={()=>setLimitWarning(false)}>×</button></div></div>)}<div className="songs-list">{setlist.songs.map((song,i)=>(<SongRow key={song.id} song={song} index={i} isPro={isPro} useItalian={useItalian} onShowProBanner={()=>setLimitWarning(true)} dragging={overIdx===i&&dragIdx!==i} onUpdate={updateSong} onDelete={deleteSong} onOpenPDF={s=>setViewingPDF(s)} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={e=>handleDrop(e,i)} onDragEnd={()=>{setDragIdx(null);setOverIdx(null);}}/>))}</div><div className="add-song-row"><button className="btn-add-song" onClick={addSong}><IcPlus/> Nuovo brano</button><button className="btn-add-from-lib" onClick={()=>setShowLib(true)}><IcBook size={15}/> Da libreria</button></div></div>);
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [data,setData]=useState(()=>{const s=loadData();return s||{setlists:[defaultSetlist()],library:[]};});
  const [user,setUser]=useState(null);
  const [isPro,setIsPro]=useState(false);
  const [loadingAuth,setLoadingAuth]=useState(true);
  const [activeId,setActiveId]=useState(null);
  const [showUpgrade,setShowUpgrade]=useState(false);
  const [showLibGlobal,setShowLibGlobal]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const [sharedSetlist]=useState(()=>parseSharedSetlist());
  const [useItalian,setUseItalian]=useState(()=>{try{return localStorage.getItem("setlist_notation")==="it";}catch{return false;}});

  // Funzione per controllare PRO — ritorna true/false
  async function fetchIsPro(email) {
    try {
      const {data,error} = await supabase
        .from("profiles")
        .select("is_pro")
        .eq("email", email)
        .single();
      console.log("fetchIsPro:", email, data, error);
      return data?.is_pro === true;
    } catch(e) {
      console.error("fetchIsPro error:", e);
      return false;
    }
  }

useEffect(()=>{
  const timeout=setTimeout(()=>setLoadingAuth(false),5000);

  supabase.auth.getSession().then(({data:{session}})=>{
    if(session?.user){
      setUser(session.user);
      fetchIsPro(session.user.email).then(pro=>setIsPro(pro));
    }
    clearTimeout(timeout);
    setLoadingAuth(false);
  });

  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
    setUser(session?.user ?? null);
    if(session?.user){
      setTimeout(()=>{
        fetchIsPro(session.user.email).then(pro=>setIsPro(pro));
      },0);
    }else{
      setIsPro(false);
    }
    // Quando l'utente arriva da un link di reset password, apri direttamente l'area Profilo
    if(event === "PASSWORD_RECOVERY"){
      setShowProfile(true);
    }
  });

  return ()=>{
    subscription.unsubscribe();
    clearTimeout(timeout);
  };
},[]);

  const handleLogin=async(loggedUser)=>{
    setUser(loggedUser);
    const pro = await fetchIsPro(loggedUser.email);
    setIsPro(pro);
  };

const handleLogout = async () => {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error("Logout error:", e);
  }
  // Pulisce le chiavi residue di Supabase nel localStorage
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith("sb-")) localStorage.removeItem(k);
  });
  setUser(null);
  setIsPro(false);
  window.location.reload();
};

  useEffect(()=>{saveData(data);},[data]);
  useEffect(()=>{try{localStorage.setItem("setlist_notation",useItalian?"it":"en");}catch{}},[useItalian]);

  // Dopo il ritorno da Stripe Checkout: ricontrolla lo stato PRO (il webhook è asincrono, può servire qualche secondo)
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get("checkout")==="success" && user?.email){
      let tries=0;
      const poll=setInterval(async()=>{
        tries++;
        const pro=await fetchIsPro(user.email);
        if(pro||tries>=6){
          setIsPro(pro);
          clearInterval(poll);
          window.history.replaceState({},"",window.location.pathname);
        }
      },2000);
      return ()=>clearInterval(poll);
    }
  },[user]);

  const setlists=data.setlists,library=data.library||[];
  const updateSetlist=u=>setData(d=>({...d,setlists:d.setlists.map(s=>s.id===u.id?u:s)}));
  const updateLibrary=l=>setData(d=>({...d,library:l}));
  const createSetlist=()=>{
    if(!isPro&&setlists.length>=FREE_LIMIT){setShowUpgrade(true);return;}
    const ns={...defaultSetlist(),name:"Nuova scaletta",songs:[]};
    setData(d=>({...d,setlists:[...d.setlists,ns]}));setActiveId(ns.id);
  };
  const deleteSetlist=id=>{setData(d=>({...d,setlists:d.setlists.filter(s=>s.id!==id)}));if(activeId===id)setActiveId(null);};
  const active=setlists.find(s=>s.id===activeId);

  if(loadingAuth)return(
    <div style={{minHeight:"100vh",background:"#0d0f14",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:36,height:36,border:"3px solid #2a2f3d",borderTopColor:"#e8c84a",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
    </div>
  );

  if(!user)return(
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>
      <Auth onLogin={handleLogin}/>
    </>
  );

  return(
    <>
      <style>{CSS}</style>
      {sharedSetlist?(
        <SharedView setlist={sharedSetlist} onDismiss={()=>window.location.href=window.location.pathname}/>
      ):(
        <div className="app">
          {showLibGlobal&&<Library library={library} onUpdate={updateLibrary} onClose={()=>setShowLibGlobal(false)} isPro={isPro} useItalian={useItalian}/>}
          {active?(
            <SetlistEditor setlist={active} onUpdate={updateSetlist} onBack={()=>setActiveId(null)}
              library={library} onUpdateLibrary={updateLibrary} isPro={isPro}
              useItalian={useItalian} onToggleItalian={()=>setUseItalian(v=>!v)}/>
          ):(
            <>
              <header className="app-header">
                <div className="logo"><IcMusic size={26}/><span>Setlist<b>Pro</b></span></div>
                <div className="header-right">
                  <a className="btn-info-link" href="https://setlistpro-landing.vercel.app" target="_blank" rel="noopener">ℹ️ Info</a>
                  <button className="btn-note-toggle" onClick={()=>setUseItalian(v=>!v)}>{useItalian?"Do Re Mi":"C D E"}</button>
                  <button className="btn-icon-label" onClick={()=>setShowLibGlobal(true)}><IcBook size={15}/> Libreria <span className="lib-count">{library.length}</span></button>
                  {!isPro&&<button className="btn-pro-badge" onClick={()=>setShowUpgrade(true)}><IcStar size={13}/> Free {setlists.length}/{FREE_LIMIT}</button>}
                  <button className="btn-icon-label" onClick={()=>setShowProfile(true)}><IcUser size={15}/> Profilo</button>
                  <button onClick={handleLogout} style={{background:"none",border:"1px solid #2a2f3d",color:"#7a7f96",borderRadius:"20px",padding:"6px 14px",fontSize:".8rem",cursor:"pointer"}}>Esci</button>
                </div>
              </header>
              <div className="home-hero">
                <h1>Le tue scalette,<br/>sempre in tasca.</h1>
                <p>Crea, riordina e porta sul palco le tue set list con tutti gli spartiti a portata di tap.</p>
              </div>
              <div className="setlists-grid">
                {setlists.map(sl=>(<div key={sl.id} className="setlist-card" onClick={()=>setActiveId(sl.id)}><div className="card-top"><IcList/><button className="btn-icon btn-delete card-del" onClick={e=>{e.stopPropagation();deleteSetlist(sl.id);}}><IcTrash/></button></div><h3>{sl.name}</h3><div className="card-meta"><span>📅 {sl.date}</span>{sl.venue&&<span>📍 {sl.venue}</span>}</div><div className="card-footer"><span>{sl.songs.length} brani</span><div style={{display:"flex",alignItems:"center",gap:6}}>{sl.history?.length>0&&<span className="card-history-badge"><IcHistory size={11}/> {sl.history.length}</span>}<span className="card-arrow"><IcChevR/></span></div></div></div>))}
                <button className="setlist-card card-new" onClick={createSetlist}><IcPlus size={32}/><span>Nuova scaletta</span></button>
              </div>
            </>
          )}
          {showUpgrade&&<UpgradeModal onClose={()=>setShowUpgrade(false)} userEmail={user?.email}/>}
          {showProfile&&<ProfileModal user={user} isPro={isPro} onClose={()=>setShowProfile(false)} onLogout={handleLogout}/>}
        </div>
      )}
    </>
  );
}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0d0f14;--surface:#161920;--card:#1c2030;--border:#2a2f3d;--accent:#e8c84a;--accent2:#4aade8;--danger:#e8604a;--green:#4ae87a;--text:#e8e8f0;--muted:#7a7f96;--radius:14px}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh}
.app{max-width:800px;margin:0 auto;padding:0 16px 80px}
.app-header{display:flex;align-items:center;justify-content:space-between;padding:20px 0 12px;flex-wrap:wrap;gap:8px}
.logo{display:flex;align-items:center;gap:10px;font-family:'Playfair Display',serif;font-size:1.5rem}
.logo b{color:var(--accent)}
.header-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.btn-pro-badge{display:flex;align-items:center;gap:6px;background:rgba(232,200,74,.12);color:var(--accent);border:1px solid rgba(232,200,74,.3);border-radius:20px;padding:6px 14px;font-size:.8rem;font-weight:600;cursor:pointer}
.lib-count{background:rgba(74,173,232,.2);color:var(--accent2);border-radius:10px;padding:1px 7px;font-size:.75rem;font-weight:700}
.btn-info-link{display:flex;align-items:center;gap:5px;background:var(--surface);color:var(--muted);border:1px solid var(--border);border-radius:20px;padding:6px 14px;font-size:.8rem;font-weight:500;text-decoration:none;transition:all .2s}
.btn-info-link:hover{color:var(--accent2);border-color:var(--accent2)}
.btn-note-toggle{display:flex;align-items:center;gap:6px;background:var(--surface);color:var(--muted);border:1px solid var(--border);border-radius:20px;padding:6px 14px;font-size:.8rem;font-weight:600;cursor:pointer;transition:all .2s}
.btn-note-toggle:hover{color:var(--accent2);border-color:var(--accent2)}
.home-hero{padding:32px 0 36px}
.home-hero h1{font-family:'Playfair Display',serif;font-size:clamp(2rem,7vw,3.2rem);line-height:1.1;margin-bottom:12px}
.home-hero p{color:var(--muted);font-size:1rem;max-width:420px;line-height:1.6}
.setlists-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.setlist-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s;display:flex;flex-direction:column;gap:8px;min-height:160px}
.setlist-card:hover{transform:translateY(-3px);border-color:var(--accent);box-shadow:0 8px 32px rgba(232,200,74,.1)}
.card-top{display:flex;justify-content:space-between;align-items:center;color:var(--accent)}
.setlist-card h3{font-size:1.05rem;font-weight:600}
.card-meta{display:flex;flex-direction:column;gap:2px;font-size:.78rem;color:var(--muted)}
.card-footer{display:flex;justify-content:space-between;align-items:center;font-size:.8rem;color:var(--muted);margin-top:auto}
.card-arrow{color:var(--accent2)}
.card-del{opacity:0;transition:opacity .2s}
.setlist-card:hover .card-del{opacity:1}
.card-new{background:transparent;border:2px dashed var(--border);color:var(--muted);justify-content:center;align-items:center;gap:10px;font-size:.9rem}
.card-new:hover{border-color:var(--accent);color:var(--accent)}
.card-history-badge{display:flex;align-items:center;gap:3px;color:var(--accent2);font-size:.75rem}
.editor-page{padding-top:12px}
.editor-header{margin-bottom:20px}
.editor-header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px}
.editor-header-actions{display:flex;gap:6px;flex-wrap:wrap}
.btn-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:var(--muted);font-size:.9rem;cursor:pointer;padding:6px 0}
.btn-back:hover{color:var(--text)}
.btn-stage{display:flex;align-items:center;gap:6px;background:var(--accent);color:#0d0f14;border:none;border-radius:10px;padding:8px 14px;font-size:.82rem;font-weight:700;cursor:pointer;transition:opacity .2s}
.btn-stage:hover{opacity:.85}
.btn-icon-label{display:flex;align-items:center;gap:5px;background:var(--surface);color:var(--muted);border:1px solid var(--border);border-radius:10px;padding:7px 12px;font-size:.82rem;cursor:pointer;transition:all .2s;position:relative}
.btn-icon-label:hover,.btn-icon-label.active{color:var(--accent2);border-color:var(--accent2);background:rgba(74,173,232,.08)}
.history-badge{background:var(--accent2);color:#0d0f14;border-radius:10px;padding:1px 6px;font-size:.7rem;font-weight:700;margin-left:2px}
.setlist-name-input{background:none;border:none;color:var(--text);font-family:'Playfair Display',serif;font-size:clamp(1.5rem,5vw,2.2rem);font-weight:700;width:100%;outline:none;border-bottom:2px solid transparent;padding-bottom:2px;transition:border-color .2s}
.setlist-name-input:focus{border-color:var(--accent)}
.editor-meta-row{display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;align-items:center;font-size:.85rem;color:var(--muted)}
.editor-meta-row label{display:flex;align-items:center;gap:6px}
.editor-meta-row input{background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:5px 10px;font-size:.85rem;outline:none}
.total-dur{display:flex;align-items:center;gap:5px;margin-left:auto;color:var(--accent2);font-size:.82rem}
.metro-panel{margin-bottom:20px}
.metronome{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;display:flex;flex-direction:column;align-items:center;gap:14px}
.metro-header{display:flex;align-items:center;gap:8px;color:var(--accent2);font-size:.85rem;font-weight:600;align-self:flex-start}
.metro-beats{display:flex;gap:10px}
.beat-dot{width:16px;height:16px;border-radius:50%;background:var(--border);transition:background .05s,transform .05s}
.beat-dot.beat-active{background:var(--accent2);transform:scale(1.3)}
.beat-dot.beat-accent.beat-active{background:var(--accent);transform:scale(1.5)}
.metro-bpm-row{display:flex;align-items:center;gap:16px}
.metro-adj{background:var(--surface);border:1px solid var(--border);color:var(--text);width:36px;height:36px;border-radius:8px;font-size:1.2rem;cursor:pointer;transition:all .15s}
.metro-adj:hover{border-color:var(--accent);color:var(--accent)}
.metro-bpm{font-family:'Playfair Display',serif;font-size:2.8rem;font-weight:700;text-align:center;min-width:120px}
.metro-bpm span{font-family:'DM Sans',sans-serif;font-size:.9rem;color:var(--muted);margin-left:6px}
.metro-slider{width:100%;max-width:300px;accent-color:var(--accent2)}
.metro-controls{display:flex;align-items:center;gap:10px}
.metro-select{background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 12px;font-size:.85rem;cursor:pointer;outline:none}
.metro-tap{background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 18px;font-size:.85rem;font-weight:600;cursor:pointer;transition:all .15s;letter-spacing:.05em}
.metro-tap:hover{border-color:var(--accent2);color:var(--accent2)}
.metro-play{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:var(--accent2);border:none;color:#0d0f14;cursor:pointer;transition:opacity .2s}
.metro-play.running{background:var(--accent)}
.metro-play:hover{opacity:.85}
.metro-synced{display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--accent2);font-weight:600;white-space:nowrap;padding:0 6px}
.tag-pill{display:inline-flex;align-items:center;gap:4px;background:color-mix(in srgb,var(--tc) 15%,transparent);color:var(--tc);border:1px solid color-mix(in srgb,var(--tc) 35%,transparent);border-radius:20px;padding:2px 8px;font-size:.72rem;font-weight:600;line-height:1.4}
.tag-remove{background:none;border:none;color:var(--tc);cursor:pointer;font-size:.85rem;padding:0;line-height:1;opacity:.7}
.tag-remove:hover{opacity:1}
.tag-picker{display:flex;flex-wrap:wrap;gap:6px;padding:4px 0}
.tag-option{display:inline-flex;align-items:center;gap:4px;background:color-mix(in srgb,var(--tc) 8%,transparent);color:color-mix(in srgb,var(--tc) 70%,var(--muted));border:1px solid color-mix(in srgb,var(--tc) 20%,transparent);border-radius:20px;padding:3px 10px;font-size:.75rem;cursor:pointer;transition:all .15s}
.tag-option.selected{background:color-mix(in srgb,var(--tc) 20%,transparent);color:var(--tc);border-color:color-mix(in srgb,var(--tc) 50%,transparent)}
.songs-list{display:flex;flex-direction:column;gap:8px}
.song-row{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:border-color .15s}
.song-row.dragging{border-color:var(--accent2);box-shadow:0 0 0 2px rgba(74,173,232,.3)}
.song-main{display:flex;align-items:center;gap:8px;padding:12px 14px;flex-wrap:wrap}
.grip{color:var(--muted);cursor:grab;flex-shrink:0}
.song-num{font-family:'Playfair Display',serif;font-size:1rem;color:var(--accent);width:22px;text-align:center;flex-shrink:0}
.song-title-col{display:flex;flex-direction:column;gap:3px;flex:1 1 140px;min-width:100px}
.song-title{background:none;border:none;color:var(--text);font-size:.95rem;font-weight:500;outline:none;border-bottom:1px solid transparent;width:100%}
.song-title:focus{border-color:var(--accent)}
.song-inline-tags{display:flex;flex-wrap:wrap;gap:4px}
.song-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.song-meta select{background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 8px;font-size:.8rem;outline:none}
.meta-icon-input{display:flex;align-items:center;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--muted)}
.meta-icon-input input{background:none;border:none;color:var(--text);font-size:.8rem;outline:none;width:100%}
.bpm-input{width:44px}.dur-input{width:38px}
.song-actions{display:flex;gap:4px;margin-left:auto}
.btn-icon{background:none;border:1px solid transparent;color:var(--muted);border-radius:8px;padding:5px;cursor:pointer;transition:all .15s;display:flex;align-items:center}
.btn-icon:hover{background:var(--surface);color:var(--text);border-color:var(--border)}
.btn-icon:disabled{opacity:.3;cursor:default}
.btn-pdf.has-pdf{color:var(--accent)}
.btn-pdf.has-pdf:hover{background:rgba(232,200,74,.12)}
.btn-delete:hover{color:var(--danger);border-color:var(--danger)}
.btn-mp3{color:var(--muted)}
.btn-mp3.has-mp3{color:#a78bfa}
.btn-mp3.has-mp3:hover{background:rgba(167,139,250,.12)}
.song-notes{border-top:1px solid var(--border);padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.song-notes textarea{background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 12px;font-size:.85rem;resize:vertical;outline:none;width:100%}
.pdf-badge{display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--accent);flex-wrap:wrap}
.btn-text{background:none;border:none;font-size:.8rem;cursor:pointer;color:var(--accent2);text-decoration:underline;padding:0}
.btn-text.red{color:var(--danger)}
.add-song-row{display:flex;gap:10px;margin-top:16px}
.btn-add-song{flex:1;display:flex;align-items:center;gap:8px;justify-content:center;padding:14px;background:transparent;border:2px dashed var(--border);color:var(--muted);border-radius:var(--radius);font-size:.9rem;font-weight:500;cursor:pointer;transition:all .2s}
.btn-add-song:hover{border-color:var(--accent);color:var(--accent)}
.btn-add-from-lib{display:flex;align-items:center;gap:6px;padding:14px 20px;background:transparent;border:2px dashed var(--border);color:var(--muted);border-radius:var(--radius);font-size:.85rem;cursor:pointer;transition:all .2s;white-space:nowrap}
.btn-add-from-lib:hover{border-color:var(--accent2);color:var(--accent2)}
.mp3-player{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;display:flex;flex-direction:column;gap:8px}
.mp3-player-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mp3-name{flex:1;font-size:.8rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:80px}
.mp3-play-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#a78bfa;border:none;color:#fff;cursor:pointer;flex-shrink:0;transition:opacity .2s}
.mp3-play-btn:hover{opacity:.85}
.mp3-time{font-size:.75rem;color:var(--muted);white-space:nowrap}
.mp3-progress{width:100%;accent-color:#a78bfa;cursor:pointer}
.mp3-locked{opacity:.6;cursor:default;flex-direction:row;align-items:center}
.mp3-pro-badge{background:rgba(232,200,74,.15);color:var(--accent);border:1px solid rgba(232,200,74,.3);border-radius:10px;padding:2px 8px;font-size:.72rem;font-weight:700;margin-left:auto;white-space:nowrap}
.limit-banner{display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,rgba(232,200,74,.08),rgba(232,200,74,.04));border:1px solid rgba(232,200,74,.25);border-radius:14px;padding:16px 20px;margin-bottom:16px;gap:16px;flex-wrap:wrap}
.limit-banner-left{display:flex;align-items:center;gap:14px;flex:1;min-width:200px}
.limit-banner-icon{font-size:1.4rem;flex-shrink:0}
.limit-banner-text{display:flex;flex-direction:column;gap:3px}
.limit-banner-title{font-size:.9rem;font-weight:600;color:var(--text)}
.limit-banner-sub{font-size:.78rem;color:var(--muted);line-height:1.4}
.limit-banner-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
.limit-banner-pro{background:var(--accent);color:#0d0f14;border:none;border-radius:10px;padding:10px 18px;font-size:.85rem;font-weight:700;cursor:pointer;transition:opacity .2s;white-space:nowrap}
.limit-banner-pro:hover{opacity:.88}
.limit-banner-close{background:none;border:none;color:var(--muted);font-size:1.3rem;cursor:pointer;padding:4px 6px;line-height:1;border-radius:6px;transition:color .2s}
.limit-banner-close:hover{color:var(--text)}
.lib-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:150;display:flex;justify-content:flex-end;backdrop-filter:blur(4px)}
.lib-panel{width:100%;max-width:560px;background:var(--bg);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;animation:slideIn .25s ease}
@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
.lib-header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 12px;border-bottom:1px solid var(--border)}
.lib-title{display:flex;align-items:center;gap:10px;color:var(--accent)}
.lib-title h2{font-family:'Playfair Display',serif;font-size:1.4rem}
.lib-toolbar{display:flex;gap:10px;padding:12px 20px;align-items:center}
.lib-search-wrap{flex:1;display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px 12px}
.lib-search{background:none;border:none;color:var(--text);font-size:.9rem;outline:none;flex:1}
.lib-clear{background:none;border:none;color:var(--muted);cursor:pointer;display:flex}
.btn-add-lib{display:flex;align-items:center;gap:6px;background:var(--accent);color:#0d0f14;border:none;border-radius:10px;padding:9px 16px;font-size:.85rem;font-weight:700;cursor:pointer;white-space:nowrap}
.lib-tag-filter{display:flex;flex-wrap:wrap;gap:6px;padding:0 20px 12px}
.tag-filter-btn{background:var(--surface);border:1px solid var(--border);color:var(--muted);border-radius:20px;padding:4px 12px;font-size:.78rem;cursor:pointer;transition:all .15s}
.tag-filter-btn.active,.tag-filter-btn:hover{border-color:var(--tc,var(--accent2));color:var(--tc,var(--accent2));background:color-mix(in srgb,var(--tc,var(--accent2)) 12%,transparent)}
.lib-list{flex:1;overflow-y:auto;padding:0 20px 20px}
.lib-empty{display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px 0;color:var(--muted)}
.lib-song{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;overflow:hidden;transition:border-color .15s}
.lib-song-open{border-color:var(--accent2)}
.lib-song-main{display:flex;align-items:center;gap:10px;padding:12px 14px}
.lib-song-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.lib-song-title{font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lib-song-key{font-size:.78rem;color:var(--muted)}
.lib-tags{display:flex;flex-wrap:wrap;gap:4px}
.lib-song-actions{display:flex;gap:4px;flex-shrink:0}
.btn-lib-add{display:flex;align-items:center;gap:5px;background:rgba(74,173,232,.12);color:var(--accent2);border:1px solid rgba(74,173,232,.3);border-radius:8px;padding:5px 10px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap}
.btn-lib-add:hover{background:rgba(74,173,232,.22)}
.lib-song-edit{border-top:1px solid var(--border);padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.lib-edit-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.lib-edit-title{flex:0 1 160px;min-width:100px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 10px;font-size:.9rem;outline:none}
.lib-edit-notes{background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 12px;font-size:.85rem;resize:vertical;outline:none;width:100%;min-height:80px}
.lib-pdf-row{display:flex;align-items:center;gap:8px}
.lib-footer{padding:12px 20px;border-top:1px solid var(--border);font-size:.8rem;color:var(--muted);text-align:center}
.history-modal{max-width:520px;text-align:left;padding:28px}
.history-header{display:flex;align-items:center;gap:10px;color:var(--accent2);margin-bottom:6px}
.history-header h2{font-family:'Playfair Display',serif;font-size:1.5rem;color:var(--text)}
.history-sub{color:var(--muted);font-size:.85rem;margin-bottom:16px}
.history-form{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
.hf-row{display:flex;gap:8px;flex-wrap:wrap}
.hf-input{background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 10px;font-size:.85rem;outline:none}
.hf-grow{flex:1;min-width:120px}
.hf-textarea{background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 10px;font-size:.85rem;resize:vertical;outline:none;width:100%}
.hf-bottom{align-items:center;justify-content:space-between}
.rating-row{display:flex;gap:2px}
.star-btn{background:none;border:none;color:var(--border);cursor:pointer;padding:2px;transition:color .15s}
.star-btn.active,.star-btn:hover{color:var(--accent)}
.btn-add-history{background:var(--accent);color:#0d0f14;border:none;border-radius:8px;padding:8px 16px;font-size:.85rem;font-weight:700;cursor:pointer}
.history-list{display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto}
.history-empty{color:var(--muted);font-size:.85rem;text-align:center;padding:20px 0}
.history-entry{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px}
.he-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.he-info{display:flex;flex-direction:column;gap:2px}
.he-date,.he-venue{font-size:.8rem;color:var(--muted)}
.he-right{display:flex;align-items:center;gap:8px}
.he-stars{display:flex;gap:1px}
.he-star{color:var(--border);font-size:.9rem}
.he-star.active{color:var(--accent)}
.he-notes{font-size:.83rem;color:var(--text);opacity:.8;line-height:1.5;margin-top:6px}
.stage-overlay{position:fixed;inset:0;background:#000;z-index:300;display:flex;flex-direction:column;align-items:center;overflow-y:auto;padding:0 20px 40px}
.stage-close{position:fixed;top:16px;right:16px;background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.5);border-radius:10px;padding:8px;cursor:pointer;z-index:310;transition:color .2s}
.stage-close:hover{color:#fff}
.stage-progress-bar{position:fixed;top:0;left:0;right:0;height:4px;background:rgba(255,255,255,.1);z-index:310}
.stage-progress-fill{height:100%;transition:width .5s linear,background .3s}
.stage-count{margin-top:36px;font-size:.85rem;color:rgba(255,255,255,.35);letter-spacing:.15em;text-transform:uppercase}
.stage-main{display:flex;flex-direction:column;align-items:center;text-align:center;padding:32px 0 16px;flex:1;max-width:600px;width:100%}
.stage-song-title{font-family:'Playfair Display',serif;font-size:clamp(1.8rem,5.5vw,3.2rem);font-weight:900;line-height:1.05;color:#fff;margin-bottom:16px;word-break:break-word}
.stage-key{font-size:clamp(1.8rem,6vw,3rem);color:var(--accent);font-weight:700;letter-spacing:.05em;margin-bottom:8px}
.stage-bpm{font-size:1.1rem;color:rgba(255,255,255,.4);margin-bottom:12px}
.stage-tags{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:12px}
.stage-notes{font-size:clamp(1.25rem,3.6vw,1.7rem);color:rgba(255,255,255,.75);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px 22px;max-width:500px;width:100%;line-height:1.6;white-space:pre-wrap;text-align:left;margin-top:4px}
.stage-notes-empty{opacity:.3;border-style:dashed}
.stage-notes-placeholder{font-style:italic;font-size:.9rem}
.stage-timer{font-family:'Playfair Display',serif;font-size:clamp(2.5rem,8vw,4.5rem);font-weight:700;color:#fff;letter-spacing:.05em;margin:8px 0}
.stage-timer-expected{font-size:1.2rem;color:rgba(255,255,255,.3);font-family:'DM Sans',sans-serif}
.stage-timer-over{color:var(--danger)}
.stage-controls{display:flex;align-items:center;gap:16px;margin:16px 0}
.stage-btn{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.8);border-radius:14px;padding:14px;cursor:pointer;transition:all .15s;display:flex;align-items:center}
.stage-btn:hover:not(:disabled){background:rgba(255,255,255,.16);color:#fff}
.stage-btn:disabled{opacity:.2;cursor:default}
.stage-btn-main{background:var(--accent);color:#000;border-color:var(--accent);padding:18px}
.stage-btn-main:hover{background:#f0d45e !important;border-color:#f0d45e !important}
.stage-list{width:100%;max-width:500px;display:flex;flex-direction:column;gap:4px;margin-top:8px}
.stage-list-item{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.04);border:1px solid transparent;border-radius:10px;padding:10px 14px;cursor:pointer;transition:all .15s;text-align:left;width:100%}
.stage-list-item:hover{background:rgba(255,255,255,.09)}
.stage-list-item.active{background:rgba(232,200,74,.12);border-color:rgba(232,200,74,.4)}
.stage-list-item.done{opacity:.35}
.sli-num{font-family:'Playfair Display',serif;color:var(--accent);font-size:.9rem;width:20px;flex-shrink:0}
.sli-title{flex:1;color:#fff;font-size:.9rem;font-weight:500}
.sli-key{font-size:.8rem;color:rgba(255,255,255,.4)}
.stage-metro-toggle{margin-top:12px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.5);border-radius:10px;padding:8px 16px;font-size:.82rem;cursor:pointer;transition:all .2s}
.stage-metro-toggle:hover{color:#fff;border-color:rgba(255,255,255,.3)}
.stage-metro-wrap{width:100%;max-width:420px;margin-top:8px}
.stage-metro-sync{display:flex;align-items:center;gap:8px;justify-content:center;color:rgba(255,255,255,.6);font-size:.82rem;margin-bottom:10px;cursor:pointer}
.stage-metro-sync input{accent-color:var(--accent);width:16px;height:16px;cursor:pointer}
.pdf-overlay{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:200;display:flex;flex-direction:column;align-items:center;overflow-y:auto;padding:12px}
.pdf-modal{width:100%;max-width:860px;background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.pdf-modal-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);gap:8px}
.pdf-modal-title{display:flex;align-items:center;gap:8px;color:var(--accent);font-size:.88rem;font-weight:500;min-width:0;flex:1}
.pdf-modal-title span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdf-nav{display:flex;align-items:center;gap:6px}
.pdf-page-info{font-size:.8rem;color:var(--muted);white-space:nowrap}
.pdf-canvas-wrap{padding:16px;display:flex;justify-content:center;min-height:300px}
.pdf-canvas{max-width:100%;border-radius:4px;box-shadow:0 4px 24px rgba(0,0,0,.5)}
.pdf-status{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:60px 24px;color:var(--muted);font-size:.9rem;width:100%}
.pdf-error{color:var(--danger)}
.pdf-spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px)}
.modal-box{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:36px 32px;max-width:380px;width:calc(100% - 32px);text-align:center;position:relative;max-height:90vh;overflow-y:auto}
.modal-close{position:absolute;top:16px;right:16px;background:none;border:none;color:var(--muted);cursor:pointer;padding:4px;border-radius:6px}
.modal-icon{color:var(--accent);margin-bottom:12px}
.modal-box h2{font-family:'Playfair Display',serif;font-size:1.8rem;margin-bottom:10px}
.pro-label{color:var(--accent)}
.modal-box p{color:var(--muted);font-size:.9rem;margin-bottom:16px}
.pro-features{list-style:none;text-align:left;margin:0 0 20px;display:flex;flex-direction:column;gap:8px}
.pro-features li{font-size:.9rem}
.pro-price{font-family:'Playfair Display',serif;font-size:2.2rem;color:var(--accent);margin-bottom:20px}
.pro-price span{font-size:1rem;color:var(--muted)}
.btn-upgrade{width:100%;padding:14px;background:var(--accent);color:#0d0f14;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer}
.modal-note{font-size:.75rem;color:var(--muted);margin-top:12px}
.profile-modal{text-align:left;max-width:420px}
.profile-modal .modal-icon,.profile-modal h2{text-align:center}
.profile-info{display:flex;flex-direction:column;gap:10px;margin:8px 0 4px}
.profile-row{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:.9rem}
.profile-label{color:var(--muted);font-size:.82rem}
.profile-value{color:var(--text);font-weight:500;word-break:break-all;text-align:right}
.profile-plan{font-weight:700;color:var(--muted)}
.profile-plan.pro{color:var(--accent)}
.profile-divider{height:1px;background:var(--border);margin:18px 0}
.profile-section h3{font-size:1rem;margin-bottom:10px;color:var(--text);font-family:'Playfair Display',serif}
.profile-input{width:100%;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:11px 14px;font-size:.92rem;outline:none;margin-bottom:8px}
.profile-input:focus{border-color:var(--accent)}
.profile-msg{border-radius:8px;padding:9px 12px;font-size:.82rem;margin-bottom:6px}
.profile-msg.err{background:rgba(232,96,74,.1);border:1px solid rgba(232,96,74,.3);color:var(--danger)}
.profile-msg.ok{background:rgba(74,232,122,.1);border:1px solid rgba(74,232,122,.3);color:var(--green)}
.profile-logout{width:100%;margin-top:16px;background:none;border:1px solid var(--border);color:var(--muted);border-radius:10px;padding:11px;font-size:.88rem;cursor:pointer;transition:all .2s}
.profile-logout:hover{border-color:var(--danger);color:var(--danger)}
.print-modal-overlay{z-index:500}
.print-modal-box{max-width:700px;width:calc(100% - 24px);text-align:left;padding:28px;max-height:88vh;overflow-y:auto}
.pm-header{margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid var(--accent)}
.pm-title{font-family:'Playfair Display',serif;font-size:1.9rem;margin-bottom:8px;color:var(--text)}
.pm-meta{display:flex;flex-wrap:wrap;gap:14px;font-size:.83rem;color:var(--muted)}
.pm-table{width:100%;border-collapse:collapse;font-size:.88rem;margin-bottom:16px}
.pm-table th{text-align:left;padding:8px 6px;border-bottom:2px solid var(--border);font-size:.75rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
.pm-table td{padding:10px 6px;border-bottom:1px solid var(--border);vertical-align:top}
.pm-num{color:var(--accent);font-family:'Playfair Display',serif;font-weight:700;width:28px}
.pm-song-title{font-weight:600}
.pm-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.pm-tag{border-radius:10px;padding:1px 7px;font-size:.7rem;font-weight:600}
.pm-key{color:var(--accent);font-weight:700;white-space:nowrap}
.pm-bpm,.pm-dur{color:var(--muted);text-align:center;white-space:nowrap}
.pm-notes{color:var(--muted);font-size:.8rem;font-style:italic;max-width:200px}
.pm-footer{font-size:.75rem;color:var(--muted);text-align:right;padding-top:10px;border-top:1px solid var(--border)}
.pm-actions{display:flex;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}
.pm-actions .btn-upgrade{display:flex;align-items:center;gap:7px;flex:1}
.transpose-modal{max-width:460px;text-align:left;padding:28px}
.transpose-header{display:flex;align-items:center;gap:10px;color:var(--accent2);margin-bottom:6px}
.transpose-header h2{font-family:'Playfair Display',serif;font-size:1.5rem;color:var(--text)}
.transpose-sub{color:var(--muted);font-size:.85rem;margin-bottom:20px}
.transpose-control{display:flex;align-items:center;gap:16px;justify-content:center;margin-bottom:10px}
.transpose-value{min-width:160px;text-align:center}
.transpose-num{font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:700;color:var(--text)}
.transpose-preview{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin:16px 0;display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto}
.tp-row{display:flex;align-items:center;justify-content:space-between;font-size:.85rem}
.tp-title{color:var(--text);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:12px}
.tp-keys{display:flex;align-items:center;gap:6px;flex-shrink:0}
.tp-old{color:var(--muted)}.tp-arrow{color:var(--border)}.tp-new{color:var(--accent);font-weight:700}
.transpose-actions{display:flex;gap:10px;margin-top:4px}
.btn-cancel{flex:1;padding:12px;background:var(--surface);border:1px solid var(--border);color:var(--muted);border-radius:10px;cursor:pointer;font-size:.9rem;transition:all .2s}
.btn-cancel:hover{color:var(--text);border-color:var(--text)}
.share-modal{max-width:440px;text-align:left;padding:28px}
.share-header{display:flex;align-items:center;gap:10px;color:var(--accent2);margin-bottom:6px}
.share-header h2{font-family:'Playfair Display',serif;font-size:1.5rem;color:var(--text)}
.share-sub{color:var(--muted);font-size:.83rem;margin-bottom:16px;line-height:1.5}
.share-url-box{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:12px;word-break:break-all}
.share-url-text{font-size:.75rem;color:var(--muted);font-family:monospace}
.btn-copy{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px;background:var(--accent2);color:#0d0f14;border:none;border-radius:10px;font-size:.95rem;font-weight:700;cursor:pointer;transition:all .2s;margin-bottom:16px}
.btn-copy.copied{background:var(--green)}
.btn-copy:hover{opacity:.88}
.share-info{display:flex;flex-direction:column;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px}
.share-info-row{display:flex;gap:10px;font-size:.83rem;color:var(--muted)}
.shared-badge{background:rgba(74,173,232,.15);color:var(--accent2);border:1px solid rgba(74,173,232,.3);border-radius:20px;padding:4px 12px;font-size:.8rem;font-weight:600}
.shared-hero{padding:24px 0 20px}
.shared-hero h1{font-family:'Playfair Display',serif;font-size:clamp(1.8rem,6vw,2.8rem);margin-bottom:10px}
.shared-meta{display:flex;flex-wrap:wrap;gap:14px;font-size:.85rem;color:var(--muted)}
.shared-key{background:rgba(232,200,74,.12);color:var(--accent);border-radius:6px;padding:3px 8px;font-weight:700;font-size:.82rem}
.shared-bpm,.shared-dur{font-size:.82rem;color:var(--muted)}
.shared-footer{text-align:center;padding:32px 0 8px;color:var(--muted);font-size:.9rem}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
@media(max-width:500px){
  .setlists-grid{grid-template-columns:1fr 1fr}
  .lib-panel{max-width:100%}
  .pdf-modal{border-radius:8px}
  .pdf-canvas-wrap{padding:8px}
  .stage-song-title{font-size:clamp(1.4rem,7vw,2.4rem)}
  .editor-header-actions{gap:4px}
  .btn-icon-label{padding:6px 9px;font-size:.78rem}
}
`;
