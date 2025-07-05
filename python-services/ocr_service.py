import sys
import json
import pytesseract
from PIL import Image
from pdf2image import convert_from_path
import os

def extract_text_from_image(image_path):
    """Extract text from a single image file"""
    try:
        # Open image and extract text
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image)
        return text.strip()
    except Exception as e:
        return f"Error processing image: {str(e)}"

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF by converting to images first"""
    try:
        # Convert PDF pages to images
        pages = convert_from_path(pdf_path)
        
        all_text = []
        for i, page in enumerate(pages):
            # Extract text from each page
            text = pytesseract.image_to_string(page)
            if text.strip():  # Only add non-empty text
                all_text.append(f"--- Page {i+1} ---\n{text.strip()}")
        
        return "\n\n".join(all_text)
    except Exception as e:
        return f"Error processing PDF: {str(e)}"

def main():
    """Main function - processes file and returns JSON result"""
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python ocr_service.py <file_path>"}))
        return
    
    file_path = sys.argv[1]
    
    # Check if file exists
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}))
        return
    
    # Get file extension
    file_ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if file_ext == '.pdf':
            # Process PDF
            extracted_text = extract_text_from_pdf(file_path)
        elif file_ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']:
            # Process image
            extracted_text = extract_text_from_image(file_path)
        else:
            print(json.dumps({"error": f"Unsupported file type: {file_ext}"}))
            return
        
        # Return success result
        result = {
            "success": True,
            "file_path": file_path,
            "file_type": file_ext,
            "text": extracted_text,
            "text_length": len(extracted_text)
        }
        print(json.dumps(result))
        
    except Exception as e:
        # Return error result
        error_result = {
            "success": False,
            "error": str(e),
            "file_path": file_path
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()