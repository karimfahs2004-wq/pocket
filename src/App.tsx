import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { ArrowLeftRight, ChartColumn, House, Plus, Repeat, Target } from 'lucide-react';
import { syncRecurring } from './data/repo';
import { UiProvider, useUi } from './components/ui';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import Recurring from './pages/Recurring';
import Budgets from './pages/Budgets';
import Settings from './pages/Settings';

// Charts are the heaviest part of the app, so they load only when opened.
const Reports = lazy(() => import('./pages/Reports'));

const NAV = [
  { to: '/', label: 'Home', icon: House },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/recurring', label: 'Recurring', icon: Repeat },
  { to: '/budget', label: 'Budget', icon: Target },
  { to: '/reports', label: 'Reports', icon: ChartColumn },
];

function Shell() {
  const { newTransaction } = useUi();
  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <span className="nav-brand">Pocket</span>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="nav-link">
            <Icon size={21} aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/budget" element={<Budgets />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <button className="fab" onClick={() => newTransaction()} aria-label="Add transaction">
        <Plus size={26} aria-hidden />
      </button>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    // Ask the browser not to clear this app's data when the device runs low on space.
    navigator.storage?.persist?.();
    const sync = () => {
      if (document.visibilityState === 'visible') void syncRecurring();
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
