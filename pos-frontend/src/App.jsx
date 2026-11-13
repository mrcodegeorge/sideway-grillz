import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Home, Auth, Orders, Tables, Menu, Dashboard } from "./pages";
import Header from "./components/shared/Header";
import { useSelector } from "react-redux";
import useLoadData from "./hooks/useLoadData";
import FullScreenLoader from "./components/shared/FullScreenLoader"
import OfflineBanner from "./components/shared/OfflineBanner";
import { isSupabaseConfigured } from "./supabase/client";

function MissingEnvScreen() {
  return (
    <div className="min-h-screen bg-[#121212] text-[#f5f5f5] flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-[#1a1a1a] border border-amber-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
        <h1 className="text-xl font-bold text-yellow-400">
          Environment Configuration Required
        </h1>
        <p className="text-sm text-[#ccc]">
          Supabase environment variables are missing in this deployment. Add the following
          variables in your <span className="text-white font-semibold">Vercel Project Settings → Environment Variables</span> and redeploy:
        </p>
        <pre className="bg-black/60 border border-[#2e2e2e] rounded-xl p-3 text-xs text-emerald-300 overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_PAYSTACK_PUBLIC_KEY=pk_...
VITE_PAYSTACK_CURRENCY=GHS`}
        </pre>
      </div>
    </div>
  );
}

function Layout() {
  const isLoading = useLoadData();
  const location = useLocation();
  const hideHeaderRoutes = ["/auth"];
  const { isAuth } = useSelector(state => state.user);

  if (!isSupabaseConfigured) return <MissingEnvScreen />;
  if(isLoading) return <FullScreenLoader />

  return (
    <>
      <OfflineBanner />
      {!hideHeaderRoutes.includes(location.pathname) && <Header />}
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoutes>
              <Home />
            </ProtectedRoutes>
          }
        />
        <Route path="/auth" element={isAuth ? <Navigate to="/" /> : <Auth />} />
        <Route
          path="/orders"
          element={
            <ProtectedRoutes>
              <Orders />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/tables"
          element={
            <ProtectedRoutes>
              <Tables />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/menu"
          element={
            <ProtectedRoutes>
              <Menu />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoutes>
              <Dashboard />
            </ProtectedRoutes>
          }
        />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </>
  );
}

function ProtectedRoutes({ children }) {
  const { isAuth } = useSelector((state) => state.user);
  if (!isAuth) {
    return <Navigate to="/auth" />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
