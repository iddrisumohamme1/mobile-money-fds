import { useState } from 'react';
import NavHeader from '../components/dashboard/NavHeader';
import KpiBar from '../components/dashboard/KpiBar';
import TransactionFeed from '../components/dashboard/TransactionFeed';
import RiskInspectorDrawer from '../components/dashboard/RiskInspectorDrawer';
import AnalyticsPanel from '../components/dashboard/AnalyticsPanel';
import { useTransactionStream } from '../hooks/useTransactionStream';
import { useKpiMetrics } from '../hooks/useKpiMetrics';

export default function DashboardPage() {
  const { transactions, connectionStatus, updateTransaction } = useTransactionStream();
  const metrics = useKpiMetrics(transactions);
  const [selectedTx, setSelectedTx] = useState(null);

  const blockedAlerts = transactions.filter(t => t.risk_tier === 'blocked' && !t.analyst_action);

  const handleSelectAlert = (tx) => {
    setSelectedTx(tx);
    requestAnimationFrame(() => {
      document.getElementById(`tx-row-${tx.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      <NavHeader
        connectionStatus={connectionStatus}
        alerts={blockedAlerts}
        onSelectAlert={handleSelectAlert}
      />

      <main className="flex-1 flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 max-w-[1800px] w-full mx-auto">
        {/* KPI Bar */}
        <KpiBar metrics={metrics} connectionStatus={connectionStatus} />

        {/* Main grid: Feed + Analytics */}
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-5 gap-4 min-h-0">
          {/* Left: Transaction Feed (60%) */}
          <div className="xl:col-span-3 min-h-[420px] sm:min-h-[600px] xl:min-h-0">
            <TransactionFeed
              transactions={transactions}
              selectedTx={selectedTx}
              onSelect={(tx) => setSelectedTx(prev => prev?.id === tx.id ? null : tx)}
            />
          </div>

          {/* Right: Analytics (40%) */}
          <div className="xl:col-span-2 flex flex-col gap-4">
            <AnalyticsPanel transactions={transactions} />
          </div>
        </div>
      </main>

      {/* Risk Inspector Drawer (slides in from right) */}
      {selectedTx && (
        <RiskInspectorDrawer
          tx={selectedTx}
          onClose={() => setSelectedTx(null)}
          updateTransaction={updateTransaction}
        />
      )}
    </div>
  );
}
