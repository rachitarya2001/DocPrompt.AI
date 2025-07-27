# DocuPrompt - AI-Powered Document Analysis Platform

DocuPrompt is a web application that allows users to upload documents and chat with AI about their content. Upload PDFs and images, then ask questions to get intelligent responses about your documents.

## 🚀 Features

- **Document Upload**: Support for PDF and image files (JPG, PNG, BMP, TIFF)
- **AI Chat**: Ask questions about your uploaded documents
- **User Authentication**: Secure login and registration system
- **Analytics Dashboard**: View your usage statistics
- **Subscription Plans**: Free tier (10 messages) and Pro tier (unlimited messages)

## 🏗️ Architecture

### **Frontend (React/TypeScript)**
```
src/
├── components/
│   ├── Auth/           # Authentication components
│   ├── Dashboard/      # Main application interface
│   │   ├── Analytics/  # Usage analytics and statistics
│   │   ├── ChatPanel/  # AI chat interface
│   │   ├── Sidebar/    # Document navigation
│   │   └── Settings/   # User profile management
│   └── ThreeBackground/ # 3D visual effects
├── contexts/           # React contexts (Auth, etc.)
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
└── config/             # Configuration files
```

### **Backend (Node.js/Express)**
```
backend/
├── controllers/        # Route handlers
│   ├── authController.js
│   ├── documentController.js
│   ├── chatController.js
│   └── analyticsController.js
├── models/            # MongoDB schemas
│   ├── User.js
│   ├── Document.js
│   └── Chat.js
├── services/          # Business logic
│   ├── vectorService.js
│   └── documentService.js
└── middleware/        # Authentication & validation
```

### **AI/ML Components**
- **Vector Database**: Pinecone for document embeddings
- **AI Models**: Google Generative AI (Gemini) for intelligent responses
- **Text Processing**: Python service for document processing

## 🛠️ Tech Stack

### **Frontend Technologies**
- **React 18** with TypeScript for type-safe development
- **React Router** for navigation
- **Recharts** for analytics charts
- **Three.js** for 3D effects

### **Backend Technologies**
- **Express 5** for server
- **MongoDB** with Mongoose
- **JWT** for authentication
- **Multer** for file uploads
- **Stripe** for payments

### **AI/ML Stack**
- **Pinecone Vector Database** for document search
- **Google Generative AI (Gemini)** for AI responses
- **Python with sentence-transformers** for text processing

## 🚦 Getting Started

### **Prerequisites**
- Node.js (v16+)
- Python (v3.8+)
- MongoDB
- Pinecone account
- Google AI API key
- Stripe account

### **Environment Variables**

Create `.env` files in both frontend and backend directories:

**Backend `.env`:**
```env
# Database
MONGODB_URI=mongodb://localhost:27017/docuprompt

# JWT
JWT_SECRET=your_jwt_secret_key

# AI Services
GOOGLE_AI_API_KEY=your_google_ai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=your_pinecone_index

# Payment
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Server
PORT=5000
```

**Frontend `.env`:**
```env
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_STRIPE_PUBLIC_KEY=your_stripe_publishable_key
```

### **Installation**

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/docuprompt.git
cd docuprompt
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Install frontend dependencies**
```bash
cd ../frontend
npm install
```

4. **Install Python dependencies**
```bash
cd ../python-services
pip install -r requirements.txt
```

5. **Set up the database**
```bash
# Start MongoDB service
mongod

# The application will create necessary collections automatically
```

6. **Set up Pinecone**
- Create a Pinecone account and index
- Update environment variables

### **Testing Stripe Payments**

For testing the Pro subscription, use these demo credentials:
- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: Any future date (e.g., `12/25`)
- **CVC**: `123`
- **ZIP**: Any 5-digit code

### **Running the Application**

1. **Start the backend server**
```bash
cd backend
npm run dev
```

2. **Start the Python AI service**
```bash
cd python-services
python pinecone_daemon.py
```

3. **Start the frontend development server**
```bash
cd frontend
npm start
```

4. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📊 Database Schema

### **User Model**
```javascript
{
  username: String,
  email: String,
  password: String (hashed),
  messagesUsed: Number,
  messagesTotalLimit: Number,
  plan: String (free/pro),
  stripeCustomerId: String
}
```

### **Document Model**
```javascript
{
  userId: ObjectId,
  documentId: String,
  name: String,
  filePath: String,
  size: Number,
  extractedText: String,
  textLength: Number,
  chunksStored: Number,
  processingTime: Number
}
```

### **Chat Model**
```javascript
{
  userId: ObjectId,
  documentId: String,
  messages: [{
    type: String (user/assistant),
    content: String,
    timestamp: Date
  }]
}
```

## 🔧 Main API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/upload` - Upload document
- `POST /api/ask-question` - Ask AI about documents
- `GET /api/analytics` - Get usage statistics

## 🎨 Design System

The application uses a modern design system with:
- **Dark Theme**: Primary dark background with glassmorphism effects
- **Color Palette**: Purple gradient accents (#6366f1 to #8b5cf6)
- **Typography**: Clean, readable fonts with proper hierarchy
- **Components**: Reusable UI components with consistent styling
- **Responsive Design**: Mobile-first approach with responsive layouts

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication system
- **Password Hashing**: bcrypt for secure password storage
- **Input Validation**: Comprehensive validation for all user inputs
- **File Type Validation**: Restricted file types and size limits
- **CORS Protection**: Properly configured cross-origin policies
- **Rate Limiting**: API rate limiting to prevent abuse

## 🚀 Deployment

1. **Build frontend**: `npm run build`
2. **Set production environment variables**

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


## 🙏 Acknowledgments

- **Google** for Generative AI services
- **Pinecone** for vector database
- **Stripe** for payment processing