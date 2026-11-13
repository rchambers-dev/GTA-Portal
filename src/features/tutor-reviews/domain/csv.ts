export function inviteCsv(rows: { name: string; email: string; link: string }[]): string {
  const lines = ["name,email,link", ...rows.map((row) => [row.name, row.email, row.link].map(csvCell).join(","))];
  return lines.join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
