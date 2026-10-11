import re

def is_valid_barcode(barcode: str) -> bool:
    """
    Validates a barcode according to EAN-13, EAN-8, or UPC-A standards.
    Checks that it's composed only of digits, has the correct length, and 
    has a valid check digit. Keep barcodes as STRINGS everywhere (leading zeros matter).
    """
    if not isinstance(barcode, str):
        return False

    barcode = barcode.strip()

    if not re.fullmatch(r"\d{8}|\d{12}|\d{13}", barcode):
        return False

    # Check digit calculation
    # For EAN-13, UPC-A, and EAN-8:
    # Working right-to-left from the digit before the check digit,
    # alternating weights of 3 and 1.
    check_digit = int(barcode[-1])
    payload = barcode[:-1]
    
    total = 0
    weight = 3
    for digit in reversed(payload):
        total += int(digit) * weight
        weight = 1 if weight == 3 else 3
        
    calculated_check_digit = (10 - (total % 10)) % 10
    
    return check_digit == calculated_check_digit

def normalize_barcode(barcode: str) -> str:
    """
    Normalizes UPC-A (12 digits) to EAN-13 (13 digits) by prepending a leading zero,
    as required by Open Food Facts barcode normalization guidelines.
    Strips any surrounding whitespace.
    """
    code = barcode.strip()
    if len(code) == 12:
        return "0" + code
    return code
