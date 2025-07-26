
class VectorService {

    // Store document in vector database via Python daemon
    async storeInVectorDB(filePath, extractedText, documentId, pythonProcess) {
        return new Promise((resolve, reject) => {
            if (!pythonProcess) {
                return reject(new Error('Python process not available'));
            }

            console.log(`Storing document in vector DB: ${documentId}`);
            const startTime = Date.now();

            pythonProcess('store', {
                file_path: filePath,
                text: extractedText,
                document_id: documentId
            }, (error, result) => {
                const processingTime = Date.now() - startTime;

                if (error) {
                    console.error(` Vector DB storage failed:`, error);
                    reject(error);
                } else {
                    console.log(`Vector DB storage completed in ${processingTime}ms`);
                    resolve({
                        ...result,
                        processing_time_ms: processingTime
                    });
                }
            });
        });
    }

    // Delete document from vector database
    async deleteFromVectorDB(documentId, pythonProcess) {
        return new Promise((resolve, reject) => {
            if (!pythonProcess) {
                return reject(new Error('Python process not available'));
            }

            console.log(`Deleting from vector DB: ${documentId}`);

            pythonProcess('delete', {
                document_id: documentId
            }, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }
}

module.exports = new VectorService();