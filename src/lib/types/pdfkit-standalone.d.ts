declare module 'pdfkit/js/pdfkit.standalone.js' {
  // อ้าง type จากแพ็กเกจหลัก
  import type PDFKit from 'pdfkit';
  // default export เป็น constructor/class แบบเดียวกับของ 'pdfkit'
  const PDFDocument: typeof PDFKit;
  export default PDFDocument;
}
