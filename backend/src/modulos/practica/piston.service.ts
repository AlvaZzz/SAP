import { Injectable, Logger, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SANDBOX DE EJECUCIÓN — Piston (self-hosted en Docker).
 *
 * DECISIÓN DE SEGURIDAD: el código Python del estudiante NUNCA se ejecuta en el
 * proceso del backend. Se envía a un contenedor Piston aislado (engineer-man/
 * piston) que corre cada ejecución en una jaula con límites de tiempo y memoria
 * y sin acceso a la red. El backend solo orquesta y reenvía stdout/stderr.
 *
 * El runtime de Python se instala una sola vez (requiere red durante la
 * instalación); las ejecuciones posteriores ya quedan aisladas.
 */
@Injectable()
export class PistonService implements OnModuleInit {
  private readonly logger = new Logger(PistonService.name);
  private versionPython: string | null = null;
  private warmupPromise: Promise<string> | null = null;

  constructor(private readonly config: ConfigService) {}

  private get base(): string {
    return this.config.get<string>('PISTON_URL') ?? 'http://piston:2000';
  }

  /**
   * Warm-up: precarga el runtime de Python al arrancar (reintentando hasta que
   * Piston responda), para que la primera ejecución del estudiante sea rápida.
   * No bloquea el arranque del API.
   */
  onModuleInit() {
    void this.warmup();
  }

  private async warmup(): Promise<void> {
    for (let intento = 1; intento <= 20; intento++) {
      try {
        const version = await this.ensurePython();
        this.logger.log(`Sandbox Piston listo (Python ${version}).`);
        return;
      } catch {
        // Piston aún no está listo; reintenta con backoff.
        await new Promise((r) => setTimeout(r, Math.min(15_000, intento * 2_000)));
      }
    }
    this.logger.warn('No se pudo precargar Python en Piston tras varios intentos.');
  }

  /** Asegura que el runtime de Python esté instalado en Piston (idempotente). */
  private ensurePython(): Promise<string> {
    if (this.versionPython) return Promise.resolve(this.versionPython);
    // Comparte una sola promesa entre llamadas concurrentes.
    if (!this.warmupPromise) {
      this.warmupPromise = this.instalarPython().finally(() => { this.warmupPromise = null; });
    }
    return this.warmupPromise;
  }

  private async instalarPython(): Promise<string> {
    const runtimes = (await this.req('GET', '/api/v2/runtimes')) as Array<{ language: string; version: string }>;
    const py = runtimes.find((r) => r.language === 'python');
    if (py) return (this.versionPython = py.version);

    // No instalado: buscar el paquete disponible más reciente e instalarlo.
    const paquetes = (await this.req('GET', '/api/v2/packages')) as Array<{ language: string; language_version: string }>;
    const disponibles = paquetes
      .filter((p) => p.language === 'python')
      .sort((a, b) => b.language_version.localeCompare(a.language_version, undefined, { numeric: true }));
    const version = disponibles[0]?.language_version ?? '3.12.0';
    this.logger.log(`Instalando Python ${version} en Piston...`);
    await this.req('POST', '/api/v2/packages', { language: 'python', version });
    return (this.versionPython = version);
  }

  /** Ejecuta código Python en el sandbox y devuelve la salida. */
  async ejecutar(codigo: string, stdin = ''): Promise<{ stdout: string; stderr: string; code: number; ok: boolean }> {
    const version = await this.ensurePython();
    const r = (await this.req('POST', '/api/v2/execute', {
      language: 'python',
      version,
      files: [{ name: 'main.py', content: codigo }],
      stdin,
      run_timeout: 3000,      // 3s máx (límite configurado de Piston)
      compile_timeout: 3000,
      run_memory_limit: 128 * 1024 * 1024, // 128 MB
    })) as { run: { stdout: string; stderr: string; code: number; signal: string | null } };

    return {
      stdout: r.run.stdout ?? '',
      stderr: r.run.stderr ?? '',
      code: r.run.code ?? 0,
      ok: (r.run.code ?? 0) === 0 && !r.run.signal,
    };
  }

  private async req(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    try {
      const res = await fetch(`${this.base}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Piston ${res.status}: ${txt.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err) {
      this.logger.error(`Piston ${method} ${path}: ${err instanceof Error ? err.message : err}`);
      throw new HttpException('El entorno de ejecución no está disponible. Intenta más tarde.', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
