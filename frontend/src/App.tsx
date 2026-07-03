import { Routes, Route, Navigate } from "react-router-dom"
import { Sidebar } from "./components/layout/Sidebar"
import { TopBar } from "./components/layout/TopBar"
import Developers from "./pages/Developers"
import StarExplorer from "./pages/StarExplorer"
import RepositoryAnalysis from "./pages/RepositoryAnalysis"
import Settings from "./pages/Settings"
import Dashboard from "./pages/Dashboard"
import StarCatalog from "./pages/StarCatalog"
import { DeveloperProvider } from "./contexts/DeveloperContext"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { useTranslation } from "react-i18next"

function App() {
  const { t } = useTranslation()

  return (
    <DeveloperProvider>
      <div className="min-h-screen bg-background text-on-surface font-sans">
        <Sidebar />
        <div className="md:ml-[280px]">
          <TopBar />
          <main className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto pb-24">
            <ErrorBoundary
              title={t("app.errorTitle")}
              description={t("app.errorDescription")}
              actionLabel={t("app.errorAction")}
            >
              <Routes>
                <Route path="/developers" element={<Developers />} />
                <Route path="/explorer" element={<StarExplorer />} />
                <Route path="/catalog" element={<StarCatalog />} />
                <Route path="/analysis" element={<RepositoryAnalysis />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/" element={<Navigate to="/developers" replace />} />
                <Route path="*" element={<Navigate to="/developers" replace />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </DeveloperProvider>
  )
}

export default App
