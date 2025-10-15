import { Routes, Route, useLocation } from 'react-router-dom';
import Login from '../src/login';
import Register from '../src/register';
import Master from '../src/master';
import ChatPage from '../src/message';
import Background from '../src/background';
import Callpage from '../src/callpage';
import GroupCreate from '../src/GroupCreate';
import GroupPage from '../src/GroupPage';
import Invitepage from '../src/InvitePage';
import { useEffect, useState } from 'react';

const App = () => {
  const location = useLocation();
  const [showBackground, setShowBackground] = useState(false);
  useEffect(() => {
    // Yalnızca oturum açıldıktan sonraki sayfalarda bildirimleri aktif et
    const privatePaths = ['/master', '/chat'];
    const isPrivatePath = privatePaths.some(path => location.pathname.startsWith(path));
    setShowBackground(isPrivatePath);
  }, [location]);
  return (
    <>
      {showBackground && <Background />}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/master" element={<Master />} />
        <Route path="/chat/:userId" element={<ChatPage />} />
        <Route path="/call" element={<Callpage />} />
        <Route path="/groupcreate" element={<GroupCreate />} />
        <Route path="/group/:groupId" element={<GroupPage />} />
        <Route path="/invite/:groupId" element={<Invitepage />} />

        {/* Diğer sayfalar buraya eklenebilir */}
      </Routes>
    </>
  );
};
export default App;

