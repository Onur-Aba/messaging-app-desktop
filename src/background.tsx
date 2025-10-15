import React, { useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../src/Firebaseconfig';
import Notification from '../src/notification';
import { useLocation, useNavigate } from 'react-router-dom';

interface MessageData {
  senderId: string;
  text: string;
  timestamp: any;
}

const Background: React.FC = () => {
  const [notification, setNotification] = useState<{
    senderName: string;
    messagePreview: string;
    onOpenChat: () => void;
  } | null>(null);
  const [incomingCall, setIncomingCall] = useState<null | {
    from: string;
    to: string;
  }>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const lastShownTimestamps = useRef<{ [chatId: string]: number }>({});

  useEffect(() => {
    if (!currentUser) return;
    const usersRef = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(usersRef, async (snapshot) => {
      const usersMap: { [uid: string]: { email: string; username?: string } } = {};
      snapshot.forEach((docSnap) => {
        usersMap[docSnap.id] = {
          email: docSnap.data().email,
          username: docSnap.data().username,
        };
      });

      Object.entries(usersMap).forEach(([_, user]) => {
        if (user.email === currentUser.email) return;
        const chatId = [currentUser.email, user.email].sort().join('_');
        const chatRef = doc(db, 'chats', chatId);
        onSnapshot(chatRef, (docSnap) => {
          if (!docSnap.exists()) return;
          const messages: MessageData[] = docSnap.data().messages || [];
          const lastMessage = messages[messages.length - 1];
          if (!lastMessage) return;
          const lastTimestamp = lastMessage.timestamp?.seconds || 0;
          const prevTimestamp = lastShownTimestamps.current[chatId] || 0;
          if (lastTimestamp === prevTimestamp) return;
          if (lastMessage.senderId === currentUser.email) return;

          const isChatPage = location.pathname.startsWith('/chat/');
          const activeUserId = isChatPage ? location.pathname.split('/chat/')[1] : null;
          const senderUid = Object.entries(usersMap).find(
            ([_, val]) => val.email === lastMessage.senderId
          )?.[0];
          if (isChatPage && senderUid && activeUserId === senderUid) {
            return;
          }

          const senderName = usersMap[senderUid || '']?.username || lastMessage.senderId;
          setNotification({
            senderName,
            messagePreview: lastMessage.text,
            onOpenChat: () => navigate(`/chat/${senderUid}`),
          });
          lastShownTimestamps.current[chatId] = lastTimestamp;
        });
      });
    });
    return () => {
      unsubscribeUsers();
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!currentUser) return;
    const callsRef = collection(db, 'calls');
    const unsub = onSnapshot(callsRef, (snapshot) => {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.to === currentUser.email && data.status === 'ringing') {
          setIncomingCall({ from: data.from, to: currentUser.email ?? '' });
        }
      });
    });
    return () => unsub();
  }, []);

  return (
    <>
      {notification && (
        <Notification
          senderName={notification.senderName}
          messagePreview={notification.messagePreview}
          onClose={() => setNotification(null)}
          onOpenChat={notification.onOpenChat}
        />
      )}

      {incomingCall && (
        <div style={styles.popupOverlay}>
          <div style={styles.popupContainer}>
            <h3 style={styles.title}>{incomingCall.from} sizi arıyor</h3>
            <div style={styles.buttonGroup}>
              <button
                style={{ ...styles.button, ...styles.accept }}
                onClick={() => {
                  window.location.href = `/call?caller=${incomingCall.from}&callee=${incomingCall.to}&isCaller=false`;
                }}
              >
                Kabul Et
              </button>
              <button
                style={{ ...styles.button, ...styles.reject }}
                onClick={() => setIncomingCall(null)}
              >
                Reddet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  popupOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  popupContainer: {
    backgroundColor: '#fff',
    padding: '24px',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    textAlign: 'center',
    minWidth: '300px',
  },
  title: {
    fontSize: '1.25rem',
    marginBottom: '16px',
    color: '#333',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
  },
  button: {
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    border: 'none',
    color: '#fff',
  },
  accept: {
    backgroundColor: '#4CAF50',
  },
  reject: {
    backgroundColor: '#F44336',
  },
};

export default Background;
