// SmartTravelApp.jsx — Smart Travel Manager v2
// Full-stack: Firebase Auth + Firestore, Amadeus flights/hotels,
// OpenWeather, Unsplash, Live currency, Google Maps, Stripe booking flow
// All APIs free tier — no credit card required

import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { WORLD_DESTINATIONS, CURRENCY_SYMBOLS, EXCHANGE_RATES, CONTINENTS } from "./data/worldDestinations";
import { fetchWeather, searchFlights, searchHotels, generateCabOptions, fetchExchangeRates, convertCurrency } from "./services/apiServices";
import { signUpWithEmail, signInWithEmail, signInWithGoogle, logOut, onAuthChange, getUserProfile, saveTrip, getUserTrips, updateTrip, deleteTrip, saveBooking, getUserBookings, saveReview, getReviews } from "./services/firebase";

/* ══════════════════════════════════════════════════════════════
   GLOBAL STYLES
══════════════════════════════════════════════════════════════ */
const G = () => <style>{`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
:root{
  --ink:#0B1F3A; --ink2:#2D4263; --ink3:#5A6E8A; --ink4:#9AADC4;
  --sky:#0E7FD5; --sky-d:#0A60A8; --sky-l:#E5F3FD;
  --coral:#FF5757; --coral-d:#E03D3D;
  --gold:#F5A623; --gold-l:#FEF4E3;
  --jade:#00C896; --jade-l:#E0FAF4;
  --lavender:#7C6FCD; --lavender-l:#EEEDFA;
  --bg:#F4F7FB; --surface:#FFFFFF; --surface2:#F8FAFD;
  --border:#E2EAF4; --border2:#C8D8EC;
  --r-sm:8px; --r-md:14px; --r-lg:20px; --r-xl:28px; --r-full:9999px;
  --shadow-xs:0 1px 3px rgba(11,31,58,.06);
  --shadow-sm:0 2px 10px rgba(11,31,58,.08);
  --shadow-md:0 6px 24px rgba(11,31,58,.11);
  --shadow-lg:0 12px 48px rgba(11,31,58,.15);
  --shadow-xl:0 24px 72px rgba(11,31,58,.20);
  --ease:cubic-bezier(.16,1,.3,1);
  --font-d:'Playfair Display',serif;
  --font-b:'Plus Jakarta Sans',sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--font-b);background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;line-height:1.6}
h1,h2,h3{font-family:var(--font-d);letter-spacing:-.02em;line-height:1.2}
a{color:var(--sky);text-decoration:none}
img{display:block;max-width:100%}
button{cursor:pointer;font-family:var(--font-b)}
input,select,textarea{font-family:var(--font-b)}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:99px}
@keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes shimmer{0%{background-position:-800px 0}100%{background-position:800px 0}}
@keyframes scaleIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
.up{animation:up .45s var(--ease) both}
.fade{animation:fade .35s ease both}
.s1{animation-delay:60ms}.s2{animation-delay:120ms}.s3{animation-delay:180ms}.s4{animation-delay:240ms}.s5{animation-delay:300ms}.s6{animation-delay:360ms}
.skel{background:linear-gradient(90deg,var(--surface2) 25%,var(--border) 50%,var(--surface2) 75%);background-size:800px;animation:shimmer 1.4s infinite linear;border-radius:var(--r-sm)}
`}</style>;

/* ══════════════════════════════════════════════════════════════
   AUTH CONTEXT
══════════════════════════════════════════════════════════════ */
const AC = createContext(null);
function AuthProvider({children}){
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);

  useEffect(()=>{
    const unsub=onAuthChange(async u=>{
      setUser(u);
      if(u){ const p=await getUserProfile(u.uid); setProfile(p||{name:u.displayName,email:u.email,avatar:u.photoURL,preferences:{currency:"USD"}}); }
      else setProfile(null);
      setLoading(false);
    });
    return unsub;
  },[]);

  const signUp=async(name,email,pw)=>{ setError(null); try{ await signUpWithEmail(name,email,pw); }catch(e){ setError(e.message); throw e; }};
  const signIn=async(email,pw)=>{ setError(null); try{ await signInWithEmail(email,pw); }catch(e){ setError(e.message); throw e; }};
  const googleSignIn=async()=>{ setError(null); try{ await signInWithGoogle(); }catch(e){ setError(e.message); throw e; }};
  const logout=()=>logOut();
  const clearError=()=>setError(null);

  return <AC.Provider value={{user,profile,loading,error,signUp,signIn,googleSignIn,logout,clearError}}>{children}</AC.Provider>;
}
const useAuth=()=>useContext(AC);

/* ══════════════════════════════════════════════════════════════
   TRIP CONTEXT
══════════════════════════════════════════════════════════════ */
const TC = createContext(null);
function TripProvider({children}){
  const {user}=useAuth();
  const [trips,setTrips]=useState([]);
  const [bookings,setBookings]=useState([]);
  const [loadingTrips,setLoadingTrips]=useState(false);
  const [currency,setCurrency]=useState("USD");
  const [rates,setRates]=useState(EXCHANGE_RATES);

  useEffect(()=>{ if(user){ loadTrips(); loadBookings(); } },[user]);
  useEffect(()=>{ fetchExchangeRates(currency).then(r=>{ if(r) setRates(r); }); },[currency]);

  const loadTrips=async()=>{ setLoadingTrips(true); try{ const t=await getUserTrips(user.uid); setTrips(t); }catch{} setLoadingTrips(false); };
  const loadBookings=async()=>{ try{ const b=await getUserBookings(user.uid); setBookings(b); }catch{} };

  const addTrip=async(data)=>{ const t=await saveTrip(user.uid,data); setTrips(p=>[t,...p]); return t; };
  const editTrip=async(id,data)=>{ await updateTrip(id,data); setTrips(p=>p.map(t=>t.id===id?{...t,...data}:t)); };
  const removeTrip=async(id)=>{ await deleteTrip(id); setTrips(p=>p.filter(t=>t.id!==id)); };
  const addBooking=async(data)=>{ const b=await saveBooking(user.uid,data); setBookings(p=>[b,...p]); return b; };
  const convert=(amt,from="USD")=>{ if(!rates||from===currency) return amt; const inUSD=from==="USD"?amt:amt/(rates[from]||1); return Math.round(inUSD*(rates[currency]||1)); };
  const fmt=(amt,from="USD")=>{ const sym=CURRENCY_SYMBOLS[currency]||currency+" "; return `${sym}${convert(amt,from).toLocaleString()}`; };

  return <TC.Provider value={{trips,bookings,loadingTrips,currency,setCurrency,rates,convert,fmt,addTrip,editTrip,removeTrip,addBooking,loadTrips}}>{children}</TC.Provider>;
}
const useTrips=()=>useContext(TC);

/* ══════════════════════════════════════════════════════════════
   SHARED UI
══════════════════════════════════════════════════════════════ */
const Btn=({children,onClick,v="primary",size="md",disabled,full,style:sx={}})=>{
  const vs={primary:{background:"var(--sky)",color:"#fff"},secondary:{background:"var(--coral)",color:"#fff"},ghost:{background:"transparent",color:"var(--ink)",border:"1.5px solid var(--border2)"},outline:{background:"transparent",color:"var(--sky)",border:"1.5px solid var(--sky)"},success:{background:"var(--jade)",color:"#fff"},gold:{background:"var(--gold)",color:"#fff"}};
  const ss={sm:{padding:"7px 14px",fontSize:".82rem"},md:{padding:"10px 20px",fontSize:".9rem"},lg:{padding:"13px 28px",fontSize:"1rem"},xl:{padding:"16px 36px",fontSize:"1.05rem",borderRadius:"var(--r-lg)"}};
  return <button onClick={onClick} disabled={disabled} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,borderRadius:"var(--r-md)",fontWeight:700,border:"none",transition:"all .15s",opacity:disabled?.5:1,cursor:disabled?"not-allowed":"pointer",width:full?"100%":"auto",...vs[v],...ss[size],...sx}}
    onMouseEnter={e=>{if(!disabled&&v==="primary")e.currentTarget.style.background="var(--sky-d)";}}
    onMouseLeave={e=>{if(!disabled&&v==="primary")e.currentTarget.style.background="var(--sky)";}}
  >{children}</button>;
};

const Card=({children,style:sx={},onClick,hover=true})=><div onClick={onClick} style={{background:"var(--surface)",borderRadius:"var(--r-lg)",border:"1px solid var(--border)",boxShadow:"var(--shadow-sm)",overflow:"hidden",cursor:onClick?"pointer":"default",transition:"all .25s var(--ease)",...sx}}
  onMouseEnter={e=>{if(hover&&onClick){e.currentTarget.style.boxShadow="var(--shadow-lg)";e.currentTarget.style.transform="translateY(-3px)";}}}
  onMouseLeave={e=>{if(hover&&onClick){e.currentTarget.style.boxShadow="var(--shadow-sm)";e.currentTarget.style.transform="translateY(0)";}}}
>{children}</div>;

const Input=({label,error:err,...props})=><div style={{display:"flex",flexDirection:"column",gap:5}}>
  {label&&<label style={{fontSize:".84rem",fontWeight:700,color:"var(--ink2)"}}>{label}</label>}
  <input {...props} style={{width:"100%",padding:"11px 16px",border:`1.5px solid ${err?"var(--coral)":"var(--border)"}`,borderRadius:"var(--r-md)",fontSize:".95rem",color:"var(--ink)",background:"var(--surface)",outline:"none",transition:"border-color .15s",...props.style}}
    onFocus={e=>e.target.style.borderColor="var(--sky)"}
    onBlur={e=>e.target.style.borderColor=err?"var(--coral)":"var(--border)"}
  />
  {err&&<span style={{fontSize:".78rem",color:"var(--coral)"}}>{err}</span>}
</div>;

const Select=({label,children,...props})=><div style={{display:"flex",flexDirection:"column",gap:5}}>
  {label&&<label style={{fontSize:".84rem",fontWeight:700,color:"var(--ink2)"}}>{label}</label>}
  <select {...props} style={{width:"100%",padding:"11px 16px",border:"1.5px solid var(--border)",borderRadius:"var(--r-md)",fontSize:".95rem",color:"var(--ink)",background:"var(--surface)",outline:"none",cursor:"pointer",...props.style}}>{children}</select>
</div>;

const Modal=({open,onClose,title,children,width=560})=>{
  useEffect(()=>{ document.body.style.overflow=open?"hidden":""; return()=>{ document.body.style.overflow=""; }; },[open]);
  if(!open)return null;
  return <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:"var(--surface)",borderRadius:"var(--r-xl)",width:"100%",maxWidth:width,maxHeight:"92vh",overflowY:"auto",animation:"scaleIn .3s var(--ease) both"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"var(--surface)",zIndex:1}}>
        <h3 style={{fontFamily:"var(--font-d)",fontWeight:700,fontSize:"1.2rem"}}>{title}</h3>
        <button onClick={onClose} style={{background:"var(--surface2)",border:"none",width:34,height:34,borderRadius:"50%",fontSize:18,cursor:"pointer",color:"var(--ink3)",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>
      <div style={{padding:24}}>{children}</div>
    </div>
  </div>;
};

const Stars=({r})=><span style={{color:"#F5A623",fontSize:".85rem"}}>{"★".repeat(Math.floor(r))}{"☆".repeat(5-Math.floor(r))} <span style={{color:"var(--ink3)",fontWeight:600}}>{Number(r).toFixed(1)}</span></span>;

const Badge=({children,color="var(--sky-l)",text="var(--sky)",size="sm"})=><span style={{background:color,color:text,padding:size==="sm"?"3px 10px":"5px 14px",borderRadius:"var(--r-full)",fontSize:size==="sm"?".72rem":".82rem",fontWeight:700,letterSpacing:".02em",whiteSpace:"nowrap",display:"inline-block"}}>{children}</span>;

const Spinner=()=><div style={{width:20,height:20,border:"2.5px solid rgba(255,255,255,.3)",borderTop:"2.5px solid white",borderRadius:"50%",animation:"spin .7s linear infinite"}} />;

const Toast=({msg,onClose})=>{
  useEffect(()=>{ const t=setTimeout(onClose,3500); return()=>clearTimeout(t); },[]);
  const colors={success:"var(--jade)",error:"var(--coral)",info:"var(--sky)",warning:"var(--gold)"};
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:2000,background:colors[msg.type]||"var(--ink)",color:"white",padding:"14px 20px",borderRadius:"var(--r-lg)",boxShadow:"var(--shadow-xl)",maxWidth:360,animation:"up .35s var(--ease) both",display:"flex",gap:10,alignItems:"center"}}>
    <span style={{fontSize:18}}>{msg.type==="success"?"✅":msg.type==="error"?"❌":msg.type==="warning"?"⚠️":"ℹ️"}</span>
    <div><p style={{fontWeight:700,fontSize:".9rem"}}>{msg.title}</p>{msg.body&&<p style={{fontSize:".82rem",opacity:.85,marginTop:2}}>{msg.body}</p>}</div>
    <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,.7)",fontSize:18,marginLeft:"auto",cursor:"pointer"}}>×</button>
  </div>;
};

/* ══════════════════════════════════════════════════════════════
   NAVBAR
══════════════════════════════════════════════════════════════ */
function Navbar({page,setPage}){
  const {user,profile,logout}=useAuth();
  const {currency,setCurrency}=useTrips();
  const [menuOpen,setMenuOpen]=useState(false);
  const [profileOpen,setProfileOpen]=useState(false);
  const ALL_CURRENCIES=Object.keys(CURRENCY_SYMBOLS).sort();

  const nav=[
    {id:"dashboard",icon:"🏠",label:"Dashboard"},
    {id:"explore",icon:"🌍",label:"Explore"},
    {id:"flights",icon:"✈️",label:"Flights"},
    {id:"hotels",icon:"🏨",label:"Hotels"},
    {id:"cabs",icon:"🚕",label:"Cabs"},
    {id:"attractions",icon:"🗺️",label:"Attractions"},
    {id:"planner",icon:"📋",label:"Plan Trip"},
    {id:"bookings",icon:"🎫",label:"My Bookings"},
    {id:"budget",icon:"💰",label:"Budget"},
  ];

  return <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:200,background:"rgba(255,255,255,.96)",backdropFilter:"blur(12px)",borderBottom:"1px solid var(--border)",height:64}}>
    <div style={{maxWidth:1400,margin:"0 auto",padding:"0 20px",height:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      {/* Logo */}
      <div onClick={()=>setPage("dashboard")} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",flexShrink:0}}>
        <div style={{background:"linear-gradient(135deg,var(--sky),var(--lavender))",borderRadius:10,padding:"6px 8px",fontSize:20}}>✈️</div>
        <span style={{fontFamily:"var(--font-d)",fontWeight:800,fontSize:"1.18rem",color:"var(--sky)",letterSpacing:"-.03em"}}>SmartTravel</span>
      </div>

      {/* Nav items */}
      <div style={{display:"flex",gap:2,overflowX:"auto",scrollbarWidth:"none",flex:1,justifyContent:"center",padding:"0 16px"}}>
        {nav.map(n=><button key={n.id} onClick={()=>setPage(n.id)} style={{background:page===n.id?"var(--sky-l)":"transparent",color:page===n.id?"var(--sky)":"var(--ink3)",border:"none",padding:"7px 11px",borderRadius:"var(--r-md)",fontFamily:"var(--font-b)",fontWeight:page===n.id?700:500,fontSize:".8rem",cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4,transition:"all .15s"}}>
          <span style={{fontSize:14}}>{n.icon}</span>{n.label}
        </button>)}
      </div>

      {/* Right side */}
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <select value={currency} onChange={e=>setCurrency(e.target.value)} style={{padding:"6px 10px",borderRadius:"var(--r-md)",border:"1.5px solid var(--border)",fontSize:".82rem",fontFamily:"var(--font-b)",fontWeight:600,color:"var(--ink)",background:"var(--surface)",cursor:"pointer",outline:"none"}}>
          {ALL_CURRENCIES.slice(0,60).map(c=><option key={c}>{c}</option>)}
        </select>
        <div style={{position:"relative"}}>
          <img src={profile?.avatar||user?.photoURL||`https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name||"User")}&background=0E7FD5&color=fff`}
            onClick={()=>setProfileOpen(p=>!p)}
            style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",cursor:"pointer",border:"2px solid var(--sky)"}} alt="avatar" />
          {profileOpen&&<div style={{position:"absolute",right:0,top:44,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--r-lg)",boxShadow:"var(--shadow-lg)",minWidth:200,animation:"scaleIn .2s ease both",zIndex:300}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid var(--border)"}}>
              <p style={{fontWeight:700,fontSize:".9rem"}}>{profile?.name||user?.displayName}</p>
              <p style={{fontSize:".8rem",color:"var(--ink3)"}}>{user?.email}</p>
            </div>
            {[{icon:"🏠",label:"Dashboard",page:"dashboard"},{icon:"🎫",label:"My Bookings",page:"bookings"},{icon:"💰",label:"Budget",page:"budget"}].map(item=>(
              <button key={item.page} onClick={()=>{setPage(item.page);setProfileOpen(false);}} style={{width:"100%",padding:"11px 16px",background:"none",border:"none",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontSize:".88rem",color:"var(--ink2)"}}>{item.icon} {item.label}</button>
            ))}
            <div style={{borderTop:"1px solid var(--border)",padding:8}}>
              <button onClick={()=>{logout();setProfileOpen(false);}} style={{width:"100%",padding:"10px 16px",background:"none",border:"none",textAlign:"left",cursor:"pointer",color:"var(--coral)",fontWeight:600,fontSize:".88rem"}}>🚪 Sign Out</button>
            </div>
          </div>}
        </div>
      </div>
    </div>
  </nav>;
}

/* ══════════════════════════════════════════════════════════════
   AUTH PAGE
══════════════════════════════════════════════════════════════ */
function AuthPage(){
  const {signIn,signUp,googleSignIn,error,clearError}=useAuth();
  const [mode,setMode]=useState("login");
  const [form,setForm]=useState({name:"",email:"",password:""});
  const [loading,setLoading]=useState(false);
  const [fieldErrors,setFieldErrors]=useState({});

  const validate=()=>{
    const e={};
    if(mode==="signup"&&!form.name.trim())e.name="Name is required";
    if(!form.email.includes("@"))e.email="Enter a valid email";
    if(form.password.length<6)e.password="Password must be 6+ characters";
    setFieldErrors(e);
    return Object.keys(e).length===0;
  };

  const handle=async()=>{
    if(!validate())return;
    setLoading(true); clearError();
    try{
      if(mode==="login") await signIn(form.email,form.password);
      else await signUp(form.name,form.email,form.password);
    }catch{}
    setLoading(false);
  };

  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));

  return <div style={{minHeight:"100vh",display:"flex",background:"linear-gradient(135deg,#0B1F3A 0%,#1a3a6b 50%,#0E7FD5 100%)"}}>
    {/* Left panel */}
    <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 80px",color:"white"}}>
      <div style={{fontSize:48,marginBottom:16}}>✈️</div>
      <h1 style={{fontFamily:"var(--font-d)",fontSize:"3rem",color:"white",marginBottom:16,lineHeight:1.1}}>Plan Your<br/>Perfect Journey</h1>
      <p style={{fontSize:"1.1rem",opacity:.8,maxWidth:380,lineHeight:1.7,marginBottom:40}}>Search real flights, compare hotels, discover attractions across 60+ destinations worldwide — all in one place.</p>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {["🛫 Real flight search with live prices","🏨 Hotel comparison & booking flow","🌦️ Live weather for every destination","💱 50+ currency converter","🗺️ Google Maps integration","🔐 Secure accounts — your data saved forever"].map(f=>(
          <div key={f} style={{display:"flex",alignItems:"center",gap:12,opacity:.9}}>
            <span>{f.split(" ")[0]}</span>
            <span style={{fontSize:".92rem"}}>{f.slice(f.indexOf(" ")+1)}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Right panel */}
    <div style={{width:480,display:"flex",alignItems:"center",justifyContent:"center",padding:32}}>
      <Card style={{width:"100%",borderRadius:"var(--r-xl)",animation:"up .5s ease both"}}>
        <div style={{padding:"28px 32px 0"}}>
          <div style={{display:"flex",background:"var(--surface2)",borderRadius:"var(--r-md)",padding:4,marginBottom:24}}>
            {["login","signup"].map(m=><button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"9px 0",borderRadius:"var(--r-sm)",border:"none",fontFamily:"var(--font-b)",fontWeight:700,fontSize:".85rem",background:mode===m?"var(--surface)":"transparent",color:mode===m?"var(--sky)":"var(--ink3)",cursor:"pointer",boxShadow:mode===m?"var(--shadow-sm)":"none",transition:"all .2s"}}>
              {m==="login"?"Sign In":"Create Account"}
            </button>)}
          </div>
        </div>

        <div style={{padding:"0 32px 32px",display:"flex",flexDirection:"column",gap:16}}>
          {/* Google sign in */}
          <button onClick={googleSignIn} style={{width:"100%",padding:"11px 20px",border:"1.5px solid var(--border)",borderRadius:"var(--r-md)",background:"var(--surface)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:"var(--font-b)",fontWeight:600,fontSize:".9rem",color:"var(--ink)",transition:"background .15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--surface2)"}
            onMouseLeave={e=>e.currentTarget.style.background="var(--surface)"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1,height:1,background:"var(--border)"}}/>
            <span style={{fontSize:".8rem",color:"var(--ink4)"}}>or</span>
            <div style={{flex:1,height:1,background:"var(--border)"}}/>
          </div>

          {mode==="signup"&&<Input label="Full Name" placeholder="Alex Wanderer" value={form.name} onChange={set("name")} error={fieldErrors.name} />}
          <Input label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} error={fieldErrors.email} />
          <Input label="Password" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} error={fieldErrors.password} />

          {error&&<div style={{background:"#FEE8E8",color:"var(--coral)",padding:"10px 14px",borderRadius:"var(--r-md)",fontSize:".85rem",fontWeight:600}}>⚠️ {error}</div>}

          <Btn v="primary" size="lg" onClick={handle} disabled={loading} full>
            {loading?<Spinner/>:(mode==="login"?"Sign In →":"Create Account →")}
          </Btn>

          <div style={{background:"var(--sky-l)",borderRadius:"var(--r-md)",padding:"12px 14px",fontSize:".8rem",color:"var(--sky)",fontWeight:600,textAlign:"center"}}>
            💡 Demo mode: enter any email + any 6-char password
          </div>
        </div>
      </Card>
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════ */
function Dashboard({setPage}){
  const {profile,user}=useAuth();
  const {trips,bookings,loadingTrips,fmt}=useTrips();
  const upcoming=trips.filter(t=>t.status==="upcoming"||t.status==="planning");
  const completed=trips.filter(t=>t.status==="completed");

  const stats=[
    {label:"Total Trips",v:trips.length,icon:"🗺️",bg:"var(--sky-l)",c:"var(--sky)"},
    {label:"Upcoming",v:upcoming.length,icon:"📅",bg:"var(--jade-l)",c:"var(--jade)"},
    {label:"Completed",v:completed.length,icon:"✅",bg:"var(--gold-l)",c:"var(--gold)"},
    {label:"Bookings",v:bookings.length,icon:"🎫",bg:"var(--lavender-l)",c:"var(--lavender)"},
  ];

  const trending=WORLD_DESTINATIONS.slice(0,4);

  return <div style={{maxWidth:1400,margin:"0 auto",padding:"32px 24px"}}>
    {/* Hero */}
    <div className="up" style={{background:"linear-gradient(135deg,var(--ink) 0%,var(--sky-d) 100%)",borderRadius:"var(--r-xl)",padding:"44px 48px",marginBottom:28,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:"45%",background:`url(${WORLD_DESTINATIONS[0].img}) center/cover`,opacity:.18,borderRadius:"0 var(--r-xl) var(--r-xl) 0"}}/>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 70% 50%,rgba(14,127,213,.3),transparent 60%)"}}/>
      <div style={{position:"relative"}}>
        <p style={{color:"rgba(255,255,255,.65)",fontSize:".9rem",marginBottom:8}}>Welcome back,</p>
        <h1 style={{color:"white",fontSize:"clamp(1.8rem,3vw,2.6rem)",marginBottom:12}}>{profile?.name||user?.displayName} ✈️</h1>
        <p style={{color:"rgba(255,255,255,.72)",maxWidth:460,marginBottom:28,lineHeight:1.7}}>Where to next? Search flights, compare hotels, and build your perfect itinerary.</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <Btn v="secondary" size="lg" onClick={()=>setPage("flights")}>✈️ Search Flights</Btn>
          <Btn v="gold" size="lg" onClick={()=>setPage("hotels")}>🏨 Find Hotels</Btn>
          <button onClick={()=>setPage("planner")} style={{padding:"13px 24px",background:"rgba(255,255,255,.12)",color:"white",border:"1.5px solid rgba(255,255,255,.35)",borderRadius:"var(--r-lg)",fontFamily:"var(--font-b)",fontWeight:700,cursor:"pointer",fontSize:"1rem"}}>📋 Plan a Trip</button>
        </div>
      </div>
    </div>

    {/* Stats */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:28}}>
      {stats.map((s,i)=><Card key={s.label} style={{padding:20}} className={`up s${i+1}`}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <p style={{fontSize:".8rem",color:"var(--ink3)",fontWeight:600,marginBottom:6}}>{s.label}</p>
            <p style={{fontSize:"2.2rem",fontWeight:900,fontFamily:"var(--font-d)",color:s.c,lineHeight:1}}>{loadingTrips?"–":s.v}</p>
          </div>
          <div style={{background:s.bg,borderRadius:12,padding:"8px 10px",fontSize:22}}>{s.icon}</div>
        </div>
      </Card>)}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:24}}>
      {/* Trips */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{fontSize:"1.2rem"}}>Your Trips</h3>
          <Btn v="outline" size="sm" onClick={()=>setPage("planner")}>+ New Trip</Btn>
        </div>
        {loadingTrips?<div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[1,2].map(i=><div key={i} className="skel" style={{height:100,borderRadius:"var(--r-lg)"}}/>)}
        </div>:trips.length===0?<Card style={{padding:40,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>🗺️</div>
          <h4>No trips yet</h4>
          <p style={{color:"var(--ink3)",marginBottom:16}}>Create your first trip plan</p>
          <Btn v="primary" onClick={()=>setPage("planner")}>Plan a Trip</Btn>
        </Card>:<div style={{display:"flex",flexDirection:"column",gap:12}}>
          {trips.map(t=><TripCard key={t.id} trip={t} fmt={fmt} />)}
        </div>}
      </div>

      {/* Right panel */}
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <h3 style={{fontSize:"1.2rem"}}>Quick Search</h3>
        {[{icon:"✈️",label:"Search Flights",sub:"Real-time prices",page:"flights",bg:"linear-gradient(135deg,#0E7FD5,#0A4A9E)"},
          {icon:"🏨",label:"Find Hotels",sub:"Best rates & availability",page:"hotels",bg:"linear-gradient(135deg,#FF5757,#C43D3D)"},
          {icon:"🚕",label:"Book a Cab",sub:"Airport & city transfers",page:"cabs",bg:"linear-gradient(135deg,#F5A623,#D4880F)"},
          {icon:"🌍",label:"Explore Destinations",sub:"60+ countries worldwide",page:"explore",bg:"linear-gradient(135deg,#00C896,#008F6A)"},
        ].map(item=><Card key={item.page} onClick={()=>setPage(item.page)} style={{overflow:"hidden"}}>
          <div style={{background:item.bg,padding:"16px 18px",display:"flex",alignItems:"center",gap:14}}>
            <div style={{fontSize:28}}>{item.icon}</div>
            <div style={{color:"white"}}><p style={{fontWeight:700}}>{item.label}</p><p style={{fontSize:".8rem",opacity:.8}}>{item.sub}</p></div>
            <span style={{marginLeft:"auto",color:"rgba(255,255,255,.7)",fontSize:20}}>→</span>
          </div>
        </Card>)}

        {/* Trending */}
        <h3 style={{fontSize:"1.2rem",marginTop:4}}>🔥 Trending Now</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {trending.map(d=><Card key={d.id} onClick={()=>setPage("explore")} style={{overflow:"hidden"}}>
            <img src={d.thumb} alt={d.name} style={{width:"100%",height:80,objectFit:"cover"}} />
            <div style={{padding:"10px 12px"}}>
              <p style={{fontWeight:700,fontSize:".88rem"}}>{d.name}</p>
              <p style={{fontSize:".76rem",color:"var(--ink3)"}}>{d.country}</p>
            </div>
          </Card>)}
        </div>
      </div>
    </div>
  </div>;
}

function TripCard({trip,fmt}){
  const s={planning:["var(--sky-l)","var(--sky)"],upcoming:["var(--jade-l)","var(--jade)"],completed:["#f0f0f0","#666"],cancelled:["#fee","var(--coral)"]};
  const [bg,c]=s[trip.status]||s.planning;
  const nights=Math.max(1,Math.ceil((new Date(trip.endDate)-new Date(trip.startDate))/(86400*1000)));
  return <Card style={{display:"flex",overflow:"hidden"}}>
    <img src={trip.coverImg||WORLD_DESTINATIONS.find(d=>d.id===trip.destId)?.thumb||"https://source.unsplash.com/200x120/?travel"} alt={trip.title} style={{width:110,height:90,objectFit:"cover",flexShrink:0}} />
    <div style={{padding:"12px 16px",flex:1,minWidth:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
        <h4 style={{fontSize:".92rem",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"65%"}}>{trip.title}</h4>
        <Badge color={bg} text={c}>{trip.status}</Badge>
      </div>
      <p style={{fontSize:".8rem",color:"var(--ink3)",marginBottom:4}}>📍 {trip.destination} • {nights}n • {trip.adults}pax</p>
      <p style={{fontSize:".8rem",color:"var(--ink4)"}}>📅 {trip.startDate} → {trip.endDate} &nbsp;|&nbsp; 💵 {fmt(trip.budget,"USD")}</p>
    </div>
  </Card>;
}

/* ══════════════════════════════════════════════════════════════
   EXPLORE PAGE
══════════════════════════════════════════════════════════════ */
function ExplorePage({setPage}){
  const [search,setSearch]=useState("");
  const [continent,setContinent]=useState("All");
  const [tag,setTag]=useState("All");
  const [selected,setSelected]=useState(null);
  const [weather,setWeather]=useState(null);
  const [weatherLoading,setWeatherLoading]=useState(false);
  const {fmt}=useTrips();
  const allTags=["All",...new Set(WORLD_DESTINATIONS.flatMap(d=>d.tags))].sort();

  const filtered=WORLD_DESTINATIONS.filter(d=>{
    const q=search.toLowerCase();
    return(!q||d.name.toLowerCase().includes(q)||d.country.toLowerCase().includes(q)||d.tags.some(t=>t.toLowerCase().includes(q)))&&
      (continent==="All"||d.continent===continent)&&(tag==="All"||d.tags.includes(tag));
  });

  const openDest=async(dest)=>{
    setSelected(dest); setWeather(null); setWeatherLoading(true);
    const w=await fetchWeather(dest.lat,dest.lng);
    setWeather(w); setWeatherLoading(false);
  };

  return <div>
    {/* Header */}
    <div style={{background:"linear-gradient(135deg,var(--ink) 0%,#1a3a6b 100%)",padding:"48px 24px 40px",color:"white"}}>
      <div style={{maxWidth:1400,margin:"0 auto"}}>
        <h1 style={{color:"white",marginBottom:8,fontSize:"clamp(1.6rem,3vw,2.4rem)"}}>🌍 Explore the World</h1>
        <p style={{color:"rgba(255,255,255,.75)",marginBottom:28,maxWidth:480}}>Discover {WORLD_DESTINATIONS.length}+ destinations across every continent. Real weather, live prices, insider tips.</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",maxWidth:800}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search any city, country, or vibe…"
            style={{flex:1,minWidth:220,padding:"13px 18px",border:"none",borderRadius:"var(--r-lg)",fontSize:".95rem",fontFamily:"var(--font-b)",outline:"none",boxShadow:"var(--shadow-md)"}} />
          <select value={continent} onChange={e=>setContinent(e.target.value)} style={{padding:"13px 16px",borderRadius:"var(--r-lg)",border:"none",fontFamily:"var(--font-b)",fontSize:".9rem",background:"rgba(255,255,255,.15)",color:"white",cursor:"pointer",outline:"none",fontWeight:600}}>
            {CONTINENTS.map(c=><option key={c} style={{color:"var(--ink)"}}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>

    <div style={{maxWidth:1400,margin:"0 auto",padding:"24px"}}>
      {/* Tag pills */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
        {allTags.slice(0,20).map(t=><button key={t} onClick={()=>setTag(t)} style={{padding:"7px 14px",borderRadius:"var(--r-full)",border:"1.5px solid",borderColor:tag===t?"var(--sky)":"var(--border)",background:tag===t?"var(--sky-l)":"var(--surface)",color:tag===t?"var(--sky)":"var(--ink3)",fontFamily:"var(--font-b)",fontWeight:600,fontSize:".8rem",cursor:"pointer",transition:"all .15s"}}>{t}</button>)}
      </div>

      <p style={{color:"var(--ink3)",marginBottom:20,fontSize:".9rem"}}>{filtered.length} destinations</p>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:20}}>
        {filtered.map((dest,i)=><Card key={dest.id} onClick={()=>openDest(dest)} className={`up s${(i%6)+1}`} style={{overflow:"visible"}}>
          <div style={{position:"relative",overflow:"hidden",borderRadius:"var(--r-lg) var(--r-lg) 0 0"}}>
            <img src={dest.img} alt={dest.name} style={{width:"100%",height:200,objectFit:"cover",transition:"transform .4s ease"}}
              onMouseEnter={e=>e.target.style.transform="scale(1.06)"}
              onMouseLeave={e=>e.target.style.transform="scale(1)"}/>
            <div style={{position:"absolute",top:12,right:12}}>
              <Badge color="rgba(0,0,0,.6)" text="white">{dest.continent}</Badge>
            </div>
            <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,.7)",padding:"20px 16px 12px"}}>
              <h3 style={{color:"white",fontSize:"1.15rem",marginBottom:2}}>{dest.name}</h3>
              <p style={{color:"rgba(255,255,255,.8)",fontSize:".82rem"}}>📍 {dest.country}</p>
            </div>
          </div>
          <div style={{padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <Stars r={dest.rating}/>
              <span style={{fontSize:".8rem",color:"var(--ink3)"}}>{dest.reviews.toLocaleString()} reviews</span>
            </div>
            <p style={{fontSize:".83rem",color:"var(--ink3)",lineHeight:1.5,marginBottom:10}}>{dest.desc}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
              {dest.tags.slice(0,4).map(t=><Badge key={t} size="sm">{t}</Badge>)}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid var(--border)"}}>
              <span style={{fontSize:".78rem",color:"var(--ink4)"}}>🌤 Best: {dest.best}</span>
              <span style={{fontWeight:700,color:"var(--sky)",fontSize:".88rem"}}>from {fmt(dest.budgetDay.low)}/day</span>
            </div>
          </div>
        </Card>)}
      </div>

      {filtered.length===0&&<div style={{textAlign:"center",padding:"80px 0",color:"var(--ink3)"}}>
        <div style={{fontSize:64,marginBottom:16}}>🔍</div>
        <h3>No destinations found</h3>
        <p>Try a different search or filter</p>
      </div>}
    </div>

    {/* Destination detail modal */}
    <Modal open={!!selected} onClose={()=>setSelected(null)} title="" width={680}>
      {selected&&<div>
        <img src={selected.img} alt={selected.name} style={{width:"100%",height:240,objectFit:"cover",borderRadius:"var(--r-lg)",marginBottom:20}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div><h2 style={{marginBottom:4}}>{selected.name}</h2><p style={{color:"var(--ink3)"}}>📍 {selected.country} · {selected.continent}</p></div>
          <div style={{textAlign:"right"}}><Stars r={selected.rating}/><p style={{fontSize:".8rem",color:"var(--ink3)"}}>{selected.reviews.toLocaleString()} reviews</p></div>
        </div>
        <p style={{color:"var(--ink2)",lineHeight:1.7,marginBottom:20}}>{selected.desc}</p>

        {/* Weather */}
        <div style={{background:"var(--surface2)",borderRadius:"var(--r-lg)",padding:16,marginBottom:20}}>
          <h4 style={{marginBottom:12}}>🌤 Live Weather</h4>
          {weatherLoading?<div style={{display:"flex",gap:8}}>{[1,2,3].map(i=><div key={i} className="skel" style={{height:40,flex:1}}/>)}</div>:weather&&<>
            <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:36}}>{weather.icon}</span>
              <div><p style={{fontSize:"1.6rem",fontWeight:900,fontFamily:"var(--font-d)"}}>{weather.temp}°C</p><p style={{color:"var(--ink3)",fontSize:".85rem"}}>{weather.condition} · 💧{weather.humidity}% · 💨{weather.wind}km/h</p></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              {weather.forecast.map(f=><div key={f.day} style={{flex:1,background:"var(--surface)",borderRadius:"var(--r-md)",padding:"10px 8px",textAlign:"center"}}>
                <p style={{fontSize:".75rem",color:"var(--ink3)",marginBottom:4}}>{f.day}</p>
                <p style={{fontSize:18}}>{f.icon}</p>
                <p style={{fontSize:".78rem",fontWeight:700}}>{f.high}°</p>
                <p style={{fontSize:".74rem",color:"var(--ink4)"}}>{f.low}°</p>
              </div>)}
            </div>
          </>}
        </div>

        {/* Budget tiers */}
        <h4 style={{marginBottom:12}}>💵 Daily Budget Estimate</h4>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
          {[["Budget",selected.budgetDay.low,"var(--jade-l)","var(--jade)"],["Mid-range",selected.budgetDay.mid,"var(--sky-l)","var(--sky)"],["Luxury",selected.budgetDay.high,"var(--gold-l)","var(--gold)"]].map(([l,v,bg,c])=><div key={l} style={{background:bg,borderRadius:"var(--r-md)",padding:"14px",textAlign:"center"}}>
            <p style={{fontSize:".76rem",color:"var(--ink3)",marginBottom:4}}>{l}</p>
            <p style={{fontSize:"1.4rem",fontWeight:900,color:c,fontFamily:"var(--font-d)"}}>{fmt(v)}<span style={{fontSize:".7rem",fontWeight:500}}>/day</span></p>
          </div>)}
        </div>

        <div style={{display:"flex",gap:10}}>
          <Btn v="primary" size="lg" onClick={()=>{setSelected(null);setPage("flights");}} style={{flex:1}}>✈️ Search Flights</Btn>
          <Btn v="gold" size="lg" onClick={()=>{setSelected(null);setPage("hotels");}} style={{flex:1}}>🏨 Find Hotels</Btn>
        </div>
      </div>}
    </Modal>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   FLIGHTS PAGE
══════════════════════════════════════════════════════════════ */
function FlightsPage({setPage,setBookingData}){
  const {fmt,addBooking}=useTrips();
  const [form,setForm]=useState({from:"",to:"",date:"",returnDate:"",adults:"1",tripType:"one-way",cabin:"ECONOMY"});
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [searched,setSearched]=useState(false);
  const [selected,setSelected]=useState(null);
  const [toast,setToast]=useState(null);
  const [sortBy,setSortBy]=useState("price");
  const popularRoutes=[{from:"JFK",to:"LHR",label:"New York → London"},{from:"DXB",to:"SIN",label:"Dubai → Singapore"},{from:"CDG",to:"NRT",label:"Paris → Tokyo"},{from:"SYD",to:"BKK",label:"Sydney → Bangkok"}];

  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));

  const search=async()=>{
    if(!form.from||!form.to||!form.date){setToast({type:"warning",title:"Fill in all fields",body:"Origin, destination and date are required"});return;}
    setLoading(true);setSearched(true);setResults([]);
    const r=await searchFlights({origin:form.from.toUpperCase(),destination:form.to.toUpperCase(),date:form.date,adults:parseInt(form.adults)||1,cabin:form.cabin});
    setResults(r);setLoading(false);
  };

  const sorted=[...results].sort((a,b)=>sortBy==="price"?a.price-b.price:sortBy==="duration"?a.duration.localeCompare(b.duration):b.rating-(a.rating||4.5));

  const bookFlight=async(flight)=>{
    const booking=await addBooking({type:"flight",details:flight,price:flight.price,currency:flight.currency,passengers:parseInt(form.adults),from:flight.from,to:flight.to,date:form.date});
    setSelected(null);
    setToast({type:"success",title:"Flight Booked! ✈️",body:`Booking ref: ${booking.bookingRef}`});
    setTimeout(()=>setPage("bookings"),2000);
  };

  return <div>
    {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
    {/* Search header */}
    <div style={{background:"linear-gradient(135deg,#0B1F3A,#0E7FD5)",padding:"44px 24px 36px"}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>
        <h1 style={{color:"white",marginBottom:8}}>✈️ Flight Search</h1>
        <p style={{color:"rgba(255,255,255,.75)",marginBottom:28}}>Search real flights powered by Amadeus — sandbox returns genuine flight structures</p>

        {/* Trip type toggle */}
        <div style={{display:"inline-flex",background:"rgba(255,255,255,.12)",borderRadius:"var(--r-full)",padding:3,marginBottom:20}}>
          {["one-way","round-trip"].map(t=><button key={t} onClick={()=>setForm(f=>({...f,tripType:t}))} style={{padding:"8px 20px",borderRadius:"var(--r-full)",border:"none",fontFamily:"var(--font-b)",fontWeight:600,fontSize:".85rem",background:form.tripType===t?"white":"transparent",color:form.tripType===t?"var(--sky)":"rgba(255,255,255,.8)",cursor:"pointer",transition:"all .2s",textTransform:"capitalize"}}>{t}</button>)}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",gap:12,background:"rgba(255,255,255,.1)",padding:16,borderRadius:"var(--r-xl)",backdropFilter:"blur(8px)"}}>
          <Input label={<span style={{color:"rgba(255,255,255,.8)"}}>From (IATA code)</span>} placeholder="e.g. JFK, LHR" value={form.from} onChange={set("from")} style={{textTransform:"uppercase"}}/>
          <Input label={<span style={{color:"rgba(255,255,255,.8)"}}>To (IATA code)</span>} placeholder="e.g. DXB, NRT" value={form.to} onChange={set("to")} style={{textTransform:"uppercase"}}/>
          <Input label={<span style={{color:"rgba(255,255,255,.8)"}}>Departure Date</span>} type="date" value={form.date} onChange={set("date")}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <Select label={<span style={{color:"rgba(255,255,255,.8)"}}>Adults</span>} value={form.adults} onChange={set("adults")}>
              {[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}
            </Select>
            <Select label={<span style={{color:"rgba(255,255,255,.8)"}}>Cabin</span>} value={form.cabin} onChange={set("cabin")}>
              {["ECONOMY","PREMIUM_ECONOMY","BUSINESS","FIRST"].map(c=><option key={c} value={c}>{c.replace("_"," ")}</option>)}
            </Select>
          </div>
          <div style={{display:"flex",alignItems:"flex-end"}}>
            <Btn v="secondary" size="lg" onClick={search} disabled={loading} style={{height:46,whiteSpace:"nowrap"}}>
              {loading?<Spinner/>:"🔍 Search"}
            </Btn>
          </div>
        </div>

        {/* Popular routes */}
        <div style={{marginTop:16,display:"flex",gap:10,flexWrap:"wrap"}}>
          <span style={{color:"rgba(255,255,255,.6)",fontSize:".82rem",alignSelf:"center"}}>Popular:</span>
          {popularRoutes.map(r=><button key={r.label} onClick={()=>{setForm(f=>({...f,from:r.from,to:r.to}));}} style={{padding:"6px 14px",borderRadius:"var(--r-full)",border:"1px solid rgba(255,255,255,.25)",background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.85)",fontFamily:"var(--font-b)",fontSize:".8rem",cursor:"pointer"}}>{r.label}</button>)}
        </div>
      </div>
    </div>

    <div style={{maxWidth:1200,margin:"0 auto",padding:"24px"}}>
      {searched&&<>
        {/* Sort */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <p style={{color:"var(--ink3)",fontSize:".9rem"}}>{loading?"Searching…":`${results.length} flights found`}</p>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:".85rem",color:"var(--ink3)"}}>Sort:</span>
            {["price","duration","rating"].map(s=><button key={s} onClick={()=>setSortBy(s)} style={{padding:"6px 14px",borderRadius:"var(--r-full)",border:"1.5px solid",borderColor:sortBy===s?"var(--sky)":"var(--border)",background:sortBy===s?"var(--sky-l)":"transparent",color:sortBy===s?"var(--sky)":"var(--ink3)",fontFamily:"var(--font-b)",fontWeight:600,fontSize:".8rem",cursor:"pointer",textTransform:"capitalize"}}>{s}</button>)}
          </div>
        </div>

        {loading?<div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[1,2,3].map(i=><div key={i} className="skel" style={{height:100,borderRadius:"var(--r-lg)"}}/>)}
        </div>:<div style={{display:"flex",flexDirection:"column",gap:12}}>
          {sorted.map((f,i)=><Card key={f.id} className={`up s${Math.min(i+1,6)}`}>
            <div style={{padding:"18px 24px",display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
              <div style={{background:f.color||"var(--sky-l)",borderRadius:10,padding:"10px 14px",fontSize:24,flexShrink:0}}>✈️</div>
              <div style={{flex:1,minWidth:200}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontWeight:800,fontSize:"1rem"}}>{f.airline}</span>
                  <Badge color="var(--surface2)" text="var(--ink3)">{f.flightNo}</Badge>
                  <Badge color={f.cabin==="BUSINESS"||f.cabin==="Business"?"var(--gold-l)":"var(--sky-l)"} text={f.cabin==="BUSINESS"||f.cabin==="Business"?"var(--gold)":"var(--sky)"}>{f.cabin||"Economy"}</Badge>
                </div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:".88rem",color:"var(--ink2)"}}>
                  <span style={{fontWeight:700,fontSize:"1.05rem"}}>{f.departure} <span style={{color:"var(--ink4)",fontWeight:400,fontSize:".8rem"}}>{f.from}</span></span>
                  <span style={{color:"var(--ink4)"}}>——{f.duration}——→</span>
                  <span style={{fontWeight:700,fontSize:"1.05rem"}}>{f.arrival} <span style={{color:"var(--ink4)",fontWeight:400,fontSize:".8rem"}}>{f.to}</span></span>
                  <Badge color={f.stops===0?"var(--jade-l)":"var(--gold-l)"} text={f.stops===0?"var(--jade)":"var(--gold)"}>{f.stops===0?"Direct":`${f.stops} stop`}</Badge>
                  <span style={{color:"var(--ink4)"}}>💺 {f.seats} seats left</span>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{fontSize:"1.7rem",fontWeight:900,color:"var(--sky)",fontFamily:"var(--font-d)",lineHeight:1}}>{fmt(f.price,f.currency)}</p>
                <p style={{fontSize:".76rem",color:"var(--ink4)",marginBottom:10}}>per person</p>
                <Btn v="primary" size="sm" onClick={()=>setSelected(f)}>Select →</Btn>
              </div>
            </div>
          </Card>)}
        </div>}
      </>}

      {!searched&&<div style={{textAlign:"center",padding:"80px 0",color:"var(--ink3)"}}>
        <div style={{fontSize:64,marginBottom:16}}>✈️</div>
        <h3>Search for flights above</h3>
        <p>Use IATA airport codes (e.g. JFK, LHR, DXB, NRT)</p>
        <div style={{marginTop:20,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          {[["JFK","New York"],["LHR","London"],["DXB","Dubai"],["NRT","Tokyo"],["SIN","Singapore"],["SYD","Sydney"],["CDG","Paris"],["BKK","Bangkok"]].map(([code,city])=>(
            <div key={code} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--r-md)",padding:"10px 16px",textAlign:"center"}}>
              <p style={{fontWeight:800,color:"var(--sky)",fontSize:"1rem"}}>{code}</p>
              <p style={{fontSize:".75rem",color:"var(--ink3)"}}>{city}</p>
            </div>
          ))}
        </div>
      </div>}
    </div>

    {/* Booking modal */}
    <Modal open={!!selected} onClose={()=>setSelected(null)} title="Complete Your Booking" width={520}>
      {selected&&<div>
        <Card style={{padding:20,marginBottom:20,background:"var(--sky-l)",border:"none"}}>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <span style={{fontSize:32}}>✈️</span>
            <div>
              <p style={{fontWeight:800,fontSize:"1rem"}}>{selected.airline} · {selected.flightNo}</p>
              <p style={{color:"var(--sky)",fontWeight:700}}>{selected.from} → {selected.to} &nbsp;|&nbsp; {selected.departure} – {selected.arrival}</p>
              <p style={{fontSize:".85rem",color:"var(--ink3)"}}>{selected.duration} · {selected.stops===0?"Direct":`${selected.stops} stop`} · {selected.cabin}</p>
            </div>
          </div>
        </Card>

        <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
          <h4>Passenger Details</h4>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Input label="First Name" placeholder="John" />
            <Input label="Last Name" placeholder="Doe" />
          </div>
          <Input label="Email" type="email" placeholder="john@example.com" />
          <Input label="Passport Number" placeholder="AB1234567" />
          <Input label="Date of Birth" type="date" />
        </div>

        <div style={{background:"var(--surface2)",borderRadius:"var(--r-lg)",padding:16,marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{color:"var(--ink3)"}}>Base fare ({form.adults} pax)</span>
            <span style={{fontWeight:600}}>{fmt(selected.price*parseInt(form.adults||1),selected.currency)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{color:"var(--ink3)"}}>Taxes & fees</span>
            <span style={{fontWeight:600}}>{fmt(Math.round(selected.price*.12),selected.currency)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid var(--border)",paddingTop:10,marginTop:4}}>
            <span style={{fontWeight:800,fontSize:"1.05rem"}}>Total</span>
            <span style={{fontWeight:900,fontSize:"1.2rem",color:"var(--sky)"}}>{fmt(Math.round(selected.price*parseInt(form.adults||1)*1.12),selected.currency)}</span>
          </div>
        </div>

        <div style={{background:"var(--jade-l)",borderRadius:"var(--r-md)",padding:"10px 14px",marginBottom:16,fontSize:".82rem",color:"var(--jade)",fontWeight:600}}>
          🔒 Secure booking — demo mode (no real payment processed)
        </div>
        <Btn v="primary" size="xl" onClick={()=>bookFlight(selected)} full>Confirm & Book Flight →</Btn>
      </div>}
    </Modal>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   HOTELS PAGE
══════════════════════════════════════════════════════════════ */
function HotelsPage(){
  const {fmt,addBooking}=useTrips();
  const [form,setForm]=useState({city:"",cityCode:"",checkIn:"",checkOut:"",adults:"2"});
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [searched,setSearched]=useState(false);
  const [selected,setSelected]=useState(null);
  const [toast,setToast]=useState(null);
  const [filters,setFilters]=useState({maxPrice:1000,minRating:0,cat:"All"});
  const [sortBy,setSortBy]=useState("price");
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));

  const search=async()=>{
    if(!form.checkIn||!form.checkOut){setToast({type:"warning",title:"Select dates"});return;}
    setLoading(true);setSearched(true);setResults([]);
    const city=form.cityCode||form.city;
    const r=await searchHotels({cityCode:city.toUpperCase().slice(0,3),checkIn:form.checkIn,checkOut:form.checkOut,adults:parseInt(form.adults)});
    setResults(r);setLoading(false);
  };

  const nights=form.checkIn&&form.checkOut?Math.max(1,Math.ceil((new Date(form.checkOut)-new Date(form.checkIn))/(86400*1000))):1;
  const cats=["All","Budget","Mid-range","Business","Boutique","Luxury"];
  const filtered=results.filter(h=>h.price<=filters.maxPrice&&parseFloat(h.rating||0)>=filters.minRating&&(filters.cat==="All"||h.cat===filters.cat));
  const sorted=[...filtered].sort((a,b)=>sortBy==="price"?a.price-b.price:sortBy==="rating"?parseFloat(b.rating||0)-parseFloat(a.rating||0):0);

  const bookHotel=async(hotel)=>{
    const b=await addBooking({type:"hotel",details:hotel,price:hotel.price*nights,currency:hotel.currency||"USD",nights,checkIn:form.checkIn,checkOut:form.checkOut,guests:form.adults});
    setSelected(null);
    setToast({type:"success",title:"Hotel Booked! 🏨",body:`Ref: ${b.bookingRef} · ${nights} nights`});
  };

  const popularCities=[{city:"Paris",code:"PAR"},{city:"Tokyo",code:"TYO"},{city:"Dubai",code:"DXB"},{city:"Bali",code:"DPS"},{city:"Bangkok",code:"BKK"},{city:"New York",code:"NYC"}];

  return <div>
    {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
    <div style={{background:"linear-gradient(135deg,#C43D3D,#FF5757)",padding:"44px 24px 36px"}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>
        <h1 style={{color:"white",marginBottom:8}}>🏨 Hotel Search</h1>
        <p style={{color:"rgba(255,255,255,.8)",marginBottom:24}}>Compare hotels worldwide — real availability via Amadeus sandbox</p>
        <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr auto",gap:12,background:"rgba(255,255,255,.1)",padding:16,borderRadius:"var(--r-xl)",backdropFilter:"blur(8px)"}}>
          <Input label={<span style={{color:"rgba(255,255,255,.8)"}}>City</span>} placeholder="e.g. Paris, Tokyo, Dubai" value={form.city} onChange={set("city")}/>
          <Input label={<span style={{color:"rgba(255,255,255,.8)"}}>Check-in</span>} type="date" value={form.checkIn} onChange={set("checkIn")}/>
          <Input label={<span style={{color:"rgba(255,255,255,.8)"}}>Check-out</span>} type="date" value={form.checkOut} onChange={set("checkOut")}/>
          <Select label={<span style={{color:"rgba(255,255,255,.8)"}}>Guests</span>} value={form.adults} onChange={set("adults")}>
            {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} guest{n>1?"s":""}</option>)}
          </Select>
          <div style={{display:"flex",alignItems:"flex-end"}}>
            <Btn v="primary" size="lg" onClick={search} disabled={loading} style={{height:46,background:"white",color:"var(--coral)"}}>
              {loading?<span style={{color:"var(--coral)"}}><Spinner/></span>:"🔍 Search"}
            </Btn>
          </div>
        </div>
        <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
          <span style={{color:"rgba(255,255,255,.6)",fontSize:".82rem",alignSelf:"center"}}>Popular:</span>
          {popularCities.map(c=><button key={c.code} onClick={()=>setForm(f=>({...f,city:c.city,cityCode:c.code}))} style={{padding:"5px 12px",borderRadius:"var(--r-full)",border:"1px solid rgba(255,255,255,.25)",background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.85)",fontFamily:"var(--font-b)",fontSize:".8rem",cursor:"pointer"}}>{c.city}</button>)}
        </div>
      </div>
    </div>

    <div style={{maxWidth:1200,margin:"0 auto",padding:"24px"}}>
      {searched&&<>
        {/* Filters */}
        <Card style={{padding:"16px 20px",marginBottom:20,display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{flex:1,minWidth:160}}>
            <label style={{fontSize:".84rem",fontWeight:700,display:"block",marginBottom:6}}>Max Price: <span style={{color:"var(--sky)"}}>{fmt(filters.maxPrice)}/night</span></label>
            <input type="range" min={20} max={1000} step={10} value={filters.maxPrice} onChange={e=>setFilters(f=>({...f,maxPrice:+e.target.value}))} style={{width:"100%",accentColor:"var(--sky)"}}/>
          </div>
          <div style={{flex:1,minWidth:160}}>
            <label style={{fontSize:".84rem",fontWeight:700,display:"block",marginBottom:6}}>Min Rating: <span style={{color:"var(--sky)"}}>{filters.minRating}★</span></label>
            <input type="range" min={0} max={5} step={0.5} value={filters.minRating} onChange={e=>setFilters(f=>({...f,minRating:+e.target.value}))} style={{width:"100%",accentColor:"var(--sky)"}}/>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {cats.map(c=><button key={c} onClick={()=>setFilters(f=>({...f,cat:c}))} style={{padding:"6px 12px",borderRadius:"var(--r-full)",border:"1.5px solid",borderColor:filters.cat===c?"var(--sky)":"var(--border)",background:filters.cat===c?"var(--sky-l)":"transparent",color:filters.cat===c?"var(--sky)":"var(--ink3)",fontFamily:"var(--font-b)",fontWeight:600,fontSize:".8rem",cursor:"pointer"}}>{c}</button>)}
          </div>
          <div style={{display:"flex",gap:6}}>
            {["price","rating"].map(s=><button key={s} onClick={()=>setSortBy(s)} style={{padding:"6px 12px",borderRadius:"var(--r-full)",border:"1.5px solid",borderColor:sortBy===s?"var(--coral)":"var(--border)",background:sortBy===s?"#FEE":"transparent",color:sortBy===s?"var(--coral)":"var(--ink3)",fontFamily:"var(--font-b)",fontWeight:600,fontSize:".8rem",cursor:"pointer",textTransform:"capitalize"}}>{s}</button>)}
          </div>
        </Card>

        <p style={{color:"var(--ink3)",marginBottom:16,fontSize:".9rem"}}>{loading?"Searching…":`${sorted.length} hotels found · ${nights} night${nights>1?"s":""}`}</p>

        {loading?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
          {[1,2,3,4].map(i=><div key={i} className="skel" style={{height:280,borderRadius:"var(--r-lg)"}}/>)}
        </div>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
          {sorted.map((h,i)=><Card key={h.id} className={`up s${(i%6)+1}`} style={{overflow:"hidden"}}>
            <div style={{position:"relative"}}>
              <img src={h.img||`https://source.unsplash.com/600x300/?hotel,${h.cat?.toLowerCase()}`} alt={h.name} style={{width:"100%",height:180,objectFit:"cover"}}/>
              <div style={{position:"absolute",top:10,left:10}}><Badge color="rgba(0,0,0,.65)" text="white">{"⭐".repeat(Math.min(h.stars||3,5))}</Badge></div>
              {h.cat&&<div style={{position:"absolute",top:10,right:10}}><Badge>{h.cat}</Badge></div>}
            </div>
            <div style={{padding:"14px 16px"}}>
              <h4 style={{marginBottom:4,fontSize:".95rem"}}>{h.name}</h4>
              {h.address&&<p style={{fontSize:".78rem",color:"var(--ink4)",marginBottom:6}}>📍 {h.address.slice(0,50)}</p>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <Stars r={parseFloat(h.rating)||4.0}/>
                <span style={{fontSize:".78rem",color:"var(--ink4)"}}>{h.reviews||"500+"} reviews</span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
                {(h.amenities||[]).slice(0,4).map(a=><Badge key={a} color="var(--surface2)" text="var(--ink3)" size="sm">{a}</Badge>)}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:"1px solid var(--border)"}}>
                <div>
                  <span style={{fontSize:"1.3rem",fontWeight:900,color:"var(--coral)",fontFamily:"var(--font-d)"}}>{fmt(h.price)}</span>
                  <span style={{fontSize:".76rem",color:"var(--ink4)"}}>/night</span>
                  <p style={{fontSize:".78rem",color:"var(--ink3)"}}>Total: {fmt(h.price*nights)} for {nights}n</p>
                </div>
                <Btn v="secondary" size="sm" onClick={()=>setSelected(h)}>Book Now</Btn>
              </div>
            </div>
          </Card>)}
        </div>}
      </>}

      {!searched&&<div style={{textAlign:"center",padding:"60px 0",color:"var(--ink3)"}}>
        <div style={{fontSize:60,marginBottom:12}}>🏨</div>
        <h3>Find your perfect stay</h3>
        <p>Enter a city and dates to compare hotels worldwide</p>
      </div>}
    </div>

    <Modal open={!!selected} onClose={()=>setSelected(null)} title="Complete Hotel Booking" width={500}>
      {selected&&<div>
        <img src={selected.img||`https://source.unsplash.com/500x200/?hotel`} alt={selected.name} style={{width:"100%",height:180,objectFit:"cover",borderRadius:"var(--r-lg)",marginBottom:16}}/>
        <h4 style={{marginBottom:4}}>{selected.name}</h4>
        <p style={{color:"var(--ink3)",fontSize:".85rem",marginBottom:16}}>{"⭐".repeat(selected.stars||3)} · {selected.roomType} · {form.adults} guest{parseInt(form.adults)>1?"s":""}</p>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Input label="First Name" placeholder="John"/>
            <Input label="Last Name" placeholder="Doe"/>
          </div>
          <Input label="Email" type="email" placeholder="john@example.com"/>
          <Input label="Phone" placeholder="+1 234 567 8900"/>
          <Select label="Special Requests"><option>None</option><option>Early check-in</option><option>Late check-out</option><option>High floor</option><option>Quiet room</option></Select>
        </div>
        <div style={{background:"var(--surface2)",borderRadius:"var(--r-lg)",padding:16,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"var(--ink3)"}}>Room/night</span><span style={{fontWeight:600}}>{fmt(selected.price)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"var(--ink3)"}}>Nights</span><span style={{fontWeight:600}}>{nights}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"var(--ink3)"}}>Taxes (12%)</span><span style={{fontWeight:600}}>{fmt(Math.round(selected.price*nights*.12))}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid var(--border)",paddingTop:10,marginTop:4}}><span style={{fontWeight:800}}>Total</span><span style={{fontWeight:900,fontSize:"1.2rem",color:"var(--coral)"}}>{fmt(Math.round(selected.price*nights*1.12))}</span></div>
        </div>
        <div style={{background:"var(--jade-l)",borderRadius:"var(--r-md)",padding:"10px 14px",marginBottom:14,fontSize:".82rem",color:"var(--jade)",fontWeight:600}}>🔒 Demo booking — no real payment processed</div>
        <Btn v="secondary" size="xl" onClick={()=>bookHotel(selected)} full>Confirm & Book Hotel →</Btn>
      </div>}
    </Modal>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   CABS PAGE
══════════════════════════════════════════════════════════════ */
function CabsPage(){
  const {fmt,addBooking}=useTrips();
  const [form,setForm]=useState({from:"",to:"",date:"",time:"",passengers:"2"});
  const [results,setResults]=useState([]);
  const [searched,setSearched]=useState(false);
  const [selected,setSelected]=useState(null);
  const [toast,setToast]=useState(null);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));

  const search=()=>{ if(!form.from||!form.to){setToast({type:"warning",title:"Enter pickup & dropoff"});return;} setResults(generateCabOptions(form.to)); setSearched(true); };

  const book=async(cab)=>{
    const b=await addBooking({type:"cab",details:cab,price:cab.price,currency:cab.currency,from:form.from,to:form.to,date:form.date,time:form.time});
    setSelected(null); setToast({type:"success",title:"Cab Booked! 🚕",body:`Ref: ${b.bookingRef}`});
  };

  return <div>
    {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
    <div style={{background:"linear-gradient(135deg,#D4880F,#F5A623)",padding:"44px 24px 36px"}}>
      <div style={{maxWidth:1000,margin:"0 auto"}}>
        <h1 style={{color:"white",marginBottom:8}}>🚕 Book a Cab / Transfer</h1>
        <p style={{color:"rgba(255,255,255,.85)",marginBottom:24}}>Airport pickups, city transfers, and local rides worldwide</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",gap:12,background:"rgba(255,255,255,.15)",padding:16,borderRadius:"var(--r-xl)",backdropFilter:"blur(8px)"}}>
          <Input label={<span style={{color:"rgba(255,255,255,.85)"}}>Pickup Location</span>} placeholder="e.g. Airport Terminal 1" value={form.from} onChange={set("from")}/>
          <Input label={<span style={{color:"rgba(255,255,255,.85)"}}>Drop-off Location</span>} placeholder="e.g. City Centre Hotel" value={form.to} onChange={set("to")}/>
          <Input label={<span style={{color:"rgba(255,255,255,.85)"}}>Date</span>} type="date" value={form.date} onChange={set("date")}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <Input label={<span style={{color:"rgba(255,255,255,.85)"}}>Time</span>} type="time" value={form.time} onChange={set("time")}/>
            <Select label={<span style={{color:"rgba(255,255,255,.85)"}}>Pax</span>} value={form.passengers} onChange={set("passengers")}>
              {[1,2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}
            </Select>
          </div>
          <div style={{display:"flex",alignItems:"flex-end"}}>
            <Btn v="primary" size="lg" onClick={search} style={{height:46,background:"white",color:"var(--gold)"}}>🔍 Find</Btn>
          </div>
        </div>
      </div>
    </div>

    <div style={{maxWidth:1000,margin:"0 auto",padding:"28px 24px"}}>
      {searched&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        {results.map((c,i)=><Card key={c.id} className={`up s${i+1}`}>
          <div style={{padding:"20px 24px",display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
            <div style={{fontSize:40}}>{c.icon}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                <h4>{c.type}</h4>
                <Badge color="var(--gold-l)" text="var(--gold)">{c.company}</Badge>
              </div>
              <p style={{color:"var(--ink3)",fontSize:".88rem",marginBottom:6}}>{form.from} → {form.to} &nbsp;·&nbsp; ⏱ {c.duration} &nbsp;·&nbsp; 👥 Up to {c.capacity} passengers</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {c.features.map(f=><Badge key={f} color="var(--surface2)" text="var(--ink3)">{f}</Badge>)}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <Stars r={c.rating}/>
              <p style={{fontSize:"1.6rem",fontWeight:900,color:"var(--gold)",fontFamily:"var(--font-d)",lineHeight:1,marginTop:4}}>{fmt(c.price,c.currency)}</p>
              <p style={{fontSize:".78rem",color:"var(--ink4)",marginBottom:10}}>per vehicle</p>
              <Btn v="gold" size="sm" onClick={()=>setSelected(c)}>Book Now</Btn>
            </div>
          </div>
        </Card>)}
      </div>}
      {!searched&&<div style={{textAlign:"center",padding:"60px 0",color:"var(--ink3)"}}>
        <div style={{fontSize:60,marginBottom:12}}>🚕</div>
        <h3>Enter pickup and drop-off locations</h3>
        <p>We'll show you all available transfer options</p>
      </div>}
    </div>

    <Modal open={!!selected} onClose={()=>setSelected(null)} title="Book Your Transfer" width={460}>
      {selected&&<div>
        <div style={{background:"var(--gold-l)",borderRadius:"var(--r-lg)",padding:16,marginBottom:20,display:"flex",gap:14,alignItems:"center"}}>
          <span style={{fontSize:36}}>{selected.icon}</span>
          <div><h4>{selected.type}</h4><p style={{color:"var(--ink3)",fontSize:".85rem"}}>{selected.company} · {selected.duration}</p></div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Input label="First Name" placeholder="John"/>
            <Input label="Last Name" placeholder="Doe"/>
          </div>
          <Input label="Phone / WhatsApp" placeholder="+1 234 567 8900"/>
          <Input label="Flight Number (if airport)" placeholder="e.g. EK512"/>
        </div>
        <div style={{background:"var(--surface2)",borderRadius:"var(--r-lg)",padding:14,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--ink3)"}}>Transfer fee</span><span style={{fontWeight:800,fontSize:"1.1rem",color:"var(--gold)"}}>{fmt(selected.price,selected.currency)}</span></div>
        </div>
        <div style={{background:"var(--jade-l)",borderRadius:"var(--r-md)",padding:"10px 14px",marginBottom:14,fontSize:".82rem",color:"var(--jade)",fontWeight:600}}>🔒 Demo booking — driver contact will be shared</div>
        <Btn v="gold" size="xl" onClick={()=>book(selected)} full>Confirm Transfer →</Btn>
      </div>}
    </Modal>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   ATTRACTIONS PAGE
══════════════════════════════════════════════════════════════ */
function AttractionsPage(){
  const {fmt}=useTrips();
  const [destFilter,setDestFilter]=useState("All");
  const [catFilter,setCatFilter]=useState("All");
  const [search,setSearch]=useState("");
  const [reviews,setReviews]=useState({});
  const [selected,setSelected]=useState(null);
  const [reviewModal,setReviewModal]=useState(null);
  const {user}=useAuth();

  const ATTRACTIONS=[
    {id:"a1",dest:"Bali",destId:"bali",name:"Tegallalang Rice Terraces",cat:"🌿 Nature",rating:4.6,reviews:8340,ticket:3,duration:"1–2 hrs",img:"https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=700&q=80",desc:"Iconic emerald terraced rice paddies — UNESCO Subak irrigation system.",tips:["Go before 8am","Bring cash","Wear good shoes"],hours:"07:00–18:00",lat:-8.431,lng:115.279},
    {id:"a2",dest:"Bali",destId:"bali",name:"Tanah Lot Temple",cat:"🛕 Temple",rating:4.7,reviews:15680,ticket:4,duration:"1–3 hrs",img:"https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=700&q=80",desc:"Sea temple on a rocky outcrop — spectacular at sunset.",tips:["Arrive 1hr before sunset","Non-Hindus can enter outer area"],hours:"07:00–19:00",lat:-8.621,lng:115.087},
    {id:"a3",dest:"Bali",destId:"bali",name:"Seminyak Beach",cat:"🏖️ Beach",rating:4.5,reviews:12300,ticket:0,duration:"2–6 hrs",img:"https://images.unsplash.com/photo-1559628376-f3fe943e5e2e?w=700&q=80",desc:"Glamorous beach strip with beach clubs and legendary sunsets.",tips:["Beach clubs free with F&B minimum","Strong rip currents"],hours:"Open 24h",lat:-8.691,lng:115.157},
    {id:"a4",dest:"Paris",destId:"paris",name:"Eiffel Tower",cat:"🏛️ Landmark",rating:4.7,reviews:48200,ticket:29,duration:"2–3 hrs",img:"https://images.unsplash.com/photo-1431274172761-fca41d930114?w=700&q=80",desc:"Paris's universally iconic iron lattice tower with breathtaking city views.",tips:["Book online 3 weeks ahead","Visit after dark for sparkle show"],hours:"09:30–23:45",lat:48.858,lng:2.295},
    {id:"a5",dest:"Paris",destId:"paris",name:"Louvre Museum",cat:"🎨 Museum",rating:4.8,reviews:62400,ticket:22,duration:"3–6 hrs",img:"https://images.unsplash.com/photo-1499856871958-5b9357976b82?w=700&q=80",desc:"World's largest art museum — Mona Lisa, Venus de Milo, 35,000 works.",tips:["Book timed entry online","Enter via Richelieu wing","Wed/Fri evenings less crowded"],hours:"09:00–18:00, Wed/Fri till 21:45",lat:48.861,lng:2.338},
    {id:"a6",dest:"Tokyo",destId:"tokyo",name:"Senso-ji Temple",cat:"🛕 Temple",rating:4.7,reviews:31600,ticket:0,duration:"1–2 hrs",img:"https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=700&q=80",desc:"Tokyo's oldest Buddhist shrine — Kaminarimon Thunder Gate & Nakamise street.",tips:["Arrive before 8am","Try Omikuji (¥100)","Buy ningyo-yaki sweets"],hours:"Always open (main hall 06:00–17:00)",lat:35.714,lng:139.797},
    {id:"a7",dest:"Tokyo",destId:"tokyo",name:"Shibuya Crossing",cat:"🏛️ Landmark",rating:4.8,reviews:41200,ticket:0,duration:"30 min",img:"https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=700&q=80",desc:"World's busiest pedestrian scramble — kinetic organised chaos.",tips:["View from Mag's Park rooftop","Peak: weekday 17:00–19:00"],hours:"Open 24h",lat:35.659,lng:139.700},
    {id:"a8",dest:"Dubai",destId:"dubai",name:"Burj Khalifa",cat:"🏛️ Landmark",rating:4.7,reviews:38900,ticket:40,duration:"1–2 hrs",img:"https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=700&q=80",desc:"World's tallest building at 828m — observation deck views are staggering.",tips:["Book sunset slot weeks ahead","Level 124 vs Level 148 (premium)"],hours:"08:30–23:00",lat:25.197,lng:55.274},
    {id:"a9",dest:"Rome",destId:"rome",name:"Colosseum",cat:"🏛️ Landmark",rating:4.8,reviews:55000,ticket:18,duration:"2–3 hrs",img:"https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=700&q=80",desc:"Ancient Roman amphitheatre — 2,000 years of gladiatorial history.",tips:["Book combo with Roman Forum","Go at opening or 2 hrs before close"],hours:"09:00–19:00",lat:41.890,lng:12.492},
    {id:"a10",dest:"Sydney",destId:"sydney",name:"Sydney Opera House",cat:"🏛️ Landmark",rating:4.8,reviews:44200,ticket:35,duration:"1–3 hrs",img:"https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=700&q=80",desc:"Jørn Utzon's sail-shaped masterpiece — tour the inside or catch a performance.",tips:["Book a show for the real experience","Free to walk the outside any time"],hours:"09:00–17:00 (tours)",lat:-33.857,lng:151.215},
    {id:"a11",dest:"Cairo",destId:"cairo",name:"Pyramids of Giza",cat:"🏛️ Landmark",rating:4.9,reviews:67000,ticket:15,duration:"3–5 hrs",img:"https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=700&q=80",desc:"One of the Seven Wonders of the Ancient World — utterly awe-inspiring.",tips:["Camel rides negotiable","Go early to beat heat","Hire a local guide"],hours:"08:00–17:00",lat:29.979,lng:31.134},
    {id:"a12",dest:"Machu Picchu",destId:"machu",name:"Machu Picchu Citadel",cat:"🏔️ Nature",rating:4.9,reviews:28400,ticket:55,duration:"4–8 hrs",img:"https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=700&q=80",desc:"The Lost City of the Incas — 15th century citadel in the Andes clouds.",tips:["Book entry 3 months ahead","Sunrise slot magical","Altitude sickness possible"],hours:"06:00–17:30",lat:-13.163,lng:-72.545},
  ];

  const dests=["All",...new Set(ATTRACTIONS.map(a=>a.dest))];
  const cats=["All",...new Set(ATTRACTIONS.map(a=>a.cat))];
  const filtered=ATTRACTIONS.filter(a=>(destFilter==="All"||a.dest===destFilter)&&(catFilter==="All"||a.cat===catFilter)&&(!search||a.name.toLowerCase().includes(search.toLowerCase())));

  const loadReviews=async(id)=>{ const r=await getReviews(id); setReviews(p=>({...p,[id]:r})); };
  const openAttr=async(a)=>{ setSelected(a); loadReviews(a.id); };

  return <div>
    <div style={{background:"linear-gradient(135deg,#1a3a6b,#7C6FCD)",padding:"44px 24px 36px"}}>
      <div style={{maxWidth:1400,margin:"0 auto"}}>
        <h1 style={{color:"white",marginBottom:8}}>🗺️ Attractions Guide</h1>
        <p style={{color:"rgba(255,255,255,.8)",marginBottom:20}}>Top-rated sights, experiences and activities across the world's best destinations</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search attractions…" style={{flex:1,minWidth:200,padding:"12px 18px",border:"none",borderRadius:"var(--r-lg)",fontSize:".9rem",fontFamily:"var(--font-b)",outline:"none"}}/>
          <select value={destFilter} onChange={e=>setDestFilter(e.target.value)} style={{padding:"12px 16px",borderRadius:"var(--r-lg)",border:"none",fontFamily:"var(--font-b)",fontSize:".9rem",background:"rgba(255,255,255,.15)",color:"white",cursor:"pointer",outline:"none"}}>
            {dests.map(d=><option key={d} style={{color:"var(--ink)"}}>{d}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14}}>
          {cats.map(c=><button key={c} onClick={()=>setCatFilter(c)} style={{padding:"6px 14px",borderRadius:"var(--r-full)",border:"1px solid rgba(255,255,255,.3)",background:catFilter===c?"white":"rgba(255,255,255,.1)",color:catFilter===c?"var(--lavender)":"rgba(255,255,255,.85)",fontFamily:"var(--font-b)",fontWeight:600,fontSize:".8rem",cursor:"pointer"}}>{c}</button>)}
        </div>
      </div>
    </div>

    <div style={{maxWidth:1400,margin:"0 auto",padding:"24px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:20}}>
        {filtered.map((a,i)=><Card key={a.id} onClick={()=>openAttr(a)} className={`up s${(i%6)+1}`}>
          <div style={{position:"relative",overflow:"hidden",borderRadius:"var(--r-lg) var(--r-lg) 0 0"}}>
            <img src={a.img} alt={a.name} style={{width:"100%",height:185,objectFit:"cover",transition:"transform .4s"}}
              onMouseEnter={e=>e.target.style.transform="scale(1.08)"}
              onMouseLeave={e=>e.target.style.transform="scale(1)"}/>
            <div style={{position:"absolute",top:10,left:10}}><Badge color="rgba(0,0,0,.65)" text="white">{a.cat}</Badge></div>
            {a.ticket===0&&<div style={{position:"absolute",top:10,right:10}}><Badge color="var(--jade-l)" text="var(--jade)">Free Entry</Badge></div>}
          </div>
          <div style={{padding:"14px 16px"}}>
            <h4 style={{marginBottom:3,fontSize:".95rem"}}>{a.name}</h4>
            <p style={{fontSize:".78rem",color:"var(--ink4)",marginBottom:8}}>📍 {a.dest}</p>
            <p style={{fontSize:".83rem",color:"var(--ink3)",lineHeight:1.5,marginBottom:10}}>{a.desc}</p>
            <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid var(--border)",alignItems:"center"}}>
              <Stars r={a.rating}/>
              <div style={{fontSize:".8rem",color:"var(--ink3)",textAlign:"right"}}>
                <p>⏱ {a.duration}</p>
                <p style={{fontWeight:700,color:a.ticket===0?"var(--jade)":"var(--ink2)"}}>🎫 {a.ticket===0?"Free":`$${a.ticket}`}</p>
              </div>
            </div>
          </div>
        </Card>)}
      </div>
    </div>

    <Modal open={!!selected} onClose={()=>setSelected(null)} title={selected?.name||""} width={620}>
      {selected&&<div>
        <img src={selected.img} alt={selected.name} style={{width:"100%",height:220,objectFit:"cover",borderRadius:"var(--r-lg)",marginBottom:20}}/>
        <p style={{color:"var(--ink2)",lineHeight:1.7,marginBottom:16}}>{selected.desc}</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {[["⏱️ Duration",selected.duration],["🎫 Entry",selected.ticket===0?"Free":`$${selected.ticket}/adult`],["🕐 Hours",selected.hours],["⭐ Rating",`${selected.rating} (${selected.reviews.toLocaleString()})`]].map(([l,v])=><div key={l} style={{background:"var(--surface2)",borderRadius:"var(--r-md)",padding:"12px 14px"}}>
            <p style={{fontSize:".74rem",color:"var(--ink4)",marginBottom:4}}>{l}</p>
            <p style={{fontWeight:700,fontSize:".88rem"}}>{v}</p>
          </div>)}
        </div>
        <h4 style={{marginBottom:10}}>💡 Insider Tips</h4>
        <ul style={{paddingLeft:18,color:"var(--ink3)",fontSize:".85rem",lineHeight:2,marginBottom:20}}>
          {selected.tips.map(t=><li key={t}>{t}</li>)}
        </ul>
        {/* Reviews */}
        <h4 style={{marginBottom:10}}>📝 Visitor Reviews</h4>
        {(reviews[selected.id]||[]).length===0?<p style={{color:"var(--ink4)",fontSize:".85rem",marginBottom:12}}>No reviews yet — be the first!</p>:(reviews[selected.id]||[]).map(r=><div key={r.id} style={{background:"var(--surface2)",borderRadius:"var(--r-md)",padding:"12px 14px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontWeight:700,fontSize:".88rem"}}>{r.userName}</span><Stars r={r.rating}/></div>
          <p style={{fontSize:".85rem",color:"var(--ink3)"}}>{r.comment}</p>
        </div>)}
        <Btn v="outline" size="sm" onClick={()=>setReviewModal(selected)}>+ Write a Review</Btn>
      </div>}
    </Modal>

    <Modal open={!!reviewModal} onClose={()=>setReviewModal(null)} title={`Review: ${reviewModal?.name}`} width={440}>
      {reviewModal&&<ReviewForm targetId={reviewModal.id} targetName={reviewModal.name} onClose={()=>setReviewModal(null)} onSaved={()=>{ loadReviews(reviewModal.id); setReviewModal(null); }}/>}
    </Modal>
  </div>;
}

function ReviewForm({targetId,targetName,onClose,onSaved}){
  const {user,profile}=useAuth();
  const [form,setForm]=useState({rating:5,comment:""});
  const [loading,setLoading]=useState(false);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));

  const submit=async()=>{
    if(!form.comment.trim())return;
    setLoading(true);
    await saveReview(user.uid,{targetId,targetType:"attraction",rating:form.rating,comment:form.comment,userName:profile?.name||user?.displayName||"Anonymous"});
    setLoading(false); onSaved();
  };

  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div>
      <label style={{fontSize:".84rem",fontWeight:700,display:"block",marginBottom:8}}>Your Rating</label>
      <div style={{display:"flex",gap:6}}>
        {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setForm(f=>({...f,rating:n}))} style={{fontSize:28,background:"none",border:"none",cursor:"pointer",color:n<=form.rating?"#F5A623":"#ccc",transition:"color .15s"}}>★</button>)}
      </div>
    </div>
    <div>
      <label style={{fontSize:".84rem",fontWeight:700,display:"block",marginBottom:6}}>Your Review</label>
      <textarea value={form.comment} onChange={set("comment")} placeholder="Share your experience…" rows={4} style={{width:"100%",padding:"11px 16px",border:"1.5px solid var(--border)",borderRadius:"var(--r-md)",fontFamily:"var(--font-b)",fontSize:".95rem",resize:"vertical",outline:"none"}}/>
    </div>
    <div style={{display:"flex",gap:10}}>
      <Btn v="ghost" onClick={onClose} style={{flex:1}}>Cancel</Btn>
      <Btn v="primary" onClick={submit} disabled={loading||!form.comment.trim()} style={{flex:1}}>{loading?<Spinner/>:"Submit Review"}</Btn>
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   TRIP PLANNER
══════════════════════════════════════════════════════════════ */
function PlannerPage({setPage}){
  const {addTrip}=useTrips();
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({destination:"",destId:"",startDate:"",endDate:"",adults:2,children:0,budget:3000,currency:"USD",style:"mid-range",interests:[],accommodation:"hotel"});
  const [created,setCreated]=useState(null);
  const [loading,setLoading]=useState(false);
  const set=k=>v=>setForm(f=>({...f,[k]:v?.target?.value??v}));
  const toggleInterest=i=>setForm(f=>({...f,interests:f.interests.includes(i)?f.interests.filter(x=>x!==i):[...f.interests,i]}));

  const allInterests=["🏖️ Beaches","🏛️ Culture","🍜 Food","🧗 Adventure","🌿 Nature","🏛️ History","🎭 Nightlife","🧘 Wellness","🛍️ Shopping","📷 Photography","⛷️ Skiing","🏄 Surfing","🦁 Wildlife","🍷 Wine","🎵 Music"];

  const create=async()=>{
    setLoading(true);
    const nights=Math.max(1,Math.ceil((new Date(form.endDate)-new Date(form.startDate))/(86400*1000)));
    const dest=WORLD_DESTINATIONS.find(d=>d.name.toLowerCase()===form.destination.toLowerCase())||WORLD_DESTINATIONS.find(d=>d.id===form.destId);
    const tripData={title:`${form.destination} – ${nights} Night${nights>1?"s":""}`,destination:form.destination,destId:dest?.id||form.destId,coverImg:dest?.img||`https://source.unsplash.com/600x400/?${encodeURIComponent(form.destination)},travel`,startDate:form.startDate,endDate:form.endDate,adults:form.adults,children:form.children,budget:form.budget,currency:form.currency,style:form.style,interests:form.interests,accommodation:form.accommodation,status:"planning",itinerary:generateItinerary(form.startDate,form.endDate)};
    const t=await addTrip(tripData);
    setCreated(t); setStep(4); setLoading(false);
  };

  const generateItinerary=(start,end)=>{
    const days=Math.max(1,Math.ceil((new Date(end)-new Date(start))/(86400*1000)));
    const themes=["Arrival & First Impressions","Cultural Deep Dive","Nature & Adventure","Local Neighbourhood","Leisure & Relaxation","Hidden Gems","Farewell Day"];
    return Array.from({length:days},(_,i)=>({day:i+1,date:new Date(new Date(start).getTime()+i*86400000).toISOString().split("T")[0],theme:themes[i%themes.length],items:[]}));
  };

  const steps=["Destination","Dates & Travelers","Preferences","Done!"];

  return <div style={{maxWidth:760,margin:"0 auto",padding:"32px 24px"}}>
    <h2 style={{marginBottom:4}}>✨ Plan a New Trip</h2>
    <p style={{color:"var(--ink3)",marginBottom:28}}>Answer a few questions and we'll set up your complete trip plan.</p>

    {/* Progress */}
    <div style={{display:"flex",gap:0,marginBottom:32,position:"relative"}}>
      <div style={{position:"absolute",top:17,left:"12.5%",right:"12.5%",height:2,background:"var(--border)",zIndex:0}}/>
      <div style={{position:"absolute",top:17,left:"12.5%",width:`${Math.min(100,(step-1)/3*100)}%`,height:2,background:"var(--sky)",zIndex:1,transition:"width .5s var(--ease)"}}/>
      {steps.map((l,i)=><div key={i} style={{flex:1,textAlign:"center",position:"relative",zIndex:2}}>
        <div style={{width:36,height:36,borderRadius:"50%",margin:"0 auto 6px",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:".88rem",transition:"all .3s",background:step>i+1?"var(--jade)":step===i+1?"var(--sky)":"var(--surface)",border:`2px solid ${step>=i+1?"transparent":"var(--border)"}`,color:step>=i+1?"white":"var(--ink4)"}}>{step>i+1?"✓":i+1}</div>
        <p style={{fontSize:".74rem",fontWeight:700,color:step===i+1?"var(--sky)":"var(--ink4)"}}>{l}</p>
      </div>)}
    </div>

    <Card style={{padding:32}}>
      {step===1&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
        <h3>📍 Where to?</h3>
        <Input label="Destination" placeholder="e.g. Bali, Paris, Tokyo…" value={form.destination} onChange={set("destination")}/>
        <div>
          <p style={{fontSize:".84rem",fontWeight:700,marginBottom:10,color:"var(--ink2)"}}>Or pick from our 60+ destinations:</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,maxHeight:200,overflowY:"auto"}}>
            {WORLD_DESTINATIONS.map(d=><button key={d.id} onClick={()=>setForm(f=>({...f,destination:d.name,destId:d.id}))} style={{padding:"7px 14px",borderRadius:"var(--r-full)",border:"1.5px solid",borderColor:form.destId===d.id?"var(--sky)":"var(--border)",background:form.destId===d.id?"var(--sky-l)":"var(--surface)",color:form.destId===d.id?"var(--sky)":"var(--ink3)",fontFamily:"var(--font-b)",fontWeight:600,fontSize:".8rem",cursor:"pointer",transition:"all .15s"}}>{d.name}, {d.country}</button>)}
          </div>
        </div>
        <Btn v="primary" size="lg" onClick={()=>setStep(2)} disabled={!form.destination} full>Next: Dates →</Btn>
      </div>}

      {step===2&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
        <h3>📅 When & Who?</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Input label="Start Date" type="date" value={form.startDate} onChange={set("startDate")}/>
          <Input label="End Date" type="date" value={form.endDate} onChange={set("endDate")}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div>
            <label style={{fontSize:".84rem",fontWeight:700,display:"block",marginBottom:6}}>Adults</label>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>setForm(f=>({...f,adults:Math.max(1,f.adults-1)}))} style={{width:36,height:36,borderRadius:"50%",border:"1.5px solid var(--border)",background:"var(--surface)",cursor:"pointer",fontSize:18,fontWeight:700}}>−</button>
              <span style={{fontWeight:800,fontSize:"1.2rem",minWidth:24,textAlign:"center"}}>{form.adults}</span>
              <button onClick={()=>setForm(f=>({...f,adults:f.adults+1}))} style={{width:36,height:36,borderRadius:"50%",border:"1.5px solid var(--sky)",background:"var(--sky-l)",cursor:"pointer",fontSize:18,fontWeight:700,color:"var(--sky)"}}>+</button>
            </div>
          </div>
          <div>
            <label style={{fontSize:".84rem",fontWeight:700,display:"block",marginBottom:6}}>Children</label>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>setForm(f=>({...f,children:Math.max(0,f.children-1)}))} style={{width:36,height:36,borderRadius:"50%",border:"1.5px solid var(--border)",background:"var(--surface)",cursor:"pointer",fontSize:18,fontWeight:700}}>−</button>
              <span style={{fontWeight:800,fontSize:"1.2rem",minWidth:24,textAlign:"center"}}>{form.children}</span>
              <button onClick={()=>setForm(f=>({...f,children:f.children+1}))} style={{width:36,height:36,borderRadius:"50%",border:"1.5px solid var(--sky)",background:"var(--sky-l)",cursor:"pointer",fontSize:18,fontWeight:700,color:"var(--sky)"}}>+</button>
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
          <Input label="Total Budget" type="number" value={form.budget} onChange={set("budget")}/>
          <Select label="Currency" value={form.currency} onChange={set("currency")}>
            {Object.keys(CURRENCY_SYMBOLS).sort().map(c=><option key={c}>{c}</option>)}
          </Select>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn v="ghost" onClick={()=>setStep(1)} style={{flex:1}}>← Back</Btn>
          <Btn v="primary" size="lg" onClick={()=>setStep(3)} disabled={!form.startDate||!form.endDate} style={{flex:2}}>Next: Preferences →</Btn>
        </div>
      </div>}

      {step===3&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
        <h3>🎯 Your Preferences</h3>
        <Select label="Travel Style" value={form.style} onChange={set("style")}>
          {["budget","mid-range","luxury","backpacker","family","business","solo"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </Select>
        <Select label="Accommodation" value={form.accommodation} onChange={set("accommodation")}>
          {["hotel","hostel","villa","resort","apartment","any"].map(a=><option key={a}>{a.charAt(0).toUpperCase()+a.slice(1)}</option>)}
        </Select>
        <div>
          <label style={{fontSize:".84rem",fontWeight:700,display:"block",marginBottom:10}}>Interests (select all that apply)</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {allInterests.map(i=><button key={i} onClick={()=>toggleInterest(i)} style={{padding:"8px 14px",borderRadius:"var(--r-full)",border:"1.5px solid",borderColor:form.interests.includes(i)?"var(--sky)":"var(--border)",background:form.interests.includes(i)?"var(--sky-l)":"var(--surface)",color:form.interests.includes(i)?"var(--sky)":"var(--ink3)",fontFamily:"var(--font-b)",fontWeight:600,fontSize:".82rem",cursor:"pointer",transition:"all .15s"}}>{i}</button>)}
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn v="ghost" onClick={()=>setStep(2)} style={{flex:1}}>← Back</Btn>
          <Btn v="secondary" size="lg" onClick={create} disabled={loading} style={{flex:2}}>{loading?<Spinner/>:"🎉 Create My Trip →"}</Btn>
        </div>
      </div>}

      {step===4&&created&&<div style={{textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:12}}>🎉</div>
        <h3 style={{marginBottom:8}}>Trip Created Successfully!</h3>
        <p style={{color:"var(--ink3)",marginBottom:20}}>Your trip to <strong>{form.destination}</strong> is ready. Start adding flights, hotels and activities.</p>
        <Card style={{padding:20,textAlign:"left",marginBottom:20,background:"var(--surface2)",border:"none"}}>
          {[["📍",form.destination],["📅",`${form.startDate} → ${form.endDate}`],["👥",`${form.adults} adult${form.adults>1?"s":""}, ${form.children} children`],["💰",`${CURRENCY_SYMBOLS[form.currency]||""}${parseFloat(form.budget).toLocaleString()} ${form.currency}`],["🎭",form.style]].map(([icon,v])=><div key={icon} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
            <span style={{color:"var(--ink3)",fontSize:".88rem"}}>{icon}</span>
            <span style={{fontWeight:600,fontSize:".88rem"}}>{v}</span>
          </div>)}
        </Card>
        <div style={{display:"flex",gap:10}}>
          <Btn v="primary" size="lg" onClick={()=>setPage("dashboard")} style={{flex:1}}>View Dashboard →</Btn>
          <Btn v="ghost" size="lg" onClick={()=>{setStep(1);setCreated(null);setForm({destination:"",destId:"",startDate:"",endDate:"",adults:2,children:0,budget:3000,currency:"USD",style:"mid-range",interests:[],accommodation:"hotel"});}} style={{flex:1}}>Plan Another</Btn>
        </div>
      </div>}
    </Card>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   BOOKINGS PAGE
══════════════════════════════════════════════════════════════ */
function BookingsPage(){
  const {bookings}=useTrips();
  const {fmt}=useTrips();
  const [filter,setFilter]=useState("all");
  const filtered=filter==="all"?bookings:bookings.filter(b=>b.type===filter);
  const icons={flight:"✈️",hotel:"🏨",cab:"🚕"};
  const colors={flight:["var(--sky-l)","var(--sky)"],hotel:["#FEE","var(--coral)"],cab:["var(--gold-l)","var(--gold)"]};

  return <div style={{maxWidth:1100,margin:"0 auto",padding:"32px 24px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <div><h2 style={{marginBottom:4}}>🎫 My Bookings</h2><p style={{color:"var(--ink3)"}}>All your confirmed reservations in one place</p></div>
      <div style={{display:"flex",gap:8}}>
        {["all","flight","hotel","cab"].map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"7px 16px",borderRadius:"var(--r-full)",border:"1.5px solid",borderColor:filter===f?"var(--sky)":"var(--border)",background:filter===f?"var(--sky-l)":"transparent",color:filter===f?"var(--sky)":"var(--ink3)",fontFamily:"var(--font-b)",fontWeight:600,fontSize:".82rem",cursor:"pointer",textTransform:"capitalize"}}>{icons[f]||"📋"} {f}</button>)}
      </div>
    </div>

    {filtered.length===0?<Card style={{padding:"60px",textAlign:"center"}}>
      <div style={{fontSize:56,marginBottom:12}}>🎫</div>
      <h3>No bookings yet</h3>
      <p style={{color:"var(--ink3)",marginBottom:20}}>Book flights, hotels and cabs to see them here</p>
      <div style={{display:"flex",gap:10,justifyContent:"center"}}>
        <Btn v="primary">✈️ Search Flights</Btn>
        <Btn v="secondary">🏨 Find Hotels</Btn>
      </div>
    </Card>:<div style={{display:"flex",flexDirection:"column",gap:14}}>
      {filtered.map((b,i)=>{
        const [bg,c]=colors[b.type]||["var(--surface2)","var(--ink)"];
        return <Card key={b.id||i} className={`up s${Math.min(i+1,6)}`}>
          <div style={{padding:"18px 24px",display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{background:bg,borderRadius:12,padding:"12px 14px",fontSize:28,flexShrink:0}}>{icons[b.type]||"📋"}</div>
            <div style={{flex:1,minWidth:200}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                <h4 style={{fontSize:".95rem"}}>{b.type==="flight"?`${b.from} → ${b.to}`:b.type==="hotel"?b.details?.name||"Hotel":b.type==="cab"?`${b.from} → ${b.to}`:"Booking"}</h4>
                <Badge color="var(--jade-l)" text="var(--jade)">Confirmed</Badge>
              </div>
              <p style={{fontSize:".82rem",color:"var(--ink3)",marginBottom:3}}>📋 Ref: <strong>{b.bookingRef}</strong></p>
              <p style={{fontSize:".8rem",color:"var(--ink4)"}}>
                {b.type==="flight"&&`${b.details?.airline||""} · ${b.details?.flightNo||""} · ${b.passengers||1} pax · ${b.date}`}
                {b.type==="hotel"&&`${b.nights||1} night${(b.nights||1)>1?"s":""} · ${b.guests||1} guest${(b.guests||1)>1?"s":""} · ${b.checkIn} – ${b.checkOut}`}
                {b.type==="cab"&&`${b.details?.type||"Transfer"} · ${b.date||""} ${b.time||""}`}
              </p>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <p style={{fontSize:"1.4rem",fontWeight:900,color:c,fontFamily:"var(--font-d)",lineHeight:1}}>{fmt(b.price||0,b.currency)}</p>
              <p style={{fontSize:".76rem",color:"var(--ink4)",marginTop:2}}>{new Date(b.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </Card>;
      })}
    </div>}
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   BUDGET PAGE
══════════════════════════════════════════════════════════════ */
function BudgetPage(){
  const {trips,fmt,currency}=useTrips();
  const [selectedTrip,setSelectedTrip]=useState(null);
  const [custom,setCustom]=useState({flights:1000,hotels:800,food:400,attractions:200,transport:200,shopping:150,other:150});
  const [mode,setMode]=useState("trip");

  useEffect(()=>{ if(trips.length>0&&!selectedTrip) setSelectedTrip(trips[0]); },[trips]);

  const budget=mode==="trip"&&selectedTrip?{flights:selectedTrip.budget*.35,hotels:selectedTrip.budget*.28,food:selectedTrip.budget*.15,attractions:selectedTrip.budget*.08,transport:selectedTrip.budget*.09,shopping:selectedTrip.budget*.03,other:selectedTrip.budget*.02}:custom;
  const total=Object.values(budget).reduce((s,v)=>s+v,0);
  const nights=selectedTrip&&mode==="trip"?Math.max(1,Math.ceil((new Date(selectedTrip.endDate)-new Date(selectedTrip.startDate))/(86400*1000))):7;

  const cats=[
    {key:"flights",label:"✈️ Flights",color:"#0E7FD5"},
    {key:"hotels",label:"🏨 Accommodation",color:"#FF5757"},
    {key:"food",label:"🍜 Food & Dining",color:"#F5A623"},
    {key:"attractions",label:"🗺️ Attractions",color:"#00C896"},
    {key:"transport",label:"🚕 Local Transport",color:"#7C6FCD"},
    {key:"shopping",label:"🛍️ Shopping",color:"#F15BB5"},
    {key:"other",label:"📦 Other",color:"#9AADC4"},
  ];

  return <div style={{maxWidth:1100,margin:"0 auto",padding:"32px 24px"}}>
    <h2 style={{marginBottom:6}}>💰 Budget Planner</h2>
    <p style={{color:"var(--ink3)",marginBottom:24}}>Track and estimate your travel spending in {currency}.</p>

    <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:24}}>
      <div>
        {/* Mode toggle */}
        <Card style={{padding:20,marginBottom:20}}>
          <div style={{display:"flex",gap:10,marginBottom:trips.length>0?16:0}}>
            <button onClick={()=>setMode("trip")} style={{flex:1,padding:"9px",borderRadius:"var(--r-md)",border:"none",fontFamily:"var(--font-b)",fontWeight:700,fontSize:".85rem",background:mode==="trip"?"var(--sky)":"var(--surface2)",color:mode==="trip"?"white":"var(--ink3)",cursor:"pointer"}}>Use My Trip</button>
            <button onClick={()=>setMode("custom")} style={{flex:1,padding:"9px",borderRadius:"var(--r-md)",border:"none",fontFamily:"var(--font-b)",fontWeight:700,fontSize:".85rem",background:mode==="custom"?"var(--sky)":"var(--surface2)",color:mode==="custom"?"white":"var(--ink3)",cursor:"pointer"}}>Custom Budget</button>
          </div>
          {mode==="trip"&&trips.length>0&&<Select value={selectedTrip?.id||""} onChange={e=>setSelectedTrip(trips.find(t=>t.id===e.target.value))}>
            {trips.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>}
        </Card>

        {/* Sliders for custom mode */}
        <Card style={{padding:24}}>
          <h4 style={{marginBottom:16}}>Budget Breakdown</h4>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {cats.map(cat=>{
              const val=Math.round(budget[cat.key]||0);
              const pct=total>0?Math.round((val/total)*100):0;
              return <div key={cat.key}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <label style={{fontSize:".86rem",fontWeight:700}}>{cat.label}</label>
                  <span style={{fontSize:".86rem",fontWeight:700,color:cat.color}}>{fmt(val)} ({pct}%)</span>
                </div>
                {mode==="custom"?<input type="range" min={0} max={5000} step={50} value={val} onChange={e=>setCustom(p=>({...p,[cat.key]:+e.target.value}))} style={{width:"100%",accentColor:cat.color}}/>:<div style={{height:6,background:"var(--border)",borderRadius:"var(--r-full)",overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:cat.color,borderRadius:"var(--r-full)",transition:"width .5s"}}></div></div>}
              </div>;
            })}
          </div>
        </Card>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Total */}
        <Card style={{padding:24,background:"linear-gradient(135deg,var(--sky),var(--sky-d))",color:"white",border:"none"}}>
          <p style={{color:"rgba(255,255,255,.8)",fontSize:".85rem",marginBottom:6}}>Total Budget</p>
          <p style={{fontFamily:"var(--font-d)",fontSize:"2.8rem",fontWeight:900,lineHeight:1,color:"white"}}>{fmt(total)}</p>
          <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"rgba(255,255,255,.15)",borderRadius:"var(--r-md)",padding:"10px 14px"}}>
              <p style={{fontSize:".74rem",color:"rgba(255,255,255,.7)"}}>Per Day</p>
              <p style={{fontWeight:800,fontSize:"1.1rem"}}>{fmt(Math.round(total/nights))}</p>
            </div>
            <div style={{background:"rgba(255,255,255,.15)",borderRadius:"var(--r-md)",padding:"10px 14px"}}>
              <p style={{fontSize:".74rem",color:"rgba(255,255,255,.7)"}}>Nights</p>
              <p style={{fontWeight:800,fontSize:"1.1rem"}}>{nights}</p>
            </div>
          </div>
        </Card>

        {/* Donut-style bars */}
        <Card style={{padding:20}}>
          <h4 style={{marginBottom:14}}>Allocation</h4>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {cats.map(cat=>{
              const pct=total>0?(budget[cat.key]||0)/total*100:0;
              return <div key={cat.key}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:".82rem"}}>{cat.label}</span>
                  <span style={{fontSize:".8rem",color:"var(--ink3)"}}>{Math.round(pct)}%</span>
                </div>
                <div style={{height:7,background:"var(--border2)",borderRadius:"var(--r-full)",overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:cat.color,borderRadius:"var(--r-full)",transition:"width .6s var(--ease)"}}/>
                </div>
              </div>;
            })}
          </div>
        </Card>

        <Card style={{padding:18,background:"var(--jade-l)",border:"none"}}>
          <h4 style={{color:"var(--jade)",marginBottom:10}}>💡 Budget Tips</h4>
          <ul style={{paddingLeft:16,color:"var(--ink2)",fontSize:".83rem",lineHeight:2.1}}>
            <li>Book flights 6–8 weeks ahead for best deals</li>
            <li>Street food saves 40–60% vs restaurants</li>
            <li>Many top museums have free entry days</li>
            <li>Public transport beats taxis by 80%</li>
            <li>Travel off-peak for 30–50% lower hotel rates</li>
          </ul>
        </Card>
      </div>
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════════ */
function AppContent(){
  const {user,loading}=useAuth();
  const [page,setPage]=useState("dashboard");
  const [toast,setToast]=useState(null);

  if(loading)return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,background:"var(--bg)"}}>
    <div style={{fontSize:40}}>✈️</div>
    <div style={{fontFamily:"var(--font-d)",fontWeight:700,fontSize:"1.3rem",color:"var(--sky)"}}>SmartTravel</div>
    <div style={{width:40,height:40,border:"3px solid var(--border)",borderTop:"3px solid var(--sky)",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
  </div>;

  if(!user)return <AuthPage/>;

  const pages={dashboard:<Dashboard setPage={setPage}/>,explore:<ExplorePage setPage={setPage}/>,flights:<FlightsPage setPage={setPage}/>,hotels:<HotelsPage/>,cabs:<CabsPage/>,attractions:<AttractionsPage/>,planner:<PlannerPage setPage={setPage}/>,bookings:<BookingsPage/>,budget:<BudgetPage/>};

  return <div style={{minHeight:"100vh",background:"var(--bg)",fontFamily:"var(--font-b)"}}>
    <Navbar page={page} setPage={setPage}/>
    <div style={{paddingTop:64}}>
      {pages[page]||<Dashboard setPage={setPage}/>}
    </div>
    {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
  </div>;
}

export default function App(){
  return <><G/><AuthProvider><TripProvider><AppContent/></TripProvider></AuthProvider></>;
}
