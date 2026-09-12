import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { extractText, UnsupportedFileError } from '@/lib/extract-file';

// Izvučen tekst ulazi u prompt kao PODATAK. Testovi proveravaju da se iz svakog podržanog
// formata izvuče ono što nosi značenje i da nepodržan format padne jasnom porukom, umesto da
// tiho ubaci smeće (npr. `[object Object]` iz Excel ćelija) u razgovor.

describe('extractText', () => {
  it('čita običan tekst i CSV kakvi jesu', async () => {
    await expect(extractText(Buffer.from('prva,druga\n1,2'), 'lista.csv')).resolves.toBe(
      'prva,druga\n1,2',
    );
    await expect(extractText(Buffer.from('beleška'), 'nota.txt')).resolves.toBe('beleška');
  });

  it('iz HTML-a skida tagove, briše script/style i dekodira entitete', async () => {
    const html =
      '<html><head><style>p{color:red}</style></head><body><h1>Naslov</h1>' +
      '<p>Cena &lt; 500 &amp; popust</p><script>var x=1</script></body></html>';

    const text = await extractText(Buffer.from(html), 'ponuda.html');

    expect(text).toBe('Naslov Cena < 500 & popust');
    expect(text).not.toContain('color:red');
    expect(text).not.toContain('var x');
  });

  it('iz Excel-a vadi richText naziv i izračunatu vrednost formule, ne [object Object]', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Cenovnik');
    ws.addRow(['Hotel', 'Cena']);
    ws.addRow([{ richText: [{ text: 'Argisht ' }, { text: 'Palace 3+*' }] }, 549]);
    ws.getCell('A3').value = 'Ukupno';
    ws.getCell('B3').value = { formula: 'B2*2', result: 1098 };
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const text = await extractText(buffer, 'cenovnik.xlsx');

    expect(text).toContain('# Cenovnik');
    expect(text).toContain('Argisht Palace 3+* | 549');
    expect(text).toContain('Ukupno | 1098');
    expect(text).not.toContain('[object Object]');
  });

  it('stari Office format upućuje na novi umesto da samo padne', async () => {
    await expect(extractText(Buffer.from(''), 'cenovnik.xls')).rejects.toThrow(/sačuvaj fajl kao/i);
  });

  it('nepodržan tip odbija imenovanom greškom', async () => {
    await expect(extractText(Buffer.from(''), 'program.exe')).rejects.toBeInstanceOf(
      UnsupportedFileError,
    );
  });
});
