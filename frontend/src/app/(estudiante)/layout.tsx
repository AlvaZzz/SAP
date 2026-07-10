import { Shell } from '@/components/shell';
import { LogrosProvider } from '@/components/logro-toast';

export default function EstudianteLayout({ children }: { children: React.ReactNode }) {
  return (
    <LogrosProvider>
      <Shell>{children}</Shell>
    </LogrosProvider>
  );
}
