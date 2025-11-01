/**
 * Docext Service for document information extraction
 * Extracts structured data from documents (like Aadhaar cards) using docext API
 */

interface DocextField {
  name: string;
  type: "field" | "table";
  description: string;
}

interface ExtractedField {
  fields: string;
  answer: string;
  confidence: string;
}

interface DocextExtractionResult {
  fields: ExtractedField[];
  tables?: any[];
  success: boolean;
  error?: string;
}

/**
 * Extract Aadhaar card details from image
 * @param imageDataUrl - Base64 data URL of the Aadhaar card image
 * @returns Extracted Aadhaar data
 */
export const extractAadhaarDetails = async (
  imageDataUrl: string,
  onError?: (message: string) => void
): Promise<{
  name: string;
  dob: string;
  gender: string;
  mobile: string;
  address: string;
  aadhaarNumber?: string;
}> => {
  // Define Aadhaar card fields to extract
  const aadhaarFields: DocextField[] = [
    {
      name: "name",
      type: "field",
      description: "Full name of the cardholder as printed on Aadhaar card",
    },
    {
      name: "dob",
      type: "field",
      description: "Date of Birth in DD/MM/YYYY format as shown on Aadhaar card",
    },
    {
      name: "gender",
      type: "field",
      description: "Gender (Male/Female/Transgender) as shown on Aadhaar card",
    },
    {
      name: "mobile",
      type: "field",
      description: "Mobile number if visible on the Aadhaar card (optional, may not be present)",
    },
    {
      name: "address",
      type: "field",
      description: "Complete address as printed on the Aadhaar card including street, city, state, pin code",
    },
    {
      name: "aadhaar_number",
      type: "field",
      description: "12-digit Aadhaar number if visible (last 4 digits masked is acceptable)",
    },
  ];

  try {
    const result = await extractDocumentFields(imageDataUrl, aadhaarFields, onError);

    if (!result.success || !result.fields) {
      const errorMsg = result.error || "Failed to extract Aadhaar details";
      onError?.(errorMsg);
      throw new Error(errorMsg);
    }

    // Convert extracted fields to object
    const extractedData: any = {};
    result.fields.forEach((field) => {
      const fieldName = field.fields.toLowerCase().replace(/\s+/g, "_");
      extractedData[fieldName] = field.answer || "";
    });

    // Return structured data with defaults
    return {
      name: extractedData.name || extractedData["full_name"] || "",
      dob: extractedData.dob || extractedData["date_of_birth"] || "",
      gender: extractedData.gender || "",
      mobile: extractedData.mobile || extractedData["mobile_number"] || "",
      address: extractedData.address || "",
      aadhaarNumber: extractedData.aadhaar_number || extractedData["aadhaar_number"] || "",
    };
  } catch (error: any) {
    console.error("Aadhaar extraction error:", error);
    throw new Error(
      error.message || "Failed to extract Aadhaar details. Please ensure the image is clear and readable."
    );
  }
};

/**
 * Retry helper function with exponential backoff
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(2, attempt); // Exponential backoff
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

/**
 * Extract custom fields from document image
 * @param imageDataUrl - Base64 data URL of the document image
 * @param fields - Array of fields to extract
 * @param onError - Optional callback for error handling/toast notifications
 * @returns Extracted fields and tables
 */
export const extractDocumentFields = async (
  imageDataUrl: string,
  fields: DocextField[],
  onError?: (message: string) => void
): Promise<DocextExtractionResult> => {
  try {
    // Validate image
    if (!imageDataUrl || !imageDataUrl.startsWith("data:image")) {
      const error = "Invalid image format. Expected base64 data URL";
      onError?.(error);
      throw new Error(error);
    }

    // Use the correct endpoint
    const apiUrl = "http://localhost:5000/api/docext/extract";
    console.log("Calling docext API:", apiUrl);
    
    // Retry logic with exponential backoff
    const fetchWithRetry = () => retryWithBackoff(async () => {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageDataUrl,
          fields: fields,
          model_name: "hosted_vllm/Qwen/Qwen2.5-VL-7B-Instruct-AWQ", // Default model
        }),
        signal: AbortSignal.timeout(60000), // 60 second timeout for docext
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorJson.message || errorText;
        } catch {
          // Not JSON, use as-is
        }
        throw new Error(`HTTP ${response.status}: ${errorDetail}`);
      }

      return response;
    }, 2, 1000); // 2 retries, 1 second initial delay
    
    const response = await fetchWithRetry();
    const data = await response.json();

    return {
      fields: data.fields || [],
      tables: data.tables || [],
      success: true,
    };
  } catch (error: any) {
    console.error("Docext API extraction failed:", error);
    
    // Check if it's a network/connection error
    const isConnectionError = 
      error.name === "AbortError" || 
      error.name === "TypeError" || 
      error.message?.includes("fetch") || 
      error.message?.includes("Failed to fetch") ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("network") ||
      error.message?.includes("Connection refused");
    
    if (isConnectionError) {
      const errorMsg = "Document extraction failed. Please check backend.";
      onError?.(errorMsg);
      
      // Return simulation result instead of throwing
      return {
        ...simulateAadhaarExtraction(fields),
        error: errorMsg,
      };
    }
    
    // For HTTP errors or other issues
    const errorMsg = error.message?.includes("HTTP") 
      ? `Document extraction failed: ${error.message}` 
      : "Document extraction failed. Please check backend.";
    
    onError?.(errorMsg);
    
    // Return simulation as fallback
    return {
      ...simulateAadhaarExtraction(fields),
      error: errorMsg,
    };
  }
};

/**
 * Simulated Aadhaar extraction (fallback when API is not available)
 */
const simulateAadhaarExtraction = (fields: DocextField[]): DocextExtractionResult => {
  // Return empty fields - user will need to manually enter
  const extractedFields: ExtractedField[] = fields.map((field) => ({
    fields: field.name,
    answer: "",
    confidence: "Low",
  }));

  return {
    fields: extractedFields,
    tables: [],
    success: false,
    error: "Docext API not available. Please enter details manually or start the docext server.",
  };
};

