import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { OrigenGuard } from './common/auth/origen.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EjerciciosModule } from './ejercicios/ejercicios.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { IntroduccionModule } from './mediciones/introduccion/introduccion.module';
import { PretestModule } from './mediciones/pretest/pretest.module';
import { PostestModule } from './mediciones/postest/postest.module';
import { NotificacionesModule } from './modulos/notificaciones/notificaciones.module';
import { TutorIaModule } from './tutor-ia/tutor-ia.module';
import { PracticaModule } from './modulos/practica/practica.module';
import { GamificacionModule } from './gamificacion/gamificacion.module';
import { RankingModule } from './modulos/ranking/ranking.module';
import { ProgresoModule } from './modulos/progreso/progreso.module';
import { DocumentosModule } from './documentos/documentos.module';
import { RetosModule } from './modulos/retos/retos.module';
import { UnidadesModule } from './modulos/unidades/unidades.module';
import { ExamenUnidadModule } from './modulos/examen-unidad/examen-unidad.module';
import { DocenteDashboardModule } from './docente/docente-dashboard/docente-dashboard.module';
import { DocenteUnidadesModule } from './docente/docente-unidades/docente-unidades.module';
import { DocentePreguntasIaModule } from './docente/docente-preguntas-ia/docente-preguntas-ia.module';
import { DocenteEjerciciosModule } from './docente/docente-ejercicios/docente-ejercicios.module';
import { DocenteRetosModule } from './docente/docente-retos/docente-retos.module';
import { DocenteRevisionesModule } from './docente/docente-revisiones/docente-revisiones.module';
import { DocenteDocumentosModule } from './docente/docente-documentos/docente-documentos.module';
import { DocenteEstudiantesModule } from './docente/docente-estudiantes/docente-estudiantes.module';
import { DocenteReportesModule } from './docente/docente-reportes/docente-reportes.module';
import { DocentePostestModule } from './docente/docente-postest/docente-postest.module';
import { InvestigadorPanelModule } from './investigador/investigador-panel/investigador-panel.module';
import { InvestigadorExportacionModule } from './investigador/investigador-exportacion/investigador-exportacion.module';
import { InvestigadorAnalisisModule } from './investigador/investigador-analisis/investigador-analisis.module';
import { EncuestaModule } from './mediciones/encuesta/encuesta.module';
import { InstrumentosModule } from './mediciones/instrumentos/instrumentos.module';
import { AdminAuditoriaModule } from './admin/admin-auditoria/admin-auditoria.module';
import { AdminUsuariosModule } from './admin/admin-usuarios/admin-usuarios.module';
import { AdminConfigModule } from './admin/admin-config/admin-config.module';
import { AdminDashboardModule } from './admin/admin-dashboard/admin-dashboard.module';

/**
 * Módulo raíz. Cada dominio (Screaming Architecture) se importa aquí.
 * Rol estudiante: auth, pretest, ejercicios, practica, tutor-ia, documentos,
 * retos, ranking, progreso, gamificacion.
 * Rol docente (rutas /docente/*, protegidas por guard de rol): dashboard,
 * ejercicios, retos, documentos, estudiantes, reportes.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EjerciciosModule,
    FlashcardsModule,
    IntroduccionModule,
    PretestModule,
    PostestModule,
    NotificacionesModule,
    TutorIaModule,
    PracticaModule,
    GamificacionModule,
    RankingModule,
    ProgresoModule,
    DocumentosModule,
    RetosModule,
    UnidadesModule,
    ExamenUnidadModule,
    DocenteDashboardModule,
    DocenteUnidadesModule,
    DocentePreguntasIaModule,
    DocenteEjerciciosModule,
    DocenteRetosModule,
    DocenteRevisionesModule,
    DocenteDocumentosModule,
    DocenteEstudiantesModule,
    DocenteReportesModule,
    DocentePostestModule,
    InvestigadorPanelModule,
    InvestigadorExportacionModule,
    InvestigadorAnalisisModule,
    EncuestaModule,
    InstrumentosModule,
    AdminAuditoriaModule,
    AdminUsuariosModule,
    AdminConfigModule,
    AdminDashboardModule,
  ],
  controllers: [AppController],
  providers: [
    // CSRF: toda mutación debe venir de un origen propio (ver OrigenGuard).
    // Se registra GLOBAL para no depender de recordar decorarlo ruta por ruta.
    { provide: APP_GUARD, useClass: OrigenGuard },
  ],
})
export class AppModule {}
