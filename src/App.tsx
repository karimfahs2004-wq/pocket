import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ChartColumn, House, Plus, Receipt, Target, type LucideIcon } from 'lucide-react';
import { fixCategoryColors, syncSalary } from './data/repo';
import { UiProvider, useUi } from './components/ui';
import { LockGate } from './components/LockGate';
import Home from './pages/Home';
import Expenses from './pages/Expenses';
import Budgets from './pages/Budgets';
import Income from './pages/Income';
import Settings from './pages/Settings';
import Savings from './pages/Savings';

// Charts are the heaviest part of the app, so they load only when opened.
const Reports = lazy(() => import('./pages/Reports'));

const TABS = ['/', '/expenses', '/budget', '/reports'];

const Tab = ({ to, label, icon: Icon, parent }: { to: string; label: string; icon: LucideIcon; parent: boolean }) => (
  <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive || parent ? ' active' : ''}`}>
    <Icon size={22} aria-hidden />
    <span>{label}</span>
  </NavLink>
);

function Shell() {
  const { newTransaction, lastTab, setLastTab } = useUi();
  const { pathname } = useLocation();
  const onTab = TABS.includes(pathname);
  useEffect(() => { if (onTab) setLastTab(pathname); }, [onTab, pathname, setLastTab]);
  // Settings and Income aren't tabs, so the tab you opened them from stays highlighted.
  const parent = (to: string) => !onTab && lastTab === to;
  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <span className="nav-brand">Pocket</span>
        <Tab to="/" label="Home" icon={House} parent={parent('/')} />
        <Tab to="/expenses" label="Expenses" icon={Receipt} parent={parent('/expenses')} />
        {/* Sits in the middle of the bar, in easy reach of your thumb on every screen. */}
        <button className="add-btn" onClick={() => newTransaction()} aria-label="Add expense">
          <Plus size={26} aria-hidden />
          <span className="add-label">Add expense</span>
        </button>
        <Tab to="/budget" label="Budget" icon={Target} parent={parent('/budget')} />
        <Tab to="/reports" label="Reports" icon={ChartColumn} parent={parent('/reports')} />
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
            <Route path="/savings" element={<Savings />} />
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
    <LockGate>
      <UiProvider>
        <Shell />
      </UiProvider>
    </LockGate>
  );
}
