
// src/pages/Register.tsx
import React, { useState } from 'react';
import { auth, db } from '../src/Firebaseconfig'; // Adjust the import path as necessary
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const handleRegister = async () => {
    if (password !== confirmPassword) {
      alert('Hata: Şifreler uyuşmuyor.');
      return;
    }
    if (!username.trim()) {
      alert('Hata: Lütfen bir kullanıcı adı girin.');
      return;
    }
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        alert('Hata: Bu kullanıcı adı zaten alınmış.');
        setLoading(false);
        return;
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, 'users', email), {
        uid: user.uid,
        username,
        email,
      });
      navigate('/');
    } catch (error) {
      alert('Hata: Kayıt başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };
  const handleGoToLogin = () => {
    navigate('/');
  };
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Kayıt Ol</h2>
      <input
        type="text"
        placeholder="Kullanıcı Adı"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={styles.input}
      />
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
      <input
        type="password"
        placeholder="Şifreyi Onayla"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        style={styles.input}
      />
      <button
        onClick={handleRegister}
        disabled={loading}
        style={styles.button}
      >
        {loading ? 'Kayıt Yapılıyor...' : 'Kayıt Ol'}
      </button>
      {/* Yeni eklenen giriş yap linki */}
      <p style={styles.registerText}>
        Hesabın var mı?{' '}
        <span onClick={handleGoToLogin} style={styles.registerLink}>
          Giriş Yap
        </span>
      </p>
    </div>
  );
};
export default Register;
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: 20,
    maxWidth: 400,
    margin: 'auto',
    marginTop: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingLeft: 10,
    marginBottom: 12,
    border: '1px solid #ccc',
    fontSize: 16,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: '#800020',
    color: '#fff',
  },
  registerText: {
    marginTop: 15,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  registerLink: {
    color: '#800020',
    cursor: 'pointer',
    textDecoration: 'underline',
    marginLeft: 4,
  },
};
