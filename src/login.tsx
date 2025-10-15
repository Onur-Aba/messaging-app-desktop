import React, { useState, useEffect, useRef } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../src/Firebaseconfig';
import { useNavigate } from 'react-router-dom';
const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/master');
    } catch (error: any) {
      let errorMessage = 'Bilinmeyen bir hata oluştu.';
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Email ya da parola yanlış, bilgileri kontrol edip tekrar deneyin.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Çok fazla başarısız giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.';
      }
      setError(errorMessage);
      setShowPopup(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPopup(false);
      }
    };
    if (showPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopup]);
  const handleGoToRegister = () => {
    navigate('/register');
  };
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Giriş Yap</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={styles.input}
      />
      <input
        type="password"
        placeholder="Şifre"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={styles.input}
      />
      <button onClick={handleLogin} disabled={loading} style={styles.button}>
        {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
      </button>
      {/* Yeni eklenen kayıt ol linki */}
      <p style={styles.registerText}>
        Hesabın yok mu?{' '}
        <span onClick={handleGoToRegister} style={styles.registerLink}>
          Kayıt Ol
        </span>
      </p>
      {/* Hata mesajı için pop-up */}
      {showPopup && (
        <div style={styles.popupOverlay}>
          <div ref={popupRef} style={styles.popup}>
            <p style={styles.popupText}>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};
export default Login;
// Stil tanımları
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
  },
  input: {
    height: '45px',
    width: '300px',
    padding: '10px',
    marginBottom: '15px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    fontSize: '16px',
  },
  button: {
    width: '300px',
    padding: '12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#800020',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  registerText: {
    marginTop: '15px',
    fontSize: '14px',
    color: '#333',
  },
  registerLink: {
    color: '#800020',
    cursor: 'pointer',
    textDecoration: 'underline',
    marginLeft: '4px',
  },
  popupOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    maxWidth: '300px',
    textAlign: 'center',
  },
  popupText: {
    color: '#333',
    fontSize: '16px',
  },
};