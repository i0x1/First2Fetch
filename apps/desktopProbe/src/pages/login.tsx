import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { LoginCard } from '@/components/loginCard';
import { useError } from '@/hooks/error';
import { useSession } from '@/hooks/session';
import { loginWithEmail, requestLoginCode, verifyLoginCode } from '@/lib/electronMainSdk';

/**
 * Component used to render the login page.
 */
export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const { handleError } = useError();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const onRequestLoginCode = async ({ email }: { email: string }) => { try { setIsSubmitting(true); await requestLoginCode({ email }); } catch (error) { handleError({ error }); } finally { setIsSubmitting(false); } };
  const onVerifyLoginCode = async ({ email, token }: { email: string; token: string }) => { try { setIsSubmitting(true); const user = await verifyLoginCode({ email, token }); await login(user); navigate('/'); } catch (error) { handleError({ error }); } finally { setIsSubmitting(false); } };

  const onLoginWithEmail = async ({ email, password }: { email: string; password: string }) => {
    try {
      setIsSubmitting(true);
      const user = await loginWithEmail({ email, password });
      await login(user);
      navigate('/');
    } catch (error) {
      handleError({ error });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center">
      <LoginCard onLoginWithEmail={onLoginWithEmail} onRequestLoginCode={onRequestLoginCode} onVerifyLoginCode={onVerifyLoginCode} isSubmitting={isSubmitting} />
    </main>
  );
}
