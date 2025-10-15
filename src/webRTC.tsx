// WebRTC.tsx (TÜM TESPİT EDİLEN HATALAR DÜZELTİLMİŞ HALİ)

import React, { useEffect, useRef, useState } from 'react';
import { db, auth } from './Firebaseconfig';
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import '../src/WebRTC.css';

interface Props {
  caller: string;
  callee: string;
  isCaller: boolean;
  onEnd: () => void;
}

const WebRTC: React.FC<Props> = ({ caller, callee, isCaller, onEnd }) => {
  const [status, setStatus] = useState('Aranıyor...');
  const [timer, setTimer] = useState(0);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<() => void>();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sortedEmails = [caller, callee].sort();
  const docId = `${sortedEmails[0]}__${sortedEmails[1]}`;
  const callDocRef = doc(db, 'calls', docId);

  const callStartTime = useRef<number | null>(null);
  const addedCandidates = useRef<Set<string>>(new Set());
  const [userReady, setUserReady] = useState(false);

  useEffect(() => {
    setCallEnded(false);
    setShowEndScreen(false);
    setTimer(0);
    setCallAccepted(false);
  }, [caller, callee]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setStatus('Kullanıcı doğrulanamadı. Lütfen tekrar giriş yapın.');
        return;
      }
      setUserReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userReady) return;

    const pc = new RTCPeerConnection();
    peerConnection.current = pc;

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        let remoteStream = remoteAudioRef.current.srcObject as MediaStream;
        if (!remoteStream) {
          remoteStream = new MediaStream();
          remoteAudioRef.current.srcObject = remoteStream;
        }
        if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }
      }
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await updateDoc(callDocRef, {
          [`candidates_${isCaller ? 'caller' : 'callee'}`]: arrayUnion(event.candidate.toJSON()),
        });
      }
    };

    if (isCaller) {
      initCaller(pc);
    } else {
      initCallee(pc);
    }

    listenForCandidates(pc);
    listenForCallEnd();

    return () => {
      cleanup(false);
    };
  }, [userReady]);

  const initCaller = async (pc: RTCPeerConnection) => {
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current.getTracks().forEach((track) => pc.addTrack(track, localStream.current!));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await setDoc(callDocRef, {
        from: caller,
        to: callee,
        offer,
        answer: null, // 🔧 Önceki cevapları sıfırla
        status: 'ringing',
        candidates_caller: [],
        candidates_callee: [],
        endCall: false,
        calls: [],
      }, { merge: true });

      const unsub = onSnapshot(callDocRef, async (docSnap) => {
        const data = docSnap.data();
        if (!data) return;

        if (data.status === 'accepted' && data.answer && !callAccepted) {
          setStatus('Görüşme başladı');
          setCallAccepted(true);
          callStartTime.current = Date.now();
          await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
          startTimer();
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
      });

      unsubscribeRef.current = unsub;

      timeoutRef.current = setTimeout(() => {
        if (!callAccepted) {
          setStatus(`${callee.split('@')[0]} şu an cevap veremiyor.`);
          setTimeout(() => {
            cleanup(true);
          }, 3000);
        }
      }, 30000);

    } catch (error) {
      console.error('Mikrofon erişimi alınamadı:', error);
      setStatus('Mikrofon izni reddedildi. Ayarlardan izin verin.');
    }
  };

  const initCallee = async (pc: RTCPeerConnection) => {
    const unsub = onSnapshot(callDocRef, async (docSnap) => {
      const data = docSnap.data();
      if (!data?.offer || callAccepted) return;

      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream.current.getTracks().forEach((track) => pc.addTrack(track, localStream.current!));

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await updateDoc(callDocRef, {
          ...data,
          answer,
          status: 'accepted',
        });

        setStatus('Görüşme başladı');
        setCallAccepted(true);
        callStartTime.current = Date.now();
        startTimer();
      } catch (err) {
        console.error('Mikrofon alınamadı:', err);
        setStatus('Mikrofon izni reddedildi.');
      }
    });

    unsubscribeRef.current = unsub;
  };

  const listenForCandidates = (pc: RTCPeerConnection) => {
    onSnapshot(callDocRef, (docSnap) => {
      const data = docSnap.data();
      if (!data) return;

      const otherSide = isCaller ? 'callee' : 'caller';
      const candidates = data[`candidates_${otherSide}`];

      if (Array.isArray(candidates)) {
        candidates.forEach(async (candidate: any) => {
          const candidateKey = JSON.stringify(candidate);
          if (!addedCandidates.current.has(candidateKey) && !callEnded) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
              addedCandidates.current.add(candidateKey);
            } catch (err) {
              console.error('ICE candidate eklenemedi:', err);
            }
          }
        });
      }
    });
  };

  const listenForCallEnd = () => {
    onSnapshot(callDocRef, (docSnap) => {
      const data = docSnap.data();
      if (data?.endCall && !callEnded) {
        stopTimer();
        setCallEnded(true);
        setStatus('Görüşme Bitti');
        setShowEndScreen(true);
        setTimeout(() => {
          setShowEndScreen(false);
          onEnd();
        }, 3000);
      }
    });
  };

  const startTimer = () => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => setTimer((prev) => prev + 1), 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const cleanup = async (triggerEndCall: boolean = true) => {
    stopTimer();
    unsubscribeRef.current?.();
    unsubscribeRef.current = undefined;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;

    peerConnection.current?.close();
    localStream.current?.getTracks().forEach((track) => track.stop());

    if (triggerEndCall) {
      await updateDoc(callDocRef, { endCall: true });
    }

    if (callAccepted && callStartTime.current) {
      await saveCallLog();
    }

    setCallEnded(true);
    setShowEndScreen(true);
    setTimeout(() => {
      setShowEndScreen(false);
      onEnd();
    }, 3000);
  };

  const saveCallLog = async () => {
    const endTime = Date.now();
    const duration = Math.floor((endTime - (callStartTime.current ?? endTime)) / 1000);

    const callLog = {
      caller,
      callee,
      callerName: caller.split('@')[0],
      calleeName: callee.split('@')[0],
      startTime: new Date(callStartTime.current!).toLocaleString(),
      endTime: new Date(endTime).toLocaleString(),
      duration,
    };

    try {
      await updateDoc(callDocRef, {
        calls: arrayUnion(callLog),
      });
    } catch (error) {
      console.error('Error saving call log:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="call-container">
      {showEndScreen ? (
        <div className="end-screen">
          <h2>Görüşme Bitti</h2>
        </div>
      ) : (
        <div className="call-card">
          <h2 className="status-text">{status}</h2>
          {callAccepted && <p className="timer">Süre: {formatTime(timer)}</p>}
          <audio ref={remoteAudioRef} autoPlay />
          {!callEnded && (
            <button className="end-btn" onClick={() => cleanup(true)}>
              Görüşmeyi Bitir
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default WebRTC;