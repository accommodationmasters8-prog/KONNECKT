import { inflateRawSync } from 'node:zlib';

/**
 * Read an Excel workbook, without a spreadsheet library.
 *
 * An .xlsx is a ZIP of XML files. Everything needed to pull a sheet out of one
 * is in Node already: the archive is a well-documented format and `zlib` does
 * the only hard part. That is the whole reason this exists rather than an
 * `import` of `xlsx` — the npm package has a prototype-pollution history, and
 * the file being parsed is uploaded by a user.
 *
 * It reads values and nothing else. No formulas, no formatting, no macros, no
 * external references — a cell that holds a formula yields the last computed
 * value Excel stored beside it, which is what a person reading the sheet sees.
 * Anything it cannot understand is skipped rather than guessed at.
 */

interface ZipEntry {
  name: string;
  compression: number;
  data: Buffer;
}

/**
 * The entries of a ZIP archive.
 *
 * Read from the end: the central directory is authoritative about what is in
 * the file and where, and walking local headers forwards instead is what makes
 * a reader trip over data descriptors and streamed entries.
 */
function readZip(buffer: Buffer): Map<string, ZipEntry> {
  const out = new Map<string, ZipEntry>();

  // The end-of-central-directory record, found by scanning back for its
  // signature. It sits within 64KB of the end even with a comment.
  let eocd = -1;
  const from = Math.max(0, buffer.length - 66_000);
  for (let i = buffer.length - 22; i >= from; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x0605_4b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a readable workbook: no ZIP directory.');

  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n += 1) {
    if (buffer.readUInt32LE(p) !== 0x0201_4b50) break;

    const compression = buffer.readUInt16LE(p + 10);
    const compressedSize = buffer.readUInt32LE(p + 20);
    const nameLength = buffer.readUInt16LE(p + 28);
    const extraLength = buffer.readUInt16LE(p + 30);
    const commentLength = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLength);

    // The local header repeats the name and extra fields, and its own lengths
    // are the ones that count — the central copy can differ.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;

    out.set(name, {
      name,
      compression,
      data: buffer.subarray(start, start + compressedSize),
    });

    p += 46 + nameLength + extraLength + commentLength;
  }

  return out;
}

function readEntry(zip: Map<string, ZipEntry>, name: string): string | null {
  const entry = zip.get(name);
  if (!entry) return null;
  // 0 is stored, 8 is deflate. Excel writes one or the other and nothing else.
  if (entry.compression === 0) return entry.data.toString('utf8');
  if (entry.compression === 8) return inflateRawSync(entry.data).toString('utf8');
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
};

function unescapeXml(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    }
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return ENTITIES[code] ?? whole;
  });
}

/**
 * The shared string table.
 *
 * Excel stores every repeated piece of text once and refers to it by index, so
 * a sheet of names is mostly numbers until this is read. A string split across
 * runs — one word bolded — arrives as several <t> elements inside one <si> and
 * has to be joined back together.
 */
function readSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const out: string[] = [];
  const items = xml.match(/<si\b[^>]*>[\s\S]*?<\/si>|<si\b[^>]*\/>/g) ?? [];

  for (const item of items) {
    const parts = item.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? [];
    out.push(
      parts
        .map((t) => unescapeXml(t.replace(/<t\b[^>]*>/, '').replace(/<\/t>$/, '')))
        .join(''),
    );
  }

  return out;
}

/** "BC7" -> 54. Column letters are base-26 with no zero. */
function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * The first worksheet of a workbook, as rows of text.
 *
 * Sheet order comes from the workbook relationships rather than from the file
 * names, because `sheet1.xml` is not reliably the first tab — a workbook whose
 * tabs have been reordered or deleted keeps the original numbering.
 */
export function readXlsx(buffer: Buffer): string[][] {
  const zip = readZip(buffer);

  const workbook = readEntry(zip, 'xl/workbook.xml');
  const rels = readEntry(zip, 'xl/_rels/workbook.xml.rels');

  let sheetPath = 'xl/worksheets/sheet1.xml';

  if (workbook && rels) {
    const firstId = workbook.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
    if (firstId) {
      const target = rels
        .match(new RegExp(`<Relationship\\b[^>]*Id="${firstId}"[^>]*>`))?.[0]
        ?.match(/Target="([^"]+)"/)?.[1];
      if (target) {
        const cleaned = target.replace(/^\/?xl\//, '').replace(/^\.\//, '');
        sheetPath = `xl/${cleaned}`;
      }
    }
  }

  const sheet = readEntry(zip, sheetPath) ?? readEntry(zip, 'xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('That workbook has no readable sheet.');

  const shared = readSharedStrings(readEntry(zip, 'xl/sharedStrings.xml'));
  const rows: string[][] = [];

  for (const rowXml of sheet.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const cells: string[] = [];

    for (const cellXml of rowXml.match(/<c\b[^>]*>[\s\S]*?<\/c>|<c\b[^>]*\/>/g) ?? []) {
      const ref = cellXml.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = cellXml.match(/\bt="([^"]+)"/)?.[1] ?? 'n';

      let value = '';
      if (type === 'inlineStr') {
        const parts = cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? [];
        value = parts
          .map((t) => unescapeXml(t.replace(/<t\b[^>]*>/, '').replace(/<\/t>$/, '')))
          .join('');
      } else {
        const raw = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? '';
        if (type === 's') {
          value = shared[Number(raw)] ?? '';
        } else if (type === 'b') {
          value = raw === '1' ? 'TRUE' : 'FALSE';
        } else {
          value = unescapeXml(raw);
        }
      }

      // Blank cells are omitted from the XML entirely, so a row's cells have
      // to be placed by their reference or every column after a gap shifts.
      const at = ref ? columnIndex(ref) : cells.length;
      while (cells.length < at) cells.push('');
      cells[at] = value.trim();
    }

    rows.push(cells);
  }

  return rows.filter((r) => r.some((v) => v !== ''));
}
