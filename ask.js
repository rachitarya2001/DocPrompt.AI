const axios = require('axios');
const args = process.argv.slice(2);

// Parse command line arguments
let documentId = null;
let question = '';

// Check if user wants to search specific document
if (args[0] === '--doc' && args[1]) {
    documentId = args[1];
    question = args.slice(2).join(' ');
} else {
    question = args.join(' ');
}

if (!question) {

    process.exit(1);
}

console.log(` Question: ${question}`);
if (documentId) {
    console.log(`Searching document: ${documentId}`);
} else {
    console.log('Searching ALL uploaded documents...');
}


axios.post('http://localhost:5000/api/ask-question', {
    question: question,
    documentId: documentId  // null = search all, or specific doc ID
}).then(response => {
    console.log(` Answer: ${response.data.answer}`);
    console.log(`Response: ${response.data.response_time_ms}ms |  Cached: ${response.data.cached}`);

    // Show which documents provided the answer
    if (response.data.metadata && response.data.metadata.length > 0) {
        const sourceDocuments = [...new Set(response.data.metadata.map(m => m.document_id))];


        // Show relevance scores
        if (response.data.metadata.length > 1) {
            console.log(' Relevance scores:');
            response.data.metadata.forEach(m => {
                console.log(`   ${m.document_id}: ${(m.score * 100).toFixed(1)}% match`);
            });
        }
    }

    // Show if answer came from multiple sources
    if (response.data.sources && response.data.sources.length > 1) {
        console.log(` Combined information from ${response.data.sources.length} text chunks`);
    }

}).catch(error => {
    if (error.response && error.response.data) {
        console.log(' Error:', error.response.data.message || error.message);
    } else {
        console.log('Error:', error.message);
    }

    // Helpful suggestions
    if (error.message.includes('ECONNREFUSED')) {
        console.log('Make sure your server is running: npm run dev');
    }
});