import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { FilaReporteEstudiante } from './reportService';

/** Genera un buffer .xlsx con el reporte de estudiantes. */
export async function estudiantesAExcel(filas: FilaReporteEstudiante[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PREXI UPEA';
  const ws = wb.addWorksheet('Estudiantes');

  ws.columns = [
    { header: 'Estudiante', key: 'nombre', width: 28 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'XP Total', key: 'xp_total', width: 12 },
    { header: 'Racha (días)', key: 'racha_dias', width: 14 },
    { header: 'Posición', key: 'posicion', width: 10 },
    { header: 'Ejerc. completados', key: 'ejercicios_completados', width: 18 },
    { header: 'Intentos', key: 'intentos_totales', width: 12 },
    { header: 'Precisión %', key: 'precision_pct', width: 12 },
  ];

  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };

  filas.forEach((f) => ws.addRow(f));

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** Genera un buffer PDF con el reporte de estudiantes. */
export function estudiantesAPdf(filas: FilaReporteEstudiante[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Encabezado
    doc.fillColor('#1e3a5f').fontSize(20).text('PREXI UPEA', { continued: false });
    doc.fillColor('#2563eb').fontSize(12).text('Reporte de Desempeño — Estudiantes');
    doc.moveDown(0.3);
    doc.fillColor('#666').fontSize(9).text(`Generado: ${new Date().toLocaleString('es-BO')}`);
    doc.moveDown();

    // Tabla simple
    const cols = [
      { label: 'Estudiante', w: 150 },
      { label: 'XP', w: 50 },
      { label: 'Racha', w: 50 },
      { label: 'Pos', w: 40 },
      { label: 'Compl.', w: 55 },
      { label: 'Precisión', w: 70 },
    ];
    let x = doc.x;
    const startX = x;
    doc.fontSize(9).fillColor('#fff');
    const headerY = doc.y;
    doc.rect(startX, headerY, cols.reduce((a, c) => a + c.w, 0), 18).fill('#1e3a5f');
    doc.fillColor('#fff');
    x = startX;
    cols.forEach((c) => { doc.text(c.label, x + 4, headerY + 5, { width: c.w - 6 }); x += c.w; });
    doc.moveDown();

    let y = headerY + 20;
    doc.fillColor('#111');
    filas.forEach((f, i) => {
      if (y > 760) { doc.addPage(); y = 50; }
      if (i % 2 === 0) {
        doc.rect(startX, y - 2, cols.reduce((a, c) => a + c.w, 0), 16).fill('#f1f5f9');
        doc.fillColor('#111');
      }
      const vals = [
        f.nombre,
        String(f.xp_total),
        String(f.racha_dias),
        f.posicion != null ? `#${f.posicion}` : '-',
        String(f.ejercicios_completados),
        f.precision_pct != null ? `${f.precision_pct}%` : '-',
      ];
      x = startX;
      vals.forEach((v, j) => { doc.fillColor('#111').text(v, x + 4, y + 2, { width: cols[j].w - 6 }); x += cols[j].w; });
      y += 16;
    });

    doc.end();
  });
}
