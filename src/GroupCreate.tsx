import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../src/Firebaseconfig";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  getDoc,
  Timestamp,
} from "firebase/firestore";

interface Role {
  id: string;
  name: string;
  permissions: {
    manage_roles: boolean;
    create_channels: boolean;
    invite_members: boolean;
    manage_members: boolean;
    manage_channels: boolean;
    sunucu_sahibi: boolean;
  };
}

interface AppUser {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
}

const defaultRole = (id: string, name = "Yeni Rol"): Role => ({
  id,
  name,
  permissions: {
    manage_roles: false,
    create_channels: false,
    invite_members: false,
    manage_members: false,
    manage_channels: false,
    sunucu_sahibi: false,
  },
});

const permissionDescriptions: Record<keyof Role["permissions"], string> = {
  manage_roles: "Rolleri ekleme, düzenleme ve silme izni verir.",
  create_channels: "Yeni metin veya sesli kanallar oluşturma izni verir.",
  invite_members: "Gruba yeni üyeleri davet etme izni verir.",
  manage_members: "Üyelerin rollerini düzenleme ve çıkarma izni verir.",
  manage_channels: "Mevcut kanalları düzenleme ve silme izni verir.",
  sunucu_sahibi: "Tüm yetkilere otomatik olarak sahip olur.",
};

const GroupCreate: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [roles, setRoles] = useState<Role[]>([
    {
      id: crypto.randomUUID(),
      name: "owner",
      permissions: {
        manage_roles: true,
        create_channels: true,
        invite_members: true,
        manage_members: true,
        manage_channels: true,
        sunucu_sahibi: true,
      },
    },
  ]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(roles[0].id);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [potentialInvitees, setPotentialInvitees] = useState<AppUser[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<Record<string, boolean>>({});

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setCurrentUser(u);
      else navigate("/login");
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) return;
    const loadUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const list: AppUser[] = snap.docs
        .filter((d) => d.id !== currentUser.email)
        .map((d) => ({ id: d.id, email: d.id, ...(d.data() as any) }));
      setPotentialInvitees(list);
    };
    loadUsers();
  }, [currentUser]);

  const addRole = () => {
    const id = crypto.randomUUID();
    setRoles((prev) => [...prev, defaultRole(id)]);
    setSelectedRoleId(id);
  };

  const updateRoleName = (id: string, name: string) => {
    if (roles.find((r) => r.name.toLowerCase() === "owner" && r.id === id)) return; // owner değiştirilemez
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
  };

  const togglePermission = (roleId: string, perm: keyof Role["permissions"]) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== roleId) return r;
        if (r.name.toLowerCase() === "owner") return r; // owner yetkileri değişmez
        const newPerms = { ...r.permissions };

        if (perm === "sunucu_sahibi") {
          const enableAll = !r.permissions.sunucu_sahibi;
          Object.keys(newPerms).forEach((key) => {
            (newPerms as any)[key] = enableAll;
          });
        } else {
          newPerms[perm] = !r.permissions[perm];
        }

        return { ...r, permissions: newPerms };
      })
    );
  };

  const toggleInvitee = (email: string) => {
    setSelectedInvitees((prev) => ({ ...prev, [email]: !prev[email] }));
  };

const createGroup = async () => {
  if (!currentUser) return;
  if (!groupName.trim()) {
    setMessage("Lütfen grup adı girin.");
    return;
  }

  setBusy(true);
  setMessage(null);

  try {
    // 🔹 1️⃣ Benzersiz ama anlamlı ID üretelim
    const randomId = crypto.randomUUID();
    const safeName = groupName.replace(/\s+/g, "_").toLowerCase();
    const groupId = `${randomId}_${safeName}`; // örn: 123e4567_techtalks
    const createdAt = Timestamp.now();

    // 🔹 2️⃣ Grup oluştur
    const ownerMember = { email: currentUser.email, role: "owner" };

    const groupDoc = {
      id: groupId,
      name: groupName,
      owner: currentUser.email,
      description: description || "",
      members: [ownerMember],
      roles,
      channels: [],
      createdAt,
    };

    await setDoc(doc(db, "groups", groupId), groupDoc);

    // 🔹 3️⃣ Davet gönderilecek kullanıcılar
    const selectedEmails = Object.keys(selectedInvitees).filter((e) => selectedInvitees[e]);

    for (const email of selectedEmails) {
      // 🔹 4️⃣ Invite ID = groupId (yani aynı!)
      const inviteId = groupId;
      const inviteData = {
        id: inviteId,
        inviter: currentUser.email,
        invitee: email,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 3600 * 1000)),
        groupId, // aynı ID
        groupName,
      };

      // 🔹 5️⃣ Davet dokümanını kaydet
      await setDoc(doc(db, `groups/${groupId}/invites`, inviteId), inviteData);

      // 🔹 6️⃣ Chat oluştur / mesaj ekle
      const chatId = [currentUser.email, email].sort().join("_");
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);

const inviteMessage = {
  id: crypto.randomUUID(),
  senderId: currentUser.email,
  type: "invite",
  text: `${currentUser.displayName || currentUser.email} sizi ${groupName} grubuna davet etti.`,
  invite: {
    id: inviteId,
    link: `/invite/${groupId}?token=${inviteId}`,
    groupName,
    groupId,
    status: "pending", // ✅ yeni: davet beklemede
  },
  timestamp: Timestamp.now(),
  status: "sent",
};


      if (chatSnap.exists()) {
        await updateDoc(chatRef, { messages: arrayUnion(inviteMessage) });
      } else {
        await setDoc(chatRef, {
          id: chatId,
          participants: [currentUser.email, email],
          messages: [inviteMessage],
        });
      }
    }

    // 🔹 7️⃣ İşlem tamam → yönlendir
    setMessage(`Grup oluşturuldu ve ${selectedEmails.length} davet gönderildi.`);
    navigate(`/group/${groupId}`);
  } catch (err) {
    console.error(err);
    setMessage("Grup oluşturulurken hata oluştu.");
  } finally {
    setBusy(false);
  }
};


  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0];

  const styles: { [k: string]: React.CSSProperties } = {
    page: { maxWidth: "1100px", margin: "0 auto", padding: "1.5rem", fontFamily: "Segoe UI, sans-serif", color: "#222" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
    closeBtn: { background: "transparent", border: "1px solid #ddd", borderRadius: 6, padding: "6px 10px", cursor: "pointer" },
    layout: { display: "grid", gridTemplateColumns: "1fr 360px", gap: "1rem" },
    card: { background: "#fafafa", padding: "1rem", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
    input: { width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #ccc", marginBottom: "0.75rem", fontSize: 14 },
    roleItem: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "8px", borderRadius: 6, background: "#fff", border: "1px solid #e6e6e6", cursor: "pointer" },
    toggle: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.2rem" },
    permDesc: { fontSize: 12, color: "#666" },
    plusBtn: { background: "#007bff", color: "#fff", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer" },
    primaryBtn: { background: "#007bff", color: "#fff", padding: "8px 12px", border: "none", borderRadius: 6, cursor: "pointer" },
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2>Yeni Grup Oluştur</h2>
        <button style={styles.closeBtn} onClick={() => navigate(-1)}>✕ Kapat</button>
      </div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <label>Grup Adı</label>
          <input style={styles.input} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Örn: TechTalks" />

          <label>Açıklama</label>
          <textarea style={{ ...styles.input, minHeight: 100 }} value={description} onChange={(e) => setDescription(e.target.value)} />

          <div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>Roller</strong>
              <button style={styles.plusBtn} onClick={addRole}>+ Rol Ekle</button>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                {roles.map((r) => (
                  <div
                    key={r.id}
                    style={{ ...styles.roleItem, borderColor: selectedRoleId === r.id ? "#007bff" : "#e6e6e6" }}
                    onClick={() => setSelectedRoleId(r.id)}
                  >
                    <input
                      value={r.name}
                      onChange={(e) => updateRoleName(r.id, e.target.value)}
                      disabled={r.name.toLowerCase() === "owner"}
                      style={{ border: "none", outline: "none", fontWeight: 600 }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ flexBasis: 260 }}>
                <strong>Yetkiler</strong>
                {selectedRole &&
                  (Object.keys(selectedRole.permissions) as (keyof Role["permissions"])[]).map((perm) => (
                    <label key={perm} style={styles.toggle}>
                      <div>
                        <input
                          type="checkbox"
                          checked={selectedRole.permissions[perm]}
                          disabled={
                            selectedRole.name.toLowerCase() === "owner"
                              ? true
                              : perm === "sunucu_sahibi" && selectedRole.permissions[perm]
                          }
                          onChange={() => togglePermission(selectedRole.id, perm)}
                        />{" "}
                        {perm.replace("_", " ")}
                      </div>
                      <span style={styles.permDesc}>{permissionDescriptions[perm]}</span>
                    </label>
                  ))}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <strong>Üye Davet Et</strong>
              <button style={{ ...styles.primaryBtn, marginLeft: 8 }} onClick={() => setInviteModalOpen(true)}>Davet Seç</button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button style={styles.primaryBtn} onClick={createGroup} disabled={busy}>
              {busy ? "Oluşturuluyor..." : "Grup Oluştur"}
            </button>
            {message && <p style={{ marginTop: 8 }}>{message}</p>}
          </div>
        </div>
      </div>

      {inviteModalOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center"
        }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: "1rem", width: 480, maxHeight: "80vh", overflowY: "auto" }}>
            <h3>Kullanıcı Seç</h3>
            {potentialInvitees.map((u) => (
              <div key={u.email} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <input
                  type="checkbox"
                  checked={!!selectedInvitees[u.email]}
                  onChange={() => toggleInvitee(u.email)}
                />
                <div>
                  <strong>{u.username || u.displayName || u.email}</strong>
                  <div style={{ fontSize: 12, color: "#666" }}>{u.email}</div>
                </div>
              </div>
            ))}
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <button style={styles.closeBtn} onClick={() => setInviteModalOpen(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupCreate;
