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
  imageDataUrl: string
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
    const result = await extractDocumentFields(imageDataUrl, aadhaarFields);

    if (!result.success || !result.fields) {
      throw new Error(result.error || "Failed to extract Aadhaar details");
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
 * Extract custom fields from document image
 * @param imageDataUrl - Base64 data URL of the document image
 * @param fields - Array of fields to extract
 * @returns Extracted fields and tables
 */
export const extractDocumentFields = async (
  imageDataUrl: string,
  fields: DocextField[]
): Promise<DocextExtractionResult> => {
  try {
    // Validate image
    if (!imageDataUrl || !imageDataUrl.startsWith("data:image")) {
      throw new Error("Invalid image format. Expected base64 data URL");
    }

    // Call docext API via Gradio client
    const response = await fetch("/api/docext/extract", {
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
      console.error("Docext API error:", response.status, errorText);
      
      // Fallback to simulated extraction if API is not available
      return simulateAadhaarExtraction(fields);
    }

    const data = await response.json();

    return {
      fields: data.fields || [],
      tables: data.tables || [],
      success: true,
    };
  } catch (error: any) {
    // Check if it's a network/connection error
    if (error.name === "AbortError" || error.name === "TypeError" || error.message?.includes("fetch")) {
      console.error("Docext API connection failed:", error);
      throw new Error(
        "Unable to connect to Docext API. Please ensure the docext server is running on http://localhost:7860"
      );
    }

    // For other errors, try simulation as fallback
    console.warn("Docext API not available, using simulated extraction:", error);
    return simulateAadhaarExtraction(fields);
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

