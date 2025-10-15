// src/pages/Message.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../src/Firebaseconfig";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiPhone,
  FiVideo,
  FiSend,
  FiMoreVertical,
  FiX,
} from "react-icons/fi";
import { onAuthStateChanged } from "firebase/auth";
import "./Message.css";

const Message = () => {
  const { userId } = useParams<{ userId: string }>();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [users, setUsers] = useState<{ [key: string]: string }>({});
  const [userList, setUserList] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(0);
  const [menuOpenIndex, setMenuOpenIndex] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [showForwardPopup, setShowForwardPopup] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const flatListRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUser(user);
      else navigate("/login");
    });

    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData: { [key: string]: string } = {};
      const userArr: any[] = [];
      snapshot.docs.forEach((doc) => {
        usersData[doc.id] = doc.data().email;
        userArr.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersData);
      setUserList(userArr);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
    };
  }, []);

  useEffect(() => {
    if (!currentUser || !users[userId!]) return;
    const chatId = [currentUser.email, users[userId!]].sort().join("_");
    const chatRef = doc(db, "chats", chatId);

    const unsubscribe = onSnapshot(chatRef, async (docSnap) => {
      if (docSnap.exists()) {
        const newMessages = docSnap.data().messages || [];
        setMessages(newMessages);

        const updatedMessages = newMessages.map((msg: any) => {
          if (msg.senderId !== currentUser.email && msg.status !== "read") {
            return { ...msg, status: "read" };
          }
          return msg;
        });

        const needUpdate = updatedMessages.some(
          (m: any, i: number) => m.status !== newMessages[i]?.status
        );
        if (needUpdate) await updateDoc(chatRef, { messages: updatedMessages });

        if (isAtBottom) {
          setTimeout(() => {
            flatListRef.current?.scrollTo({
              top: flatListRef.current.scrollHeight,
              behavior: "smooth",
            });
            setUnreadCount(0);
            setLastSeenMessageCount(newMessages.length);
          }, 100);
        } else if (newMessages.length > lastSeenMessageCount) {
          setUnreadCount(newMessages.length - lastSeenMessageCount);
        }
      } else setMessages([]);
    });

    return () => unsubscribe();
  }, [userId, users, isAtBottom, lastSeenMessageCount, currentUser]);

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !users[userId!]) return;

    const receiverEmail = users[userId!];
    const chatId = [currentUser.email, receiverEmail].sort().join("_");
    const chatRef = doc(db, "chats", chatId);
    const senderDoc = await getDoc(doc(db, "users", currentUser.email!));
    const senderUsername = senderDoc.exists()
      ? senderDoc.data()?.username
      : "Bilinmeyen Kullanıcı";

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

    if ((await getDoc(chatRef)).exists()) {
      await updateDoc(chatRef, { messages: arrayUnion(messageData) });
    } else {
      await setDoc(chatRef, {
        participants: [currentUser.email, receiverEmail],
        messages: [messageData],
      });
    }

    setNewMessage("");
    setReplyTo(null);
  };

  const toggleMenu = (index: number) => {
    setMenuOpenIndex(menuOpenIndex === index ? null : index);
  };

  const replyMessage = (msg: any) => {
    setReplyTo(msg);
    setMenuOpenIndex(null);
  };

  const openForwardPopup = (msg: any) => {
    setForwardMsg(msg);
    setShowForwardPopup(true);
    setMenuOpenIndex(null);
  };

  const forwardMessageTo = async (targetId: string) => {
    if (!currentUser) return;
    const targetEmail = targetId;
    const chatId = [currentUser.email, targetEmail].sort().join("_");
    const chatRef = doc(db, "chats", chatId);

    const newMsg = {
      senderId: currentUser.email,
      username: "Sen",
      text: forwardMsg.text,
      forwarded: true,
      timestamp: Timestamp.now(),
      status: "sent",
    };

    if ((await getDoc(chatRef)).exists()) {
      await updateDoc(chatRef, { messages: arrayUnion(newMsg) });
    } else {
      await setDoc(chatRef, {
        participants: [currentUser.email, targetEmail],
        messages: [newMsg],
      });
    }

    setShowForwardPopup(false);
    setForwardMsg(null);
    showToast("Mesaj başarıyla iletildi");
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setMenuOpenIndex(null);
    showToast("Mesaj kopyalandı");
  };

  const deleteMessage = async (index: number) => {
    if (!currentUser || !users[userId!]) return;
    const receiverEmail = users[userId!];
    const chatId = [currentUser.email, receiverEmail].sort().join("_");
    const chatRef = doc(db, "chats", chatId);
    const updated = messages.filter((_, i) => i !== index);
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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const isBottom =
      e.currentTarget.scrollTop + e.currentTarget.clientHeight >=
      e.currentTarget.scrollHeight - 10;
    setIsAtBottom(isBottom);
    if (isBottom) {
      setUnreadCount(0);
      setLastSeenMessageCount(messages.length);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollTo({
      top: flatListRef.current.scrollHeight,
      behavior: "smooth",
    });
    setUnreadCount(0);
    setIsAtBottom(true);
    setLastSeenMessageCount(messages.length);
  };

  return (
    <div className="chat-container">
      <div className="top-bar">
        <button className="icon-button" onClick={() => navigate(-1)}>
          <FiArrowLeft size={20} />
        </button>
        <h3 className="username">{users[userId!]}</h3>
        <div className="icon-group">
          <FiPhone size={20} />
          <FiVideo size={20} style={{ marginLeft: 15 }} />
        </div>
      </div>

      <div className="message-list" onScroll={handleScroll} ref={flatListRef}>
        {messages.map((item, index) => {
          const isOwn = item.senderId === currentUser?.email;
          return (
            <div
              key={index}
              ref={(el) => (messageRefs.current[index] = el)}
              className={`message ${isOwn ? "sent" : "received"}`}
            >
              {item.replyTo && (
                <div
                  className="reply-box"
                  onClick={() => scrollToMessage(item.replyTo.index)}
                >
                  <strong>{item.replyTo.username}</strong>
                  <p>{item.replyTo.text}</p>
                </div>
              )}

              {item.forwarded && (
                <div className="forwarded-label">İletilmiş mesaj</div>
              )}

              <div className="message-header">
                <button
                  className="menu-button"
                  onClick={() => toggleMenu(index)}
                >
                  <FiMoreVertical />
                </button>
                {menuOpenIndex === index && (
                  <div className="message-menu">
                    <button onClick={() => replyMessage(item)}>Cevapla</button>
                    <button onClick={() => openForwardPopup(item)}>İlet</button>
                    <button onClick={() => copyMessage(item.text)}>Kopyala</button>
                    {isOwn && (
                      <button
                        className="delete-btn"
                        onClick={() => deleteMessage(index)}
                      >
                        Sil
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 🔹 INVITE MESAJI GÖSTERİMİ */}
              {item.type === "invite" ? (
                <div className="invite-box">
                  <p>{item.text}</p>
                  <button
                    className="join-button"
                    onClick={() =>
                      navigate(item.invite?.link || "/")
                    }
                  >
                    Gruba Katıl
                  </button>
                </div>
              ) : (
                <p>{item.text}</p>
              )}

              <div className="message-status">
                {isOwn && (
                  <small>
                    {item.status === "read"
                      ? "okundu"
                      : item.status === "delivered"
                      ? "iletildi"
                      : "gönderildi"}
                  </small>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {replyTo && (
        <div className="reply-preview">
          <div className="reply-info">
            <strong>
              {replyTo.senderId === currentUser?.email ? "Sen" : replyTo.username}
            </strong>
            <p>{replyTo.text}</p>
          </div>
          <button className="close-reply" onClick={() => setReplyTo(null)}>
            <FiX />
          </button>
        </div>
      )}

      {!isAtBottom && (
        <button className="scroll-to-bottom" onClick={scrollToBottom}>
          ↓
          {unreadCount > 0 && (
            <span className="badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </button>
      )}

      <div className="input-bar">
        <textarea
          className="message-input"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mesajınızı yazın..."
        />
        <button className="send-button" onClick={sendMessage}>
          <FiSend color="#fff" />
        </button>
      </div>

      {showForwardPopup && (
        <div className="forward-popup">
          <div className="forward-popup-content">
            <h4>Mesajı ilet</h4>
            <p className="forward-text">"{forwardMsg.text}"</p>
            <div className="forward-user-list">
              {userList
                .filter((u) => u.id !== currentUser?.email)
                .map((u) => (
                  <div
                    key={u.id}
                    className="forward-user-item"
                    onClick={() => forwardMessageTo(u.id)}
                  >
                    {u.username || u.email}
                  </div>
                ))}
            </div>
            <button
              className="close-forward"
              onClick={() => setShowForwardPopup(false)}
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {toastMessage && <div className="toast">{toastMessage}</div>}
    </div>
  );
};

export default Message;
