import { PDFParse } from 'pdf-parse';

// Límite de texto que se conserva por PDF: evita prompts gigantes a Gemini y
// filas de BD desproporcionadas. Suficiente para varias páginas de contenido.
const MAX_TEXTO = 20_000;

/**
 * Extrae el texto plano de un PDF (best-effort). Nunca lanza: si el PDF no
 * tiene texto extraíble (escaneado como imagen) devuelve cadena vacía, y quien
 * llama decide qué hacer (p. ej. rechazar la generación de preguntas).
 */
export async function extraerTextoPdf(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer });
    const resultado = await parser.getText();
    await parser.destroy();
    return (resultado.text ?? '').trim().slice(0, MAX_TEXTO);
  } catch {
    return '';
  }
}
