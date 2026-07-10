import { Shell } from '@/components/shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Shell area="admin">{children}</Shell>;
}
