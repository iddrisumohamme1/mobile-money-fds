import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('Exchanging authorization code…');
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const next = params.get('next') || '/dashboard';

    (async () => {
      try {
        if (supabase && code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus(error.message);
            setTimeout(() => navigate('/login', { replace: true }), 1500);
            return;
          }
        }
        setStatus('Session authorized.');
        navigate(next, { replace: true });
      } catch (err) {
        setStatus(err?.message || 'Something went wrong while authorizing.');
        setTimeout(() => navigate('/login', { replace: true }), 1500);
      }
    })();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
      <div className="w-full max-w-xs text-center space-y-5">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/40">
          <Shield size={22} className="text-white" />
        </div>
        <div className="flex items-center justify-center gap-2 font-mono text-xs text-slate-400">
          <span className="blink w-1.5 h-3.5 bg-indigo-400 inline-block shrink-0" />
          {status}
        </div>
      </div>
    </div>
  );
}
