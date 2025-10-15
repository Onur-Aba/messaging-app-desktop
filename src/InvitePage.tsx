import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { auth, db } from "../src/Firebaseconfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion, Timestamp } from "firebase/firestore";

export default function InvitePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [inviteData, setInviteData] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);

  const token = searchParams.get("token");

  // 🔹 Oturum dinle
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsub();
  }, []);

  // 🔹 Daveti yükle
  useEffect(() => {
    const loadInvite = async () => {
      if (!groupId || !token) return;
      const inviteRef = doc(db, "groups", groupId, "invites", token);
      const snap = await getDoc(inviteRef);
      if (snap.exists()) setInviteData(snap.data());
      setLoading(false);
    };
    loadInvite();
  }, [groupId, token]);

  const handleJoinGroup = async () => {
    if (!currentUser || !inviteData) return;

    try {
      const groupRef = doc(db, "groups", inviteData.groupId);
      const groupSnap = await getDoc(groupRef);
      if (!groupSnap.exists()) return alert("Grup bulunamadı!");

      const groupData = groupSnap.data();

      // Zaten üye mi?
      const alreadyMember = (groupData.members || []).some(
        (m: any) => m.email === currentUser.email
      );
      if (alreadyMember) {
        alert("Zaten bu grubun üyesisiniz!");
        return navigate(`/group/${inviteData.groupId}`);
      }

      // 🔹 Gruba ekle
      await updateDoc(groupRef, {
        members: arrayUnion({
          email: currentUser.email,
          role: "member",
          joinedAt: Timestamp.now(),
        }),
      });

      setJoined(true);
      alert("Gruba başarıyla katıldınız!");
      navigate(`/group/${inviteData.groupId}`);
    } catch (err) {
      console.error(err);
      alert("Gruba katılırken hata oluştu!");
    }
  };

  if (loading) return <div style={{ color: "#fff" }}>Yükleniyor...</div>;

  if (!inviteData)
    return <div style={{ color: "#fff" }}>Davet geçersiz veya süresi dolmuş.</div>;

  return (
    <div
      style={{
        height: "100vh",
        background: "#1e1f22",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "#fff",
        flexDirection: "column",
      }}
    >
      <h2>🎉 Davet Edildiniz!</h2>
      <p>
        <strong>{inviteData.inviter}</strong> sizi{" "}
        <strong>{inviteData.groupName}</strong> grubuna davet etti.
      </p>
      {currentUser ? (
        <button
          onClick={handleJoinGroup}
          style={{
            background: "#5865f2",
            color: "#fff",
            padding: "10px 20px",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            marginTop: "12px",
          }}
        >
          {joined ? "Katıldınız 🎉" : "Gruba Katıl"}
        </button>
      ) : (
        <p>Katılmak için lütfen giriş yapın.</p>
      )}
    </div>
  );
}
