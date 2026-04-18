import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { QuizMintSplash } from './components/QuizMintSplash';
import './index.css';

function Root() {
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem('qm-splash-seen');
  });

  return (
    <>
      <App />
      {showSplash && (
        <QuizMintSplash
          onDone={() => {
            sessionStorage.setItem('qm-splash-seen', '1');
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
