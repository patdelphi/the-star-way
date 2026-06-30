import { Routes, Route, Navigate } from "react-router-dom"
import { Sidebar } from "./components/layout/Sidebar"
import { TopBar } from "./components/layout/TopBar"
import Developers from "./pages/Developers"
import StarExplorer from "./pages/StarExplorer"
import RepositoryAnalysis from "./pages/RepositoryAnalysis"

function App() {
  return (
    <div className="min-h-screen bg-background text-on-surface font-sans">
      <Sidebar />
      <div className="md:ml-[280px]">
        <TopBar />
        <main className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto pb-24">
          <Routes>
            <Route path="/developers" element={<Developers />} />
            <Route path="/explorer" element={<StarExplorer />} />
            <Route path="/analysis" element={<RepositoryAnalysis />} />
            <Route path="/" element={<Navigate to="/developers" replace />} />
            <Route path="*" element={<Navigate to="/developers" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
