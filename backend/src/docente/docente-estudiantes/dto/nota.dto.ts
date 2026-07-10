import { IsString, MaxLength } from 'class-validator';

/** Observación del docente sobre un estudiante (se guarda por par docente-estudiante). */
export class NotaDto {
  @IsString() @MaxLength(2000)
  texto!: string;
}
