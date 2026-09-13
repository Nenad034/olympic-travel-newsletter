/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Biblioteke za čitanje priloženih dokumenata (src/lib/extract-file.ts) ne smeju u bundle:
  // pdf-parse svog radnika (`pdf.worker.mjs`) traži relativno u odnosu na sopstveni fajl, pa
  // spakovan u chunk ne nalazi ništa. Ovde se učitavaju iz node_modules u vreme izvršavanja.
  serverExternalPackages: ['pdf-parse', 'mammoth', 'exceljs'],
};

export default nextConfig;
