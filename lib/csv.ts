// Minimal but correct CSV parser (handles quoted fields, embedded commas,
// escaped double-quotes and CRLF). Returns an array of row objects keyed by the
// header columns. Used by the seed importer and the geography loader.

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // ignore; handled by \n
    } else {
      field += ch;
    }
  }
  // flush last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (cols.length === 1 && cols[0].trim() === "") continue; // blank line
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? "").trim();
    });
    out.push(obj);
  }
  return out;
}
