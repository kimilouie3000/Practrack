import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search, X } from "lucide-react";

/** This searches existing navigation items only—no new API or data permissions. */
export default function SkyHeaderTools({ links }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const inputRef = useRef(null);
  const holderRef = useRef(null);
  const choices = query.trim() ? links.filter(link => link.label.toLowerCase().includes(query.toLowerCase())).slice(0,6) : [];

  useEffect(() => {
    function close(event) {
      if (event.key === "Escape") { setNotificationsOpen(false); setSearchOpen(false); inputRef.current?.blur(); }
      if (event.type === "pointerdown" && holderRef.current && !holderRef.current.contains(event.target)) { setSearchOpen(false); setNotificationsOpen(false); }
    }
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", close); };
  }, []);

  function select(path) { navigate(path); setQuery(""); setSearchOpen(false); }

  return <div className="sky-header-tools" ref={holderRef}>
    <form className="sky-header-search" role="search" onSubmit={event => { event.preventDefault(); if (choices[0]) select(choices[0].path); }}>
      <Search size={17} className="sky-search-leading" aria-hidden="true"/>
      <input ref={inputRef} type="search" aria-label="Search workspace pages" placeholder="Search pages in your workspace..." value={query} onChange={event => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} />
      <button type="submit" aria-label="Open matching page"><Search size={15}/></button>
      {searchOpen && query.trim() && <div className="sky-search-results" role="listbox" aria-label="Matching pages">
        {choices.length ? choices.map(link => <button type="button" key={link.path} role="option" aria-selected="false" onClick={() => select(link.path)}>{link.label}</button>) : <p>No matching pages</p>}
      </div>}
    </form>
    <div className="sky-notifications-holder">
      <button type="button" className="sky-notification-btn" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(value => !value); setSearchOpen(false); }}><Bell size={18}/></button>
      {notificationsOpen && <div className="sky-notifications-popover"><div><strong>Notifications</strong><button type="button" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}><X size={16}/></button></div><p>No notification feed is connected yet. Your existing approval and request pages remain available in the sidebar.</p></div>}
    </div>
  </div>;
}