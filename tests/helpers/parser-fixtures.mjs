// Synthetic documents containing only the text below; no user files are read.
export function makePdf(targetSize = 0) {
    const content = 'BT /F1 12 Tf 20 50 Td (A10 synthetic PDF text) Tj ET';
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ];
    let prefix = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, i) => { offsets.push(prefix.length); prefix += `${i + 1} 0 obj\n${object}\nendobj\n`; });
    const trailer = pos => `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
    let padding = 0;
    for (let i = 0; i < 4; i++) padding = Math.max(0, targetSize - prefix.length - trailer(prefix.length + padding).length);
    return Buffer.concat([Buffer.from(prefix), Buffer.alloc(padding, 32), Buffer.from(trailer(prefix.length + padding))]);
}

export function makeDoc() {
    const text = 'A10 synthetic DOC text\r';
    const header = Buffer.alloc(512);
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header);
    header.writeUInt16LE(0x3e, 24); header.writeUInt16LE(3, 26); header.writeUInt16LE(0xfffe, 28);
    header.writeUInt16LE(9, 30); header.writeUInt16LE(6, 32);
    header.writeInt32LE(1, 44); header.writeInt32LE(0, 48); header.writeInt32LE(4096, 56);
    header.writeInt32LE(-2, 60); header.writeInt32LE(-2, 68);
    for (let i = 0; i < 109; i++) header.writeInt32LE(i === 0 ? 17 : -1, 76 + i * 4);
    const directory = Buffer.alloc(512);
    function entry(index, name, type, sector, size, child = -1, right = -1) {
        const at = index * 128;
        directory.write(name + '\0', at, 'utf16le');
        directory.writeUInt16LE((name.length + 1) * 2, at + 64);
        directory[at + 66] = type; directory[at + 67] = 1;
        directory.writeInt32LE(-1, at + 68); directory.writeInt32LE(right, at + 72); directory.writeInt32LE(child, at + 76);
        directory.writeInt32LE(sector, at + 116); directory.writeUInt32LE(size, at + 120);
    }
    entry(0, 'Root Entry', 5, -2, 0, 1);
    entry(1, 'WordDocument', 2, 1, 4096, -1, 2);
    entry(2, '0Table', 2, 9, 4096);
    const word = Buffer.alloc(4096);
    word.writeUInt16LE(0xa5ec); word.writeUInt16LE(0xc1, 2);
    word.writeUInt32LE(1024, 0x18); word.writeUInt32LE(text.length, 0x4c);
    word.writeUInt32LE(21, 0x1a6); word.write(text, 1024, 'utf16le');
    const table = Buffer.alloc(4096);
    table[0] = 2; table.writeUInt32LE(16, 1); table.writeUInt32LE(text.length, 9); table.writeUInt32LE(1024, 15);
    const fat = Buffer.alloc(512, 0xff);
    fat.writeInt32LE(-2, 0);
    for (let i = 1; i <= 16; i++) fat.writeInt32LE(i === 8 || i === 16 ? -2 : i + 1, i * 4);
    fat.writeInt32LE(-3, 17 * 4);
    return Buffer.concat([header, directory, word, table, fat]);
}
