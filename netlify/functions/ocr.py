"""
Netlify Function: Indian License Plate OCR
Platform: Python 3.11+
Dependencies: easyocr, opencv-python, pillow

Endpoint: POST /.netlify/functions/ocr
Input: multipart/form-data with image blob and optional region hint
Output: JSON {plate: string, confidence: number, raw: string, isValid: boolean}
"""

import json
import base64
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
import easyocr
import re

# Global reader instance (loaded once per container)
_reader = None

def get_ocr_reader():
    """Initialize EasyOCR reader for English + Indian languages."""
    global _reader
    if _reader is None:
        # English for plate format, Hindi for context (optional but helps)
        _reader = easyocr.Reader(['en'], gpu=False)
    return _reader

def preprocess_plate(image_array):
    """
    Preprocess cropped plate image for maximum OCR accuracy.
    - Convert to grayscale
    - Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    - Apply morphological operations for text enhancement
    - Denoise if needed
    """
    if len(image_array.shape) == 3:
        gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
    else:
        gray = image_array

    # CLAHE for adaptive histogram equalization (better for varied lighting)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Optional: denoise if image quality is poor
    # enhanced = cv2.fastNlMeansDenoising(enhanced, h=10)

    # Morphological operations to strengthen text
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    enhanced = cv2.morphologyEx(enhanced, cv2.MORPH_CLOSE, kernel)

    # Normalize contrast
    enhanced = cv2.normalize(enhanced, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)

    return enhanced

def extract_text_from_image(image_array, reader):
    """
    Run EasyOCR on preprocessed image.
    Returns extracted text with confidence scores.
    """
    try:
        # EasyOCR returns list of (bbox, text, confidence) tuples
        results = reader.readtext(image_array, detail=1)

        if not results:
            return "", 0

        # Sort by vertical position (top to bottom) to preserve line order
        results = sorted(results, key=lambda x: x[0][0][1])

        # Extract text and compute average confidence
        texts = [res[1] for res in results]
        confidences = [res[2] for res in results]

        combined_text = '\n'.join(texts) if len(texts) > 1 else texts[0] if texts else ""
        avg_confidence = int(np.mean(confidences) * 100) if confidences else 0

        return combined_text, avg_confidence
    except Exception as e:
        print(f"EasyOCR error: {e}")
        return "", 0

def normalize_indian_plate(raw_text):
    """
    Normalize OCR output to Indian plate format.
    Handles:
    - 1-line cars: KA01NC8564
    - 2-line bikes: KA 17 H / B 7120 -> KA17HB7120
    - EV plates (green): KA53MP7656
    - Commercial (yellow): KA05RV3421
    """
    if not raw_text:
        return "", False, 0

    # Clean: remove spaces, special chars, uppercase
    cleaned = re.sub(r'[^A-Z0-9\n]', '', raw_text.upper())

    # Handle two-line format (join lines)
    lines = cleaned.split('\n')
    if len(lines) >= 2:
        # Join without newline: KA17H + B7120 -> KA17HB7120
        cleaned = ''.join(lines)

    # Remove leading IND badge if present
    if cleaned.startswith('IND') and len(cleaned) > 9:
        cleaned = cleaned[3:]

    # Indian state codes
    INDIAN_STATES = [
        'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN', 'GA', 'GJ',
        'HP', 'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN', 'MP',
        'MZ', 'NL', 'OD', 'OR', 'PB', 'PY', 'RJ', 'SK', 'TN', 'TR', 'TS', 'UK',
        'UA', 'UP', 'WB', 'BH'
    ]

    # Find state code
    state = None
    for st in INDIAN_STATES:
        if st in cleaned:
            state = st
            idx = cleaned.index(st)
            cleaned = cleaned[idx:]  # Start from state code
            break

    if not state:
        return "", False, 50  # Confidence: no valid state found

    # Validate pattern: [2 State][1-2 District digits][1-3 Series letters][4 Vehicle digits]
    pattern1 = r'^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$'
    pattern2 = r'^([A-Z]{2})(\d{1})([A-Z]{1,3})(\d{4})$'

    match = re.match(pattern1, cleaned) or re.match(pattern2, cleaned)

    if match:
        return cleaned, True, 95  # Valid Indian plate
    elif len(cleaned) >= 8 and state:
        return cleaned, False, 75  # Likely valid but needs verification
    else:
        return cleaned, False, 50  # Low confidence

def handler(event, context):
    """
    Netlify Function handler for OCR processing.

    Request body: multipart/form-data
    - image: Blob (JPEG/PNG of cropped license plate)
    - region: str (optional, hint: 'lower_bumper', 'mudguard', 'center')

    Response: JSON
    - plate: Extracted plate number (e.g., "KA17HB7120")
    - confidence: Confidence score (0-100)
    - raw: Raw OCR text
    - isValid: Boolean if matches Indian plate pattern
    """
    try:
        # Parse multipart form data
        if 'isBase64Encoded' in event and event['isBase64Encoded']:
            body_bytes = base64.b64decode(event['body'])
        else:
            body_bytes = event['body'].encode('utf-8') if isinstance(event['body'], str) else event['body']

        # For Netlify Functions, multipart parsing requires manual handling
        # Split by boundary marker
        boundary_match = re.search(r'boundary=([^;\r\n]+)', event.get('headers', {}).get('content-type', ''))
        if not boundary_match:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid multipart form data'})
            }

        boundary = boundary_match.group(1)
        parts = body_bytes.split(f'--{boundary}'.encode())

        image_data = None
        region = 'center'

        # Extract image blob and region from parts
        for part in parts:
            if b'name="image"' in part:
                # Extract binary image data
                match = re.search(b'\r\n\r\n(.+?)\r\n--', part + b'\r\n--')
                if match:
                    image_data = match.group(1)
            elif b'name="region"' in part:
                # Extract region hint
                match = re.search(b'\r\n\r\n(.+?)\r\n--', part + b'\r\n--')
                if match:
                    region = match.group(1).decode('utf-8').strip()

        if not image_data:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No image provided'})
            }

        # Load image from bytes
        image = Image.open(BytesIO(image_data))
        image_array = np.array(image)

        # Convert RGB to BGR for OpenCV if needed
        if len(image_array.shape) == 3 and image_array.shape[2] == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)

        # Preprocess image
        processed = preprocess_plate(image_array)

        # Get OCR reader
        reader = get_ocr_reader()

        # Extract text
        raw_text, ocr_confidence = extract_text_from_image(processed, reader)

        # Normalize to Indian plate format
        plate, is_valid, norm_confidence = normalize_indian_plate(raw_text)

        # Blend OCR and normalization confidence
        final_confidence = max(ocr_confidence, norm_confidence)

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'plate': plate,
                'confidence': final_confidence,
                'raw': raw_text,
                'isValid': is_valid,
                'region': region,
                'debug': {
                    'ocrConfidence': ocr_confidence,
                    'normConfidence': norm_confidence,
                }
            })
        }

    except Exception as e:
        print(f"OCR handler error: {e}")
        import traceback
        traceback.print_exc()

        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': str(e),
                'plate': '',
                'confidence': 0,
                'raw': '',
                'isValid': False
            })
        }
