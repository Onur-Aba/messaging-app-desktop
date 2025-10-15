import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../src/Firebaseconfig";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { FaHome, FaUser, FaCog, FaPhone, FaUsers, FaBars } from "react-icons/fa";

// Interface for better type safety
interface ChatPreview {
  userId: string;
  lastMessage: any;
  unreadCount: number;
}

interface GroupPreview {
  groupId: string;
  name: string;
  lastMessage: any;
  unreadCount: number;
}

const Master: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  // Updated state to use the new interface
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // === NEW STATES ===
  const [groups, setGroups] = useState<any[]>([]);
  const [groupPreviews, setGroupPreviews] = useState<GroupPreview[]>([]);
  const [filterType, setFilterType] = useState<"all" | "dm" | "groups">("all");
  // const [sidebarOpen, setSidebarOpen] = useState(true); // for hamburger toggling (if we want)
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const userList = snapshot.docs
        .filter((doc) => doc.id !== user.email)
        .map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
    });
    return () => unsubscribe();
  }, [user]);

  // CHAT PREVIEWS LOGIC (original, preserved)
  useEffect(() => {
    if (!user || users.length === 0) return;

    const unsubscribers = users.map((otherUser) => {
      const chatId = [user.email, otherUser.email].sort().join("_");
      const chatRef = doc(db, "chats", chatId);

      return onSnapshot(chatRef, (chatDoc) => {
        if (chatDoc.exists()) {
          const chatData = chatDoc.data();
          const messages = chatData.messages || [];
          const lastMessage = messages[messages.length - 1] || null;

          // ÖNEMLİ: Bu satır sayesinde sadece karşıdan gelen okunmamış mesajlar sayılır.
          // msg.sender !== user.email koşulu, mevcut kullanıcının kendi gönderdiği mesajları sayımın dışında bırakır.
          const unreadCount = messages.filter(
            (msg: any) => msg.senderId !== user.email && msg.status !== "read"
          ).length;

          const newPreview: ChatPreview = {
            userId: otherUser.id,
            lastMessage,
            unreadCount,
          };

          setChatPreviews((prevPreviews) => {
            const existingPreviewIndex = prevPreviews.findIndex(
              (p) => p.userId === otherUser.id
            );
            if (existingPreviewIndex !== -1) {
              const updatedPreviews = [...prevPreviews];
              updatedPreviews[existingPreviewIndex] = newPreview;
              return updatedPreviews;
            } else {
              return [...prevPreviews, newPreview];
            }
          });
        }
      });
    });

    // Cleanup all listeners on component unmount
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [user, users]);

  // === NEW: Load groups and realtime previews for groups ===
  useEffect(() => {
    if (!user) return;

    // 1) subscribe to groups collection (to find groups where user is member)
    const groupsRef = collection(db, "groups");
    const unsubGroups = onSnapshot(groupsRef, (snapshot) => {
      // Filter client-side: groups where members array contains an object with email === user.email
      const myGroups = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((g: any) => {
          const members = g.members || [];
          return members.some((m: any) => m?.email === user.email);
        });
      setGroups(myGroups);
    });

    // 2) For each group we create a listener to its messages (if any) to compute lastMessage & unreadCount
    const unsubMessages: Array<() => void> = [];

    // We'll watch snapshot of groups state through another effect; here we create dynamic listeners based on 'groups'
    // To avoid duplicate listeners we will manage them in a separate effect below.

    return () => {
      unsubGroups();
      unsubMessages.forEach((u) => u());
    };
  }, [user]);

  // Effect to setup per-group listeners once groups state updates
  useEffect(() => {
    if (!user) return;
    // cleanup previous listeners
    const currentUnsubs: Array<() => void> = [];

    groups.forEach((g: any) => {
      // We'll assume group messages are stored in subcollection 'messages' under groups/{groupId}/messages
      // If your app stores group messages elsewhere adjust path accordingly.
      const messagesRef = collection(db, "groups", g.id, "messages");
      // Listen to last messages by ordering by timestamp desc and limiting to e.g. 50 (or 1)
      const q = query(messagesRef, orderBy("timestamp", "desc"), limit(100));

      const unsub = onSnapshot(q, (snap) => {
        const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const lastMessage = msgs[0] || null;

        // unread count: messages where senderId !== user.email and status !== 'read'
        const unreadCount = msgs.filter((m: any) => m.senderId !== user.email && m.status !== "read").length;

        setGroupPreviews((prev) => {
          const existingIndex = prev.findIndex((p) => p.groupId === g.id);
          const newPreview: GroupPreview = {
            groupId: g.id,
            name: g.name || g.groupName || "İsimsiz Grup",
            lastMessage,
            unreadCount,
          };
          if (existingIndex !== -1) {
            const updated = [...prev];
            updated[existingIndex] = newPreview;
            return updated;
          } else {
            return [...prev, newPreview];
          }
        });
      });

      currentUnsubs.push(unsub);
    });

    // cleanup on groups change/unmount
    return () => {
      currentUnsubs.forEach((u) => u());
    };
  }, [groups, user]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }
      const q = query(
        collection(db, "users"),
        where("username", ">=", searchTerm),
        where("username", "<=", searchTerm + "\uf8ff")
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .filter((doc) => doc.id !== user?.email)
        .map((doc) => ({ id: doc.id, ...doc.data() }));
      setSearchResults(results);
    };
    fetchResults();
  }, [searchTerm, user?.email]);

  const handleChatClick = (userId: string) => {
    // Keep original navigation behavior (so existing routes still work)
    navigate(`/chat/${userId}`);
    // ALSO open right panel view (split-view)
    setSelectedChatUserId(userId);
    setSelectedGroupId(null); // clear group selection
  };

  const handleGroupClick = (groupId: string) => {
    // Navigate to group route as well for compatibility
    navigate(`/group/${groupId}`);
    setSelectedGroupId(groupId);
    setSelectedChatUserId(null);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: Timestamp | null): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffDays = Math.floor(diff / (1000 * 3600 * 24));

    if (diffDays === 0) {
      // Today: return time like "15:30"
      return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      // Yesterday
      return "Dün";
    } else {
      // Older: return date like "07.10.2025"
      return date.toLocaleDateString('tr-TR');
    }
  };

  // === STYLES ===
  const styles: { [key: string]: React.CSSProperties } = {
    // Changed container to full width split layout
    container: {
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "1rem",
      fontFamily: "Segoe UI, sans-serif",
      color: "#333",
      display: "grid",
      gridTemplateColumns: "320px 1fr", // left sidebar fixed, right flexible
      gap: "1rem",
      alignItems: "start",
    },
    header: {
      gridColumn: "1 / -1",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "0.5rem",
    },
    welcome: {
      fontSize: "1.2rem",
      fontWeight: "bold",
    },
    navButtons: {
      display: "flex",
      gap: "1rem",
      backgroundColor: "#000",
      padding: "0.5rem 1rem",
      borderRadius: "2rem",
      border: "1px solid #fff",
    },
    navButton: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0.5rem",
      backgroundColor: "transparent",
      color: "#fff",
      border: "none",
      borderRadius: "50%",
      cursor: "pointer",
      fontSize: "1.2rem",
      width: "2.5rem",
      height: "2.5rem",
      transition: "all 0.3s ease",
    },
    navButtonHover: {
      backgroundColor: "#333",
    },
    // Sidebar styles
    sidebar: {
      background: "#f6f7fb",
      borderRadius: 8,
      padding: "0.75rem",
      height: "80vh",
      overflowY: "auto",
      boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
    },
    sidebarHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "0.75rem",
    },
    burgerBtn: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
      background: "transparent",
      border: "none",
      padding: "6px 8px",
      borderRadius: 6,
    },
    filterBtn: {
      padding: "6px 8px",
      borderRadius: 6,
      border: "1px solid #ddd",
      cursor: "pointer",
      background: "white",
      marginLeft: 6,
    },
    searchWrapper: {
      marginBottom: "0.75rem",
    },
    searchInput: {
      padding: "0.5rem",
      borderRadius: "6px",
      border: "1px solid #ccc",
      width: "100%",
      fontSize: "14px",
    },
    listSectionTitle: {
      fontSize: "0.95rem",
      margin: "0.5rem 0",
      fontWeight: "600",
    },
    userList: {
      listStyle: "none",
      padding: 0,
      margin: 0,
    },
    userCard: {
      padding: "0.6rem",
      borderRadius: "0.5rem",
      backgroundColor: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      marginBottom: "0.5rem",
      cursor: "pointer",
      transition: "transform 0.12s",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    userInfo: {
      display: "flex",
      flexDirection: "column",
      maxWidth: "70%",
    },
    username: {
      fontWeight: "600",
      fontSize: "0.95rem",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    message: {
      color: "#666",
      fontSize: "0.85rem",
      marginTop: "0.2rem",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    chatMeta: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "0.4rem",
      minWidth: "60px",
    },
    timestamp: {
      fontSize: "0.7rem",
      color: "#999",
    },
    unreadBadge: {
      backgroundColor: "#007bff",
      color: "white",
      borderRadius: "50%",
      minWidth: "20px",
      height: "20px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontSize: "0.75rem",
      fontWeight: "bold",
      padding: "0 6px",
    },
    // Right panel (chat view)
    chatPanel: {
      background: "#fff",
      borderRadius: 8,
      padding: "0.8rem",
      height: "80vh",
      overflowY: "auto",
      boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
    },
    empty: {
      color: "#777",
    },
  };

  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Merge chatPreviews and groupPreviews into a single list for the sidebar, while preserving types
  type UnifiedPreview = {
    type: "dm" | "group";
    id: string; // userId or groupId
    title: string;
    lastMessage: any;
    unreadCount: number;
  };

  const unifiedList: UnifiedPreview[] = [];

  // Add DMs
  chatPreviews.forEach((p) => {
    const chatUser = users.find((u) => u.id === p.userId);
    unifiedList.push({
      type: "dm",
      id: p.userId,
      title: chatUser?.username || "Bilinmeyen Kullanıcı",
      lastMessage: p.lastMessage,
      unreadCount: p.unreadCount,
    });
  });

  // Add Groups
  groupPreviews.forEach((g) => {
    unifiedList.push({
      type: "group",
      id: g.groupId,
      title: g.name || "İsimsiz Grup",
      lastMessage: g.lastMessage,
      unreadCount: g.unreadCount,
    });
  });

  // Filter by selected filterType
  const filteredUnified = unifiedList.filter((item) => {
    if (filterType === "all") return true;
    if (filterType === "dm") return item.type === "dm";
    if (filterType === "groups") return item.type === "group";
    return true;
  });

  // Sort by lastMessage timestamp desc (most recent first)
  const sortedUnified = [...filteredUnified].sort((a, b) => {
    const tA = a.lastMessage?.timestamp?.toMillis ? a.lastMessage.timestamp.toMillis() : (a.lastMessage?.timestamp?._seconds ? a.lastMessage.timestamp._seconds * 1000 : 0);
    const tB = b.lastMessage?.timestamp?.toMillis ? b.lastMessage.timestamp.toMillis() : (b.lastMessage?.timestamp?._seconds ? b.lastMessage.timestamp._seconds * 1000 : 0);
    return (tB || 0) - (tA || 0);
  });

  // Compute total unread for showing maybe in header if needed
  const totalUnread = sortedUnified.reduce((acc, it) => acc + (it.unreadCount || 0), 0);

  // === ChatView component (minimal inline) ===
  // Shows DM messages from chats/{chatId} or groups/{groupId}/messages depending on selection
  const ChatView: React.FC = () => {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      let unsub: (() => void) | null = null;
      setMessages([]);
      if (!user) return;
      if (selectedChatUserId) {
        setLoading(true);
        const chatId = [user.email, selectedChatUserId].sort().join("_");
        const chatRef = doc(db, "chats", chatId);
        unsub = onSnapshot(chatRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const msgs = data.messages || [];
            setMessages(msgs);
          } else {
            setMessages([]);
          }
          setLoading(false);
        });
      } else if (selectedGroupId) {
        setLoading(true);
        const messagesRef = collection(db, "groups", selectedGroupId, "messages");
        const q = query(messagesRef, orderBy("timestamp", "asc"));
        unsub = onSnapshot(q, (snap) => {
          const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setMessages(msgs);
          setLoading(false);
        });
      } else {
        // no selection
        setMessages([]);
      }
      return () => {
        if (unsub) unsub();
      };
    }, [selectedChatUserId, selectedGroupId, user]);

    return (
      <div style={styles.chatPanel}>
        {!selectedChatUserId && !selectedGroupId ? (
          <div>
            <h3>Hoşgeldin, {user?.displayName}</h3>
            <p style={styles.empty}>Soldan bir sohbet veya grup seçerek konuşmaya başlayabilirsin.</p>
            {totalUnread > 0 && <p style={{ marginTop: 8 }}>Toplam okunmamış: <strong>{totalUnread}</strong></p>}
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <strong>
                  {selectedChatUserId
                    ? (users.find((u) => u.id === selectedChatUserId)?.username || selectedChatUserId)
                    : (groups.find((g) => g.id === selectedGroupId)?.name || "Grup")}
                </strong>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {selectedChatUserId ? "Özel Mesaj" : "Grup Sohbeti"}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {messages.length} mesaj
              </div>
            </div>

            <div>
              {loading ? <p>Yükleniyor...</p> : null}
              {messages.length === 0 && !loading ? (
                <p style={styles.empty}>Henüz mesaj yok.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {messages.map((m: any) => (
                    <div key={m.id || Math.random()} style={{
                      alignSelf: m.senderId === user.email ? "flex-end" : "flex-start",
                      background: m.senderId === user.email ? "#e6f0ff" : "#f1f1f1",
                      padding: "8px 10px",
                      borderRadius: 8,
                      maxWidth: "75%",
                    }}>
                      <div style={{ fontSize: 13 }}>{m.text}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                        {formatTimestamp(m.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // === Rendering ===
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.welcome}>Hoş Geldin, {user?.displayName}</div>
        <div style={styles.navButtons}>
          <button
            style={{
              ...styles.navButton,
              backgroundColor: hoveredButton === "home" ? styles.navButtonHover.backgroundColor : "transparent",
            }}
            onClick={() => handleNavigate("/home")}
            onMouseOver={() => setHoveredButton("home")}
            onMouseOut={() => setHoveredButton(null)}
          >
            <FaHome />
          </button>


          <button
            style={{
              ...styles.navButton,
              backgroundColor: hoveredButton === "group" ? styles.navButtonHover.backgroundColor : "transparent",
            }}
            onClick={() => handleNavigate("/groupcreate")}
            onMouseOver={() => setHoveredButton("group")}
            onMouseOut={() => setHoveredButton(null)}
          >
            <FaUsers />
          </button>
          <button
            style={{
              ...styles.navButton,
              backgroundColor: hoveredButton === "profile" ? styles.navButtonHover.backgroundColor : "transparent",
            }}
            onClick={() => handleNavigate("/profile")}
            onMouseOver={() => setHoveredButton("profile")}
            onMouseOut={() => setHoveredButton(null)}
          >
            <FaUser />
          </button>
          <button
            style={{
              ...styles.navButton,
              backgroundColor: hoveredButton === "settings" ? styles.navButtonHover.backgroundColor : "transparent",
            }}
            onClick={() => handleNavigate("/settings")}
            onMouseOver={() => setHoveredButton("settings")}
            onMouseOut={() => setHoveredButton(null)}
          >
            <FaCog />
          </button>
          <button
            style={{
              ...styles.navButton,
              backgroundColor: hoveredButton === "calls" ? styles.navButtonHover.backgroundColor : "transparent",
            }}
            onClick={() => handleNavigate("/calls")}
            onMouseOver={() => setHoveredButton("calls")}
            onMouseOut={() => setHoveredButton(null)}
          >
            <FaPhone />
          </button>
        </div>
      </div>

      {/* LEFT SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              style={styles.burgerBtn}
              // onClick={() => setSidebarOpen((s) => !s)}
              title="Filtre / Menü"
            >
              <FaBars />
            </button>
            <div style={{ fontWeight: 700 }}>Sohbetler</div>
            <div style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>{totalUnread > 0 ? `(${totalUnread})` : ""}</div>
          </div>

          <div>
            <button
              style={{ ...styles.filterBtn, background: filterType === "all" ? "#eaf0ff" : "white" }}
              onClick={() => setFilterType("all")}
            >
              Her Şey
            </button>
            <button
              style={{ ...styles.filterBtn, background: filterType === "dm" ? "#eaf0ff" : "white" }}
              onClick={() => setFilterType("dm")}
            >
              Özel
            </button>
            <button
              style={{ ...styles.filterBtn, background: filterType === "groups" ? "#eaf0ff" : "white" }}
              onClick={() => setFilterType("groups")}
            >
              Gruplar
            </button>
          </div>
        </div>

        <div style={styles.searchWrapper}>
          <input
            type="text"
            placeholder="Kullanıcı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchResults.length > 0 && (
            <div style={{
              marginTop: "0.4rem",
              backgroundColor: "#fff",
              border: "1px solid #eee",
              borderRadius: 6,
              boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
            }}>
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  style={{ padding: 8, borderBottom: "1px solid #f1f1f1", cursor: "pointer" }}
                  onClick={() => handleChatClick(result.id)}
                >
                  {result.username}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={styles.listSectionTitle}>Sohbet Geçmişin</div>
          {sortedUnified.length === 0 ? (
            <p style={styles.empty}>Henüz sohbet geçmişin yok.</p>
          ) : (
            <ul style={styles.userList}>
              {sortedUnified.map((item) => {
                return (
                  <li
                    key={`${item.type}_${item.id}`}
                    style={{
                      ...styles.userCard,
                      border: (item.type === "dm" && selectedChatUserId === item.id) || (item.type === "group" && selectedGroupId === item.id)
                        ? "2px solid #007bff"
                        : undefined,
                    }}
                    onClick={() => {
                      if (item.type === "dm") {
                        handleChatClick(item.id);
                      } else {
                        handleGroupClick(item.id);
                      }
                    }}
                  >
                    <div style={styles.userInfo}>
                      <div style={styles.username}>{item.title}</div>
                      <div style={styles.message}>{item.lastMessage?.text || "Henüz mesaj yok"}</div>
                    </div>
                    <div style={styles.chatMeta}>
                      <span style={styles.timestamp}>
                        {formatTimestamp(item.lastMessage?.timestamp)}
                      </span>
                      {item.unreadCount > 0 && (
                        <div style={styles.unreadBadge}>
                          {item.unreadCount}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - Chat / Group View */}
      <div style={{ gridColumn: "2 / 3" }}>
        <ChatView />
      </div>
    </div>
  );
};

export default Master;
