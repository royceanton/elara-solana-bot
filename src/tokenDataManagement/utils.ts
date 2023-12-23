// utils.ts
import fs from 'fs';
import path from 'path';

export function saveToFile(filePath: string, data: any) {
    const dir = path.dirname(filePath);
    fs.promises.mkdir(dir, { recursive: true })
        .then(() => fs.promises.writeFile(filePath, JSON.stringify(data, null, 2)));
}