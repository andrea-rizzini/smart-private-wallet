import fs from 'fs';

export function deleteDir(dirPath: string) {

    if (fs.existsSync(dirPath)) {
        try {
            fs.rmSync(dirPath, { recursive: true, force: true });
        } catch (err) {
            console.error(`Error during deletion of directory "${dirPath}":`, err);
        }
    } else {
        console.log(`Directory "${dirPath}" does not exist.`);
    }

}