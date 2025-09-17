import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const LANGS = {
  en: { placeholder:"Type your message...", online:"Online", replying:"Replying to:", cancel:"❌", cozyChat:"Chat" },
  es: { placeholder:"Escribe tu mensaje...", online:"En línea", replying:"Respondiendo a:", cancel:"❌", cozyChat:"Acogedor" },
  zh: { placeholder:"输入消息...", online:"在线", replying:"回复:", cancel:"❌", cozyChat:"聊天室" }
};

function getCookie(name){
  const v = `; ${document.cookie}`;
  const parts = v.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}
function setCookie(name, value, days){
  let expires="";
  if(days){
    const d = new Date(); d.setTime(d.getTime()+days*24*60*60*1000);
    expires="; expires="+d.toUTCString();
  }
  document.cookie = name+"="+(value||"")+expires+"; path=/";
}

export default function Home(){
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyPreview, setReplyPreview] = useState("");
  const [lang, setLang] = useState(typeof window !== "undefined" ? getCookie("lang") || "en" : "en");
  const messagesRef = useRef(null);
  const usernameRef = useRef("");
  const userIdRef = useRef("");

  useEffect(()=>{ // init persistent id + username
    if (typeof window === "undefined") return;
    let uid = getCookie("userId");
    if (!uid){ uid = crypto.randomUUID(); setCookie("userId", uid, 365); }
    userIdRef.current = uid;

    let uname = getCookie("username");
    if (!uname){
      uname = prompt("Enter your username:") || ("User-" + uid.slice(0,6));
      setCookie("username", uname, 365);
    }
    usernameRef.current = uname;

    const savedLang = getCookie("lang") || "en";
    setLang(savedLang);
  }, []);

  useEffect(()=>{ // init socket
    if (typeof window === "undefined") return;
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || (window.location.origin.replace(/^http/, "ws"));
    // NOTE: socket.io client expects HTTP/HTTPS URL; server must expose the same origin or set CORS
    const S = io(process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin);
    setSocket(S);

    S.on("connect", ()=> {
      S.emit("set id", { id: userIdRef.current, username: usernameRef.current });
    });

    S.on("chat history", (h) => setMessages(h));
    S.on("chat message", (m) => setMessages(prev => [...prev, m]));
    S.on("server message", (txt) => setMessages(prev => [...prev, { id: "srv-"+Date.now(), server:true, text: txt }]));
    S.on("user list", (list) => setUsers(list));

    return ()=> S.disconnect();
  }, []);

  useEffect(()=>{ // auto-scroll unless user scrolled up
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages]);

  function applyLangToCookies(code){
    setCookie("lang", code, 365);
    setLang(code);
  }

  function handleSend(e){
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit("chat message", { text: input.trim(), replyTo });
    setInput("");
    setReplyTo(null);
    setReplyPreview("");
  }

  function startReply(message){
    setReplyTo(message.id);
    setReplyPreview(message.text.length > 120 ? message.text.slice(0,120) + "..." : message.text);
    document.getElementById("chat-input")?.focus();
  }

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#1e1e2e",color:"#eaeaea",fontFamily:"Segoe UI,Arial"}}>
      <header style={{padding:12,background:"#2a2a3d",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span id="header-title">{LANGS[lang].cozyChat}</span>
        <div>
          <select id="lang-select" value={lang} onChange={(e)=>{applyLangToCookies(e.target.value)}}>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="zh">中文</option>
          </select>
        </div>
      </header>

      <main style={{flex:1,display:"flex",overflow:"hidden"}}>
        <ul id="messages" ref={messagesRef} style={{flex:3,listStyle:"none",margin:0,padding:16,overflowY:"auto",background:"#252537"}}>
          {messages.map(msg => {
            if (msg.server) return <li key={msg.id} style={{textAlign:"center",color:"#aaa",fontStyle:"italic"}}>{msg.text}</li>;
            return (
              <li key={msg.id} id={msg.id} style={{margin:"10px 0",padding:10,borderRadius:8,background: msg.user===usernameRef.current ? "#3b6b8f" : "#2f2f47", maxWidth:"70%", position:"relative", marginLeft: msg.user===usernameRef.current ? "auto" : "0" }}>
                {msg.replyTo && (() => {
                  const orig = messages.find(m=>m.id===msg.replyTo);
                  const previewText = orig ? orig.text : "(message not found)";
                  return <div style={{fontSize:"0.85em",color:"#cfcfd6,opacity:0.9",marginBottom:6,paddingLeft:8,borderLeft:"3px solid rgba(255,255,255,0.06)"}}>{previewText.length>120?previewText.slice(0,120)+"...":previewText}</div>;
                })()}
                <strong style={{color:"#8ab4f8"}}>{msg.user}</strong><br />
                <span style={{display:"block"}}>{msg.text}</span>
                <span style={{display:"block",textAlign:"right",fontSize:"0.78em",color:"#aaa",marginTop:6}}>{msg.time}</span>
                <button onClick={() => startReply(msg)} title="Reply" style={{position:"absolute",right:-44,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:"#8ab4f8",cursor:"pointer"}}>↩</button>
              </li>
            );
          })}
        </ul>

        <aside style={{flex:1,background:"#2a2a3d",borderLeft:"1px solid #333",padding:8,overflowY:"auto"}}>
          <h3>{LANGS[lang].online}</h3>
          <ul style={{listStyle:"none",padding:0}}>
            {users.map((u,i) => <li key={i} style={{margin:"8px 0",padding:8,borderRadius:6,background:"#34344e"}}>{u}</li>)}
          </ul>
        </aside>
      </main>

      <footer style={{padding:10,background:"#2a2a3d",borderTop:"1px solid #333"}}>
        <form id="form" onSubmit={handleSend} style={{display:"flex",flexDirection:"column"}}>
          <div id="reply-indicator" style={{display: replyTo ? "block" : "none", background:"#34344e", padding:8, borderLeft:"4px solid #8ab4f8", borderRadius:6, marginBottom:8}}>
            <span style={{fontWeight:700}}>{LANGS[lang].replying} </span>
            <span>{replyPreview}</span>
            <span onClick={()=>{setReplyTo(null); setReplyPreview("");}} style={{float:"right",cursor:"pointer",color:"#f66"}}>{LANGS[lang].cancel}</span>
          </div>

          <div style={{display:"flex"}}>
            <input id="chat-input" value={input} onChange={(e)=>setInput(e.target.value)} placeholder={LANGS[lang].placeholder} style={{flex:1,padding:10,borderRadius:6,border:"none",background:"#34344e",color:"#fff",marginRight:10}} />
            <button style={{padding:"10px 14px",borderRadius:6,border:"none",background:"#8ab4f8",color:"#fff",fontWeight:700}}>Send</button>
          </div>
        </form>
      </footer>
    </div>
  );
}
