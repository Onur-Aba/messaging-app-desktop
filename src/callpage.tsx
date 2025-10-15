// src/pages/CallPage.tsx
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WebRTC from '../src/webRTC';
const CallPage: React.FC = () => {
  const navigate = useNavigate();
  const query = new URLSearchParams(useLocation().search);
  const caller = query.get('caller')!;
  const callee = query.get('callee')!;
  const isCaller = query.get('isCaller') === 'true';
  const [isEnded, setIsEnded] = useState(false);
  return (
    <div>
      {!isEnded ? (
        <WebRTC
          caller={caller}
          callee={callee}
          isCaller={isCaller}
          onEnd={() => {
            setIsEnded(true);
            navigate('/master');
          }}
        />
      ) : (
        <h2>Görüşme sonlandı.</h2>
      )}
    </div>
  );
};
export default CallPage;