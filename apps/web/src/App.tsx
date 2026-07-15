import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { IdentityProvider } from './state/IdentityContext';
import { Home } from './pages/Home';
import { Lobby } from './pages/Lobby';
import { Reading } from './pages/Reading';
import { Trial } from './pages/Trial';
import { Verdict } from './pages/Verdict';
import { Reveal } from './pages/Reveal';
import { CaseFile } from './pages/CaseFile';

export function App() {
  return (
    <IdentityProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join/:roomCode" element={<Home />} />
          <Route path="/room/:roomCode/lobby" element={<Lobby />} />
          <Route path="/room/:roomCode/reading" element={<Reading />} />
          <Route path="/room/:roomCode/trial" element={<Trial />} />
          <Route path="/room/:roomCode/verdict" element={<Verdict />} />
          <Route path="/room/:roomCode/reveal" element={<Reveal />} />
          <Route path="/room/:roomCode/case" element={<CaseFile />} />
        </Routes>
      </BrowserRouter>
    </IdentityProvider>
  );
}
