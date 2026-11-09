import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { ChartColumn, House, Plus, Receipt, Target, type LucideIcon } from 'lucide-react';
import { fixCategoryColors, syncSalary } from './data/repo';
import { UiProvider, useUi } from './components/ui';
import Home from './pages/Home';
import Expenses from './pages/Expenses';
import Budgets from './pages/Budgets';
import Income from './pages/Income';
import Settings from './pages/Settings';

// Charts are the heaviest part of the app, so they load only when opened.
const Reports = lazy(() => import('./pages/Reports'));

const Tab = ({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) => (
  <NavLink to={to} end={to === '/'} className="nav-link">
    <Icon size={22} aria-hidden />
    <span>{label}</span>
  </NavLink>
);

function Shell() {
  const { newTransaction } = useUi();
  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <span className="nav-brand">Pocket</span>
        <Tab to="/" label="Home" icon={House} />
        <Tab to="/expenses" label="Expenses" icon={Receipt} />
        {/* Sits in the middle of the bar, in easy reach of your thumb on every screen. */}
        <button className="add-btn" onClick={() => newTransaction()} aria-label="Add expense">
          <Plus size={26} aria-hidden />
          <span className="add-label">Add expense</span>
        </button>
        <Tab to="/budget" label="Budget" icon={Target} />
        <Tab to="/reports" label="Reports" icon={ChartColumn} />
      </nav>
      <main className="main">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/budget" element={<Budgets />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/income" element={<Income />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    // Ask the browser not to clear this app's data when the device runs low on space.
    navigator.storage?.persist?.();
    void fixCategoryColors();
    const sync = () => {
      if (document.visibilityState === 'visible') void syncSalary();
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return (
    <UiProvider>
      <Shell />
    </UiProvider>
  );
}
