
import sys
import json
import os
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from typing import List
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

class PineconeDaemon:
    def __init__(self):
        """Initialize once and keep running"""
        try:
            # Initialize Pinecone
            self.pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
            self.index = self.pc.Index(os.getenv('PINECONE_INDEX_NAME'))
            
            # Initialize embedding model ONCE
            self.embedding_model = SentenceTransformer('paraphrase-MiniLM-L3-v2')
            
            # Configure Gemini ONCE
            genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
            self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')

          # temporary
            self.openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY')) 
            
            print(json.dumps({"status": "ready"}), flush=True)
            
        except Exception as e:
            print(json.dumps({"status": "error", "message": str(e)}), flush=True)
    
    def chunk_text(self, text: str, chunk_size: int = 300, overlap: int = 50) -> List[str]:
        """Split text into overlapping chunks"""
        words = text.split()
        chunks = []
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk = ' '.join(words[i:i + chunk_size])
            if chunk.strip():
                chunks.append(chunk.strip())
        
        return chunks
    
    def pad_embedding(self, embedding: List[float], target_dim: int = 384) -> List[float]:
        """Pad or truncate embedding to match Pinecone index dimensions"""
        if len(embedding) == target_dim:
            return embedding
        elif len(embedding) < target_dim:
            return embedding + [0.0] * (target_dim - len(embedding))
        else:
            return embedding[:target_dim]
    
    def store_document(self, file_path: str, text: str, document_id: str):
        """Store document text in Pinecone"""
        try:
            chunks = self.chunk_text(text)
            embeddings = self.embedding_model.encode(chunks).tolist()
            
            vectors = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                padded_embedding = self.pad_embedding(embedding, 384)

                chunk_id = f"{document_id}_chunk_{i}"
                
                metadata = {
                    "document_id": document_id,
                    "file_path": file_path,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "text": chunk
                }
                
                vectors.append({
                    "id": chunk_id,
                    "values": padded_embedding,
                    "metadata": metadata
                })
            
            self.index.upsert(vectors=vectors)
            
            return {
                "success": True,
                "document_id": document_id,
                "chunks_stored": len(chunks),
                "embeddings_created": len(embeddings)
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def query_document(self, question: str, document_id: str = None, top_k: int = 3, conversation_history: list = None):
        """Query Pinecone and get AI response"""
        try:
            question_embedding = self.embedding_model.encode([question]).tolist()[0]
            padded_question_embedding = self.pad_embedding(question_embedding, 384)
            
            if document_id:
                results = self.index.query(
                    vector=padded_question_embedding,
                    top_k=top_k,
                    filter={"document_id": document_id},
                    include_metadata=True
                )
            else:
                results = self.index.query(
                    vector=padded_question_embedding,
                    top_k=top_k,
                    include_metadata=True
                )
            
            relevant_chunks = []
            metadata_list = []
            
            for match in results['matches']:
                if match['metadata']:
                    relevant_chunks.append(match['metadata']['text'])
                    metadata_list.append({
                        "document_id": match['metadata'].get('document_id'),
                        "chunk_index": match['metadata'].get('chunk_index'),
                        "score": match['score']
                    })
            
            if not relevant_chunks:
                return {
                    "success": True,
                    "answer": "I couldn't find relevant information to answer your question.",
                    "sources": []
                }
            
            context = "\n\n".join(relevant_chunks)
            # ✅ ADD DEBUG: Print what context is being sent

            conversation_context = ""
            if conversation_history:
                recent_messages = conversation_history[-4:]  # Last 4 messages
                for msg in recent_messages:
                    role = "User" if msg.get('type') == 'user' else "Assistant"
                    content = msg.get('content', '')[:150]  # Limit to 150 chars
                    conversation_context += f"{role}: {content}\n"
            
            prompt = f"""Based on the document content and recent conversation, answer the question accurately and concisely.

Guidelines:
- Answer questions using ONLY the information found in the provided document content
- Use a natural, conversational tone  
- Keep responses clear and concise
- If information isn't in the document, say "I don't see that information in this document"
- Handle follow-up questions by maintaining conversation context
- Don't make assumptions about what type of document this is

Response formatting:
- When asked for a summary, provide a clear overview of the document's main content and purpose
- When asked for lists of items (skills, technologies, requirements, ingredients, steps, etc.), format as clean bullet points
- When asked for specific details, provide descriptive answers with relevant quotes when helpful
- When asked about topics not covered, be honest about their absence
- Maintain context from previous questions in the conversation

Examples of different response types:
- Summary requests: "Can you summarize this?" → Provide overview
- List requests: "What technologies/skills/tools are mentioned?" → Use bullet points  
- Detail requests: "Tell me about..." → Provide descriptive paragraphs
- Clarification: "I don't see information about that topic in this document"
- When users ask for multiple items (using words like "all", "list", "what are", "give me"), ALWAYS format as bullet points
- Use • symbol for clean bullet points
- Put each item on a separate line


Recent conversation:
{conversation_context}

Document Content:
{context}

Current Question: {question}



Question: {question}

Answer:"""
            
            # response = self.gemini_model.generate_content(prompt)
            
            # return {
            #     "success": True,
            #     "answer": response.text,
            #     "sources": relevant_chunks,
            #     "metadata": metadata_list
            # }


            # ✅ Use OpenAI instead of Gemini temporary
            response = self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
            {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.7
            )

            return {

                "success": True,
                "answer": response.choices[0].message.content,
                "sources": relevant_chunks,
                "metadata": metadata_list
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def delete_document(self, document_id: str):

        """Delete all vectors for a specific document from Pinecone"""
        try:

            # Delete all vectors with this document_id from the index
            delete_response = self.index.delete(
                filter={"document_id": document_id}
            )
                        
            return {
                "success": True,
                "document_id": document_id,
                "message": f"Document {document_id} deleted from vector database"
            }
            
        except Exception as e:

            return {
                "success": False, 
                "error": str(e),
                "document_id": document_id
            }
    def clear_all_documents(self):

        """Clear all documents from Pinecone index"""
        try:
            # Delete all vectors in the index
            self.index.delete(delete_all=True)
            
            return {
            "success": True,
            "message": "All documents cleared from Pinecone index"
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }    
        
    def run(self):
        """Main daemon loop"""
        try:
            while True:
                line = sys.stdin.readline()
                if not line:
                    break
                
                try:
                    request = json.loads(line.strip())
                    command = request.get('command')
                    request_id = request.get('requestId')
                    
                    if command == 'store':
                        result = self.store_document(
                            request['file_path'],
                            request['text'],
                            request['document_id']
                        )
                    elif command == 'query':
                        result = self.query_document(
                            request['question'],
                            request.get('document_id'),
                            request.get('top_k', 8),
                            request.get('conversation_history')
                        )
                    elif command == 'delete':
                        result = self.delete_document(
                            request['document_id']
                        )
                    elif command == 'clear_all':
                        result = self.clear_all_documents()    
                    else:
                        result = {"success": False, "error": f"Unknown command: {command}"}
                    
                    if request_id:
                        result['requestId'] = request_id

                    
                    print(json.dumps(result), flush=True)
                    
                    
                except Exception as e:
                    error_result = {"success": False, "error": str(e)}
                    if 'request_id' in locals():
                        error_result['requestId'] = request_id
                    print(json.dumps(error_result), flush=True)
                    
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    daemon = PineconeDaemon()
    daemon.run()