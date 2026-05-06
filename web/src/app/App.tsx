import { RouterProvider } from 'react-router-dom';
import { Providers } from './providers';
import { router } from './router';
import { useAuth } from './AuthContext';
import { StreamProvider } from './StreamContext';
import { LoginPage } from '@/features/auth/LoginPage';

function Gate() {
  const auth = useAuth();
  if (auth.status === 'loading') {
    // Block on the initial /auth/me check so we don't flash the login screen
    // for already-authenticated reloads.
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--color-text-muted)',
        }}
      >
        loading…
      </div>
    );
  }
  if (auth.status === 'guest') return <LoginPage />;
  return (
    <StreamProvider>
      <RouterProvider router={router} />
    </StreamProvider>
  );
}

export function App() {
  return (
    <Providers>
      <Gate />
    </Providers>
  );
}
