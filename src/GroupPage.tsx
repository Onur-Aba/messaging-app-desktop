// src/pages/GroupPage.tsx
import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../src/Firebaseconfig";
import { useParams } from "react-router-dom";
import {
  FiHash,
  FiMoreVertical,
  FiSend,
  FiVolume2,
  FiX,
  FiPlus,
} from "react-icons/fi";
import { onAuthStateChanged } from "firebase/auth";

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const groupKey = groupId!;
  const [categories, setCategories] = useState<any[]>([]);
  const [channelsMap, setChannelsMap] = useState<Record<string, any[]>>({});
  const [activeChannel, setActiveChannel] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [menuOpenIndex, setMenuOpenIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [usernamesCache, setUsernamesCache] = useState<Record<string, string>>(
    {}
  );

  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flatListRef = useRef<HTMLDivElement>(null);

  // 🔹 Kullanıcı oturumu dinle
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUser(user);
    });
    return unsub;
  }, []);

  // 🔹 Kategorileri dinle
  useEffect(() => {
    if (!groupKey) return;
    const catRef = collection(db, "groups_channels", groupKey, "field");
    const unsub = onSnapshot(catRef, (snap) => {
      const cats: any[] = [];
      snap.forEach((d) => cats.push({ id: d.id, ...d.data() }));
      setCategories(cats);
    });
    return unsub;
  }, [groupKey]);

  // 🔹 Kanalları dinle
  useEffect(() => {
    if (!groupKey || categories.length === 0) {
      setChannelsMap({});
      return;
    }
    const unsubscribers: (() => void)[] = [];
    categories.forEach((cat) => {
      const chanRef = collection(
        db,
        "groups_channels",
        groupKey,
        "field",
        cat.id,
        "channels"
      );
      const unsub = onSnapshot(chanRef, (snap) => {
        const chans: any[] = [];
        snap.forEach((d) =>
          chans.push({ id: d.id, categoryId: cat.id, ...d.data() })
        );
        setChannelsMap((prev) => ({ ...prev, [cat.id]: chans }));
        if (!activeChannel) {
          const firstCategory = categories[0];
          if (firstCategory && cat.id === firstCategory.id && chans.length > 0) {
            setActiveChannel(chans[0]);
          }
        }
      });
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, groupKey]);

  // 🔹 Aktif kanalın mesajlarını "chats" koleksiyonundan dinle
  useEffect(() => {
    if (!activeChannel) {
      setMessages([]);
      return;
    }
    const safeChannelName = activeChannel.name.replace(/\s+/g, "_");
    const chatDocId = `${activeChannel.id}_${safeChannelName}`;
    const chatRef = doc(db, "chats", chatDocId);

    const unsub = onSnapshot(chatRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const msgs = data.messages || [];

        // kullanıcı adlarını getir ve cache’le
        for (const msg of msgs) {
          if (msg.senderId && !usernamesCache[msg.senderId]) {
            const senderDoc = await getDoc(doc(db, "users", msg.senderId));
            const senderUsername = senderDoc.exists()
              ? senderDoc.data()?.username
              : "Bilinmeyen Kullanıcı";
            setUsernamesCache((prev) => ({
              ...prev,
              [msg.senderId]: senderUsername,
            }));
          }
        }

        setMessages(msgs);
        setTimeout(() => {
          flatListRef.current?.scrollTo({
            top: flatListRef.current.scrollHeight,
            behavior: "smooth",
          });
        }, 100);
      } else {
        setMessages([]);
      }
    });
    return unsub;
  }, [activeChannel, usernamesCache]);

  // 🔹 Toast yardımcı fonksiyonu
  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // ✅ Kategori oluştur
  const handleAddCategory = async () => {
    const name = prompt("Kategori adı:");
    if (!name) return;
    const safe = name.replace(/\s+/g, "_").toLowerCase();
    const categoryId = `${groupKey}_${safe}`;
    const catRef = doc(db, "groups_channels", groupKey, "field", categoryId);
    const catSnap = await getDoc(catRef);
    if (catSnap.exists()) {
      showToast("Bu isimde kategori zaten var");
      return;
    }
    await setDoc(catRef, {
      id: categoryId,
      name,
      createdAt: serverTimestamp(),
    });
    showToast("Kategori oluşturuldu");
  };

  // ✅ Kanal oluştur
  const handleAddChannel = async (cat?: any) => {
    const category = cat || categories[0];
    if (!category) return alert("Önce bir kategori oluşturun.");
    const name = prompt("Kanal adı:");
    if (!name) return;
    const safeName = name.replace(/\s+/g, "_").toLowerCase();

    const channelId = `${groupKey}_${category.id}_${safeName}`;
    const channelRef = doc(
      db,
      "groups_channels",
      groupKey,
      "field",
      category.id,
      "channels",
      channelId
    );

    const channelSnap = await getDoc(channelRef);
    if (channelSnap.exists()) return showToast("Bu isimde kanal zaten var.");

    await setDoc(channelRef, {
      id: channelId,
      name,
      type: "text",
      createdAt: serverTimestamp(),
      messages: [],
    });
    showToast("Kanal oluşturuldu");
  };

  // 🔹 Mesaj gönder
  const sendMessage = async () => {
    if (!activeChannel || !currentUser || !newMessage.trim()) return;
    const safeChannelName = activeChannel.name.replace(/\s+/g, "_");
    const chatDocId = `${activeChannel.id}_${safeChannelName}`;
    const chatRef = doc(db, "chats", chatDocId);

    const senderDoc = await getDoc(doc(db, "users", currentUser.email));
    const senderUsername = senderDoc.exists()
      ? senderDoc.data()?.username
      : currentUser.displayName || "Bilinmeyen Kullanıcı";

    const messageData: any = {
      senderId: currentUser.email,
      username: senderUsername,
      text: newMessage.trim(),
      timestamp: Timestamp.now(),
      status: "sent",
    };

    if (replyTo) {
      messageData.replyTo = {
        text: replyTo.text,
        username:
          replyTo.senderId === currentUser.email ? "Sen" : replyTo.username,
        index: messages.indexOf(replyTo),
      };
    }

    const chatDoc = await getDoc(chatRef);
    if (chatDoc.exists()) {
      await updateDoc(chatRef, { messages: arrayUnion(messageData) });
    } else {
      const participants = [currentUser.email];
      await setDoc(chatRef, {
        participants,
        messages: [messageData],
      });
    }

    setNewMessage("");
    setReplyTo(null);
  };

  const toggleMenu = (i: number) =>
    setMenuOpenIndex(menuOpenIndex === i ? null : i);

  const replyMessage = (msg: any) => {
    setReplyTo(msg);
    setMenuOpenIndex(null);
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setMenuOpenIndex(null);
    showToast("Mesaj kopyalandı");
  };

  const deleteMessage = async (i: number) => {
    if (!activeChannel || !currentUser) return;
    const safeChannelName = activeChannel.name.replace(/\s+/g, "_");
    const chatDocId = `${activeChannel.id}_${safeChannelName}`;
    const chatRef = doc(db, "chats", chatDocId);
    const updated = messages.filter((_, idx) => idx !== i);
    await updateDoc(chatRef, { messages: updated });
    setMessages(updated);
    setMenuOpenIndex(null);
    showToast("Mesaj silindi");
  };

  const scrollToMessage = (index: number) => {
    const msgEl = messageRefs.current[index];
    if (msgEl) {
      msgEl.scrollIntoView({ behavior: "smooth", block: "center" });
      msgEl.classList.add("highlight");
      setTimeout(() => msgEl.classList.remove("highlight"), 1500);
    }
  };

  return (
    <div className="group-container">
      {/* Sol menü */}
      <div className="sidebar">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h3>{groupKey}</h3>
          <button onClick={handleAddCategory} title="Kategori Ekle">
            <FiPlus />
          </button>
        </div>

        {categories.map((cat) => (
          <div key={cat.id} className="category">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong>{cat.name}</strong>
              <button onClick={() => handleAddChannel(cat)} title="Kanal Ekle">
                <FiPlus />
              </button>
            </div>
            {(channelsMap[cat.id] || []).map((ch) => (
              <div
                key={ch.id}
                className={`channel ${
                  activeChannel?.id === ch.id ? "active" : ""
                }`}
                onClick={() => setActiveChannel(ch)}
              >
                {ch.type === "text" ? <FiHash /> : <FiVolume2 />} {ch.name}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Sohbet alanı */}
      <div className="chat">
        {activeChannel ? (
          <>
            <div className="chat-header">#{activeChannel.name}</div>
            <div className="message-list" ref={flatListRef}>
              {messages.map((msg, i) => {
                const isOwn = msg.senderId === currentUser?.email;
                const username =
                  msg.username ||
                  usernamesCache[msg.senderId] ||
                  "Bilinmeyen Kullanıcı";
                return (
                  <div
                    key={i}
                    ref={(el) => (messageRefs.current[i] = el)}
                    className={`message ${isOwn ? "sent" : "received"}`}
                  >
                    {msg.replyTo && (
                      <div
                        className="reply-box"
                        onClick={() => scrollToMessage(msg.replyTo.index)}
                      >
                        <strong>{msg.replyTo.username}</strong>
                        <p>{msg.replyTo.text}</p>
                      </div>
                    )}
                    <div className="message-header">
                      <span className="sender">{username}</span>
                      <button
                        className="menu-button"
                        onClick={() => toggleMenu(i)}
                      >
                        <FiMoreVertical />
                      </button>
                      {menuOpenIndex === i && (
                        <div className="message-menu">
                          <button onClick={() => replyMessage(msg)}>
                            Cevapla
                          </button>
                          <button onClick={() => copyMessage(msg.text)}>
                            Kopyala
                          </button>
                          {isOwn && (
                            <button onClick={() => deleteMessage(i)}>Sil</button>
                          )}
                        </div>
                      )}
                    </div>
                    <p>{msg.text}</p>
                  </div>
                );
              })}
            </div>

            {replyTo && (
              <div className="reply-preview">
                <div className="reply-info">
                  <strong>
                    {replyTo.senderId === currentUser?.email
                      ? "Sen"
                      : replyTo.username}
                  </strong>
                  <p>{replyTo.text}</p>
                </div>
                <button className="close-reply" onClick={() => setReplyTo(null)}>
                  <FiX />
                </button>
              </div>
            )}

            <div className="chat-input">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Mesaj yaz..."
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button onClick={sendMessage}>
                <FiSend />
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat">Bir kanal seç</div>
        )}
      </div>

      {toastMessage && <div className="toast">{toastMessage}</div>}

      <style>{`
        .group-container { display: flex; height: 100vh; background: #1e1f22; color: #fff; }
        .sidebar { width: 260px; background: #2b2d31; padding: 10px; overflow-y: auto; }
        .channel { margin-left: 10px; cursor: pointer; padding: 5px; border-radius: 6px; }
        .channel:hover, .channel.active { background: #404249; }
        .chat { flex: 1; display: flex; flex-direction: column; }
        .chat-header { padding: 12px; background: #2b2d31; font-weight: 600; border-bottom: 1px solid #1e1f22; }
        .message-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
        .message { max-width: 70%; padding: 8px; border-radius: 8px; position: relative; }
        .sent { align-self: flex-end; background: #5865f2; }
        .received { align-self: flex-start; background: #404249; }
        .menu-button { background: none; border: none; color: white; cursor: pointer; }
        .message-menu { position: absolute; right: 10px; top: 10px; background: #2b2d31; border-radius: 6px; padding: 5px; z-index: 10; }
        .message-menu button { display: block; background: none; border: none; color: white; padding: 5px; width: 100%; text-align: left; cursor: pointer; }
        .chat-input { display: flex; background: #2b2d31; padding: 10px; }
        .chat-input input { flex: 1; border: none; background: #1e1f22; color: #fff; padding: 8px; border-radius: 6px; }
        .chat-input button { background: #5865f2; border: none; color: #fff; padding: 8px 12px; margin-left: 8px; border-radius: 6px; }
        .reply-preview { background: #2b2d31; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; }
        .reply-info p { font-size: 13px; color: #ccc; margin: 2px 0; }
        .toast { position: fixed; bottom: 20px; right: 20px; background: #5865f2; padding: 10px 20px; border-radius: 6px; }
        .highlight { animation: highlightAnim 1.5s ease; }
        @keyframes highlightAnim { 0% { background: yellow; } 100% { background: inherit; } }
      `}</style>
    </div>
  );
}
