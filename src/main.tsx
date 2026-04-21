import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { QuizMintSplash } from './components/QuizMintSplash';
import { AuthProvider } from './lib/auth';
import './index.css';

function Root() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <AuthProvider>
      <App />
      {showSplash && (
        <QuizMintSplash
          minDurationMs={5000}
          onDone={() => setShowSplash(false)}
        />
      )}
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
