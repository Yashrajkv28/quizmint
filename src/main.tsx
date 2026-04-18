import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { QuizMintSplash } from './components/QuizMintSplash';
import './index.css';

function Root() {
  const [showSplash, setShowSplash] = useState(true);
  const isFirstEver = typeof window !== 'undefined' && !localStorage.getItem('qm-splash-first-done');
  const duration = isFirstEver ? 5000 : 2800;

  return (
    <>
      <App />
      {showSplash && (
        <QuizMintSplash
          minDurationMs={duration}
          onDone={() => {
            if (isFirstEver) localStorage.setItem('qm-splash-first-done', '1');
            setShowSplash(false);
          }}
        />
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
