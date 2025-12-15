import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import SetupTeams from './pages/SetupTeams'
import SetupScoring from './pages/SetupScoring'

import InputScore from './pages/InputScore'
import Ranker from './pages/Ranker'
import Winners from './pages/Winners'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/rank" replace />} />
          <Route path="setup/teams" element={<SetupTeams />} />
          <Route path="setup/scoring" element={<SetupScoring />} />
          <Route path="input" element={<InputScore />} />
          <Route path="rank" element={<Ranker />} />
          <Route path="winners" element={<Winners />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
