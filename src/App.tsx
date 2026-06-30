import { Routes, Route } from "react-router-dom"
import { Sidebar } from "./components/layout/Sidebar"
import { TopBar } from "./components/layout/TopBar"
import RepoDetail from "./pages/RepoDetail"
import Dashboard from "./pages/Dashboard"
import StarCatalog from "./pages/StarCatalog"

function App() {
  return (
    <div className="min-h-screen bg-background text-on-surface font-sans">
      <Sidebar />
      <div className="md:ml-[280px]">
        <TopBar />
        <main className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto pb-24">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/repo" element={<RepoDetail />} />
            <Route path="/catalog" element={<StarCatalog />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
