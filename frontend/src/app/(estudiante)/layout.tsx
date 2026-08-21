import { Shell } from '@/components/shell';
import { LogrosProvider } from '@/components/logro-toast';
import { AnimoProvider } from '@/components/animo-tutor';

export default function EstudianteLayout({ children }: { children: React.ReactNode }) {
  // AnimoProvider va DENTRO de LogrosProvider: la tarjeta de ánimo consulta si
  // hay un logro visible para colocarse debajo y no taparlo.
  return (
    <LogrosProvider>
      <AnimoProvider>
        <Shell>{children}</Shell>
      </AnimoProvider>
    </LogrosProvider>
  );
}
