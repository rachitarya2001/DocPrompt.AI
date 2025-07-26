// services/documentService.js
const { spawn } = require('child_process');
const path = require('path');



class DocumentService {

    // Extract text from uploaded file using OCR
    async extractTextFromFile(filePath) {
        return new Promise((resolve, reject) => {
            console.log(`Starting OCR for: ${filePath}`);

            const ocrProcess = spawn('python', [
                path.join(__dirname, '../../python-services/ocr_service.py'),
                filePath
            ]);

            let ocrOutput = '';
            let ocrError = '';

            ocrProcess.stdout.on('data', (data) => {
                ocrOutput += data.toString();
            });

            ocrProcess.stderr.on('data', (data) => {
                ocrError += data.toString();
            });

            ocrProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(ocrOutput);
                        if (result.success) {
                            console.log(`OCR completed: ${result.text_length} characters extracted`);
                            resolve(result.text);
                        } else {
                            reject(new Error(result.error || 'OCR failed'));
                        }
                    } catch (parseError) {
                        reject(new Error('Invalid OCR response: ' + parseError.message));
                    }
                } else {
                    reject(new Error(`OCR process failed: ${ocrError}`));
                }
            });
        });
    }

    // Generate unique document ID
    generateDocumentId(originalFilename) {
        const timestamp = Date.now();
        const cleanName = originalFilename.replace(/[^a-zA-Z0-9.]/g, '_');
        return `${timestamp}-${cleanName}`;
    }

    // Validate file type and size
    validateFile(file) {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg', 'image/jpg', 'image/png',
            'image/bmp', 'image/tiff'
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            throw new Error(`Invalid file type: ${file.mimetype}`);
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            throw new Error('File too large. Maximum size is 10MB');
        }

        return true;
    }
}

module.exports = new DocumentService();