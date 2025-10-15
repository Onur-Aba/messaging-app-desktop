
import React, { useEffect, useState } from 'react';
interface NotificationProps {
  messagePreview: string;
  senderName: string;
  onClose: () => void;
  onOpenChat: () => void;
}
const Notification: React.FC<NotificationProps> = ({
  messagePreview,
  senderName,
  onClose,
  onOpenChat,
}) => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 10000);
    return () => clearTimeout(timer);
  }, [onClose]);
  if (!visible) return null;
  return (
    <div style={styles.notificationContainer}>
      <div onClick={onOpenChat} style={styles.notificationContent}>
        <div style={styles.senderText}>{senderName}</div>
        <div style={styles.messagePreview}>{messagePreview}</div>
      </div>
      <button onClick={() => { setVisible(false); onClose(); }} style={styles.closeButton}>×</button>
    </div>
  );
};
const styles: { [key: string]: React.CSSProperties } = {
  notificationContainer: {
    position: 'fixed',
    top: '10px',
    left: '10px',
    right: '10px',
    padding: '15px',
    borderRadius: '10px',
    backgroundColor: '#fff',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    zIndex: 9999,
    animation: 'slideDown 0.5s ease',
  },
  notificationContent: {
    flex: 1,
    cursor: 'pointer',
  },
  senderText: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
  },
  messagePreview: {
    fontSize: '14px',
    marginTop: '5px',
    color: '#555',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    marginLeft: '10px',
    color: '#800020',
  },
};
const style = document.createElement('style');
style.innerHTML = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-100%);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);
export default Notification;
