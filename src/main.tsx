import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { QuizMintSplash } from './components/QuizMintSplash';
import './index.css';

function Root() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      <App />
      {showSplash && (
        <QuizMintSplash
          minDurationMs={5000}
          onDone={() => setShowSplash(false)}
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
