"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Smile, Paperclip, Send, Search } from "lucide-react";

// Simple WhatsApp-like clone UI that talks to the provided PHP backend (REST) and Ratchet WebSocket server.
// Configure envs:
// - NEXT_PUBLIC_PHP_API_BASE (e.g. http://localhost:8000)
// - NEXT_PUBLIC_WS_URL (e.g. ws://localhost:8080)

const API_BASE = process.env.NEXT_PUBLIC_PHP_API_BASE || "/api"; // use Next.js API routes by default
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080"; // php websocket server

type User = { id: number; phone: string; name: string };
type Contact = { id: number; name: string; phone: string };
type Message = { id: number; sender_id: number; receiver_id: number; content: string; status: string; created_at: string };

type WSChat = {
  type: string; // 'auth' | 'auth_ok' | 'chat'
  token?: string;
  to?: number;
  from?: number;
  content?: string;
};

function useLocalStorage(key: string) {
  const get = () => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const set = (val: string | null) => {
    if (typeof window === "undefined") return;
    try {
      if (val === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, val);
    } catch {}
  };
  return { get, set };
}

export default function WhatsAppClonePage() {
  const tokenStore = useLocalStorage("wa_token");
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<User | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authPhone, setAuthPhone] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [addPhone, setAddPhone] = useState("");

  // WebSocket (chat only)
  const wsRef = useRef<WebSocket | null>(null);

  const isAuthed = !!token && !!me;

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q));
  }, [contacts, search]);

  useEffect(() => {
    const t = tokenStore.get();
    if (t) setToken(t);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!token) return;
    // Fetch me and contacts
    (async () => {
      try {
        setLoading(true);
        const [meRes, contactsRes] = await Promise.all([
          fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/contacts`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!meRes.ok) throw new Error("Auth expired");
        const meJson = await meRes.json();
        setMe(meJson.user);
        if (contactsRes.ok) {
          const cJson = await contactsRes.json();
          setContacts(cJson.contacts || []);
        }
        setError(null);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
        logout();
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // WebSocket connect
  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      const authMsg: WSChat = { type: "auth", token };
      ws.send(JSON.stringify(authMsg));
    };
    ws.onmessage = (ev) => {
      try {
        const data: WSChat = JSON.parse(ev.data);
        if (data.type === "auth_ok") return;
        if (data.type === "chat") {
          setMessages((prev) => {
            if (activeContact && data.from === activeContact.id) {
              const msg: Message = {
                id: Date.now(),
                sender_id: data.from!,
                receiver_id: me?.id || 0,
                content: data.content || "",
                status: "delivered",
                created_at: new Date().toISOString(),
              };
              return [...prev, msg];
            }
            return prev;
          });
        }
      } catch {}
    };
    ws.onclose = () => {
      wsRef.current = null;
    };
    ws.onerror = () => {};
    return () => {
      ws.close();
    };
  }, [token, activeContact?.id, me?.id]);

  // Load thread when contact changes
  useEffect(() => {
    if (!token || !activeContact) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/messages/${activeContact.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const j = await res.json();
          setMessages(j.messages || []);
        }
      } catch (e) {
      } finally {
        setLoading(false);
      }
    })();
  }, [activeContact?.id, token]);

  function logout() {
    tokenStore.set(null);
    setToken(null);
    setMe(null);
    setContacts([]);
    setActiveContact(null);
    setMessages([]);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      if (authMode === "register") {
        const r = await fetch(`${API_BASE}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: authPhone, name: authName, password: authPassword }),
        });
        if (!r.ok) {
          const msg = (await r.json())?.error || "Registration failed";
          throw new Error(msg);
        }
      }
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: authPhone, password: authPassword }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Login failed");
      const j = await res.json();
      tokenStore.set(j.token);
      setToken(j.token);
      setMe(j.user);
    } catch (e: any) {
      setError(e?.message || "Auth error");
    } finally {
      setLoading(false);
    }
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: addPhone }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Failed to add");
      setAddPhone("");
      const list = await fetch(`${API_BASE}/contacts`, { headers: { Authorization: `Bearer ${token}` } });
      if (list.ok) setContacts((await list.json()).contacts || []);
    } catch (e: any) {
      setError(e?.message || "Contact add error");
    }
  }

  async function sendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!token || !activeContact || !input.trim()) return;
    const content = input;
    setInput("");

    // Optimistic update
    const temp: Message = {
      id: Date.now(),
      sender_id: me?.id || 0,
      receiver_id: activeContact.id,
      content,
      status: "sent",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);

    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: activeContact.id, content }),
      });
      // Fire over WebSocket too for realtime
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const payload: WSChat = { type: "chat", to: activeContact.id, content };
        wsRef.current.send(JSON.stringify(payload));
      }
      if (!res.ok) throw new Error("Send failed");
    } catch (e: any) {
      setError(e?.message || "Send error");
    }
  }

  return (
    <div className="min-h-screen w-full bg-[var(--color-background)] text-[var(--color-foreground)]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-emerald-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-white/10 grid place-items-center">
              <span className="text-xs font-bold">WA</span>
            </div>
            <h1 className="text-lg font-semibold tracking-wide">WhatsApp</h1>
          </div>
          {isAuthed ? (
            <div className="flex items-center gap-3">
              <span className="text-sm opacity-90">{me?.name} ({me?.phone})</span>
              <button onClick={logout} className="rounded px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20">Logout</button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Auth Panel */}
      {!isAuthed && (
        <div className="mx-auto max-w-md px-4 py-10">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <div className="flex gap-2 mb-4">
              <button className={`px-3 py-1.5 rounded ${authMode === "login" ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "bg-[var(--color-secondary)]"}`} onClick={() => setAuthMode("login")}>Login</button>
              <button className={`px-3 py-1.5 rounded ${authMode === "register" ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "bg-[var(--color-secondary)]"}`} onClick={() => setAuthMode("register")}>Register</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Phone</label>
                <input required value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} placeholder="e.g. +123456789" className="w-full rounded border border-[var(--color-input)] bg-transparent px-3 py-2" />
              </div>
              {authMode === "register" && (
                <div>
                  <label className="block text-sm mb-1">Name</label>
                  <input required value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Your name" className="w-full rounded border border-[var(--color-input)] bg-transparent px-3 py-2" />
                </div>
              )}
              <div>
                <label className="block text-sm mb-1">Password</label>
                <input required type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" className="w-full rounded border border-[var(--color-input)] bg-transparent px-3 py-2" />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button disabled={loading} className="w-full rounded bg-[var(--color-primary)] text-[var(--color-primary-foreground)] py-2 font-medium hover:opacity-90 disabled:opacity-50">{authMode === "login" ? "Sign in" : "Create account"}</button>
            </form>
            <p className="text-xs opacity-70 mt-3">Server: {API_BASE} • WS: {WS_URL}</p>
          </div>
        </div>
      )}

      {/* Main Chat UI */}
      {isAuthed && (
        <div className="mx-auto max-w-7xl px-4 py-6 grid md:grid-cols-[320px_1fr] gap-4">
          {/* Sidebar Contacts */}
          <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] flex flex-col overflow-hidden">
            <div className="p-3 border-b border-[var(--color-border)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted-foreground)]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or start new chat" className="w-full rounded pl-9 border border-[var(--color-input)] bg-transparent px-3 py-2" />
              </div>
            </div>
            <div className="p-3 border-b border-[var(--color-border)]">
              <form onSubmit={addContact} className="flex gap-2">
                <input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="Add by phone" className="flex-1 rounded border border-[var(--color-input)] bg-transparent px-3 py-2" />
                <button className="rounded bg-emerald-600 text-white px-3">Add</button>
              </form>
            </div>
            <ul className="flex-1 overflow-auto">
              {filteredContacts.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setActiveContact(c)} className={`w-full text-left px-4 py-3 hover:bg-[var(--color-secondary)] flex items-center gap-3 ${activeContact?.id === c.id ? "bg-[var(--color-secondary)]" : ""}`}>
                    <div className="h-9 w-9 rounded-full bg-emerald-600/10 grid place-items-center text-emerald-700 font-medium">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs opacity-70 truncate">{c.phone}</div>
                    </div>
                  </button>
                </li>
              ))}
              {filteredContacts.length === 0 && (
                <div className="px-4 py-6 text-sm opacity-70">No contacts</div>
              )}
            </ul>
          </aside>

          {/* Chat Panel */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] flex flex-col overflow-hidden min-h-[60vh]">
            <div className="h-14 border-b border-[var(--color-border)] px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {activeContact ? (
                  <>
                    <div className="h-9 w-9 rounded-full bg-emerald-600/10 grid place-items-center text-emerald-700 font-medium">
                      {activeContact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{activeContact.name}</div>
                      <div className="text-xs opacity-70">{activeContact.phone}</div>
                    </div>
                  </>
                ) : (
                  <div className="opacity-70">Select a contact</div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-2 bg-[var(--color-secondary)]/50">
              {messages.map((m) => {
                const mine = m.sender_id === me!.id;
                return (
                  <div key={m.id} className={`max-w-[75%] px-3 py-2 rounded-2xl ${mine ? "ml-auto bg-emerald-600 text-white rounded-br-sm" : "mr-auto bg-white text-[var(--color-foreground)] border border-[var(--color-border)] rounded-bl-sm"}`}>
                    <div className="whitespace-pre-wrap break-words text-[15px]">{m.content}</div>
                    <div className={`text-[10px] mt-1 ${mine ? "text-white/80" : "text-[var(--color-muted-foreground)]"}`}>{new Date(m.created_at).toLocaleTimeString()}</div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="h-full grid place-items-center text-sm opacity-70">{activeContact ? "No messages yet. Say hi!" : "Pick a contact to start chatting."}</div>
              )}
            </div>

            <form onSubmit={sendMessage} className="border-t border-[var(--color-border)] p-3 flex items-center gap-2">
              <button type="button" className="h-10 w-10 grid place-items-center rounded-full hover:bg-[var(--color-secondary)]" title="Emoji">
                <Smile className="h-5 w-5" />
              </button>
              <button type="button" className="h-10 w-10 grid place-items-center rounded-full hover:bg-[var(--color-secondary)]" title="Attach">
                <Paperclip className="h-5 w-5" />
              </button>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={activeContact ? `Message ${activeContact.name}` : "Select a contact to message"} disabled={!activeContact} className="flex-1 rounded-full border border-[var(--color-input)] bg-white/80 px-4 py-2 disabled:opacity-60" />
              <button disabled={!activeContact || !input.trim()} className="h-10 w-10 rounded-full grid place-items-center bg-emerald-600 text-white disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}