import Shell from '@/components/Shell';
import SidebarSummary from '@/components/SidebarSummary';
import { CURRENT_USER } from '@/lib/campaigns';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell fullName={CURRENT_USER} roleLabel="Marketing tim" sidebarSummary={<SidebarSummary />}>
      {children}
    </Shell>
  );
}
