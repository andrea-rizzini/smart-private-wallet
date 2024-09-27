import fs from 'fs';

export function clearJsonFile(jsonFilePath: string) {
  
    try {
      // Check if file exists
      if (fs.existsSync(jsonFilePath)) {
        fs.writeFileSync(jsonFilePath, '', 'utf8');
      } else {
        console.log('File does not exists.');
      }
    } catch (error) {
      console.error('Error clearing file:', error);
    }
  }