import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/firebase/config";
import { collection, doc, setDoc, addDoc, serverTimestamp } from "firebase/firestore";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  CheckCircle2,
  Plus,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  User,
  FileText,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";

// Types
interface IdData {
  name: string;
  dob: string;
  gender: string;
  address: string;
  id_number: string;
  id_type: string;
}

interface FundingCondition {
  id: string;
  title: string;
  description: string;
  fund_estimate: string;
  priority: "High" | "Medium" | "Low";
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Get API URL - always use full URL to avoid proxy issues
const getApiUrl = (endpoint: string) => {
  // Always use full URL with backend port 3000
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  return `${baseUrl}${endpoint}`;
};

const RegisterNGO = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: ID Upload & Extraction
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [idData, setIdData] = useState<IdData>({
    name: "",
    dob: "",
    gender: "",
    address: "",
    id_number: "",
    id_type: "",
  });
  const [extracting, setExtracting] = useState(false);
  const [idConfirmed, setIdConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Profile Photo
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  // Step 3: NGO Details
  const [ngoName, setNgoName] = useState("");
  const [ngoDescription, setNgoDescription] = useState("");
  const [donationCategory, setDonationCategory] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [conditions, setConditions] = useState<FundingCondition[]>([]);
  const [newCondition, setNewCondition] = useState<Partial<FundingCondition>>({
    title: "",
    description: "",
    fund_estimate: "",
    priority: "Medium",
  });

  // Step 1: Handle ID Upload & Extraction
  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("Please upload an image (JPG, PNG) or PDF file");
      return;
    }

    setIdFile(file);
    setError("");
    setExtracting(true);
    setIdConfirmed(false);

    // Show preview for images
    if (file.type.startsWith("image/")) {
        const reader = new FileReader();
      reader.onload = (e) => {
        setIdPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setIdPreview(null);
    }

    try {
      // Step 1: Upload file to MongoDB via backend
      if (!currentUser) {
        throw new Error("You must be logged in to upload files");
      }

      console.log('📤 Starting file upload to MongoDB...');
      console.log('   File Name:', file.name);
      console.log('   File Size:', file.size, 'bytes');
      console.log('   User:', currentUser.uid);
      
              toast({
        title: "📤 Uploading file...",
        description: "Please wait while we upload your file to MongoDB.",
            });
            
      // Upload file to backend (MongoDB)
      let fileUrl: string;
      
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("userId", currentUser.uid);

        const uploadResponse = await axios.post(
          getApiUrl('/api/upload-file'),
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
            timeout: 60000, // 60 second timeout for upload
          }
        );

        if (uploadResponse.data.success && uploadResponse.data.data) {
          // Use the fileUrl from response (will be converted to full URL by backend)
          fileUrl = uploadResponse.data.data.fileUrl;
          console.log('✅ File uploaded to MongoDB successfully');
          console.log('📄 File URL:', fileUrl);
          console.log('🆔 File ID:', uploadResponse.data.data.fileId);
            } else {
          throw new Error(uploadResponse.data.message || "Failed to upload file");
        }
      } catch (uploadError: any) {
        console.error('❌ MongoDB upload error:', uploadError);
        console.error('   Error details:', {
          message: uploadError.message,
          response: uploadError.response?.data,
        });
        
        throw new Error(
          uploadError.response?.data?.message || 
          uploadError.message || 
          "Failed to upload file to MongoDB"
        );
      }

      // Step 2: Send file URL to backend for extraction
      toast({
        title: "🔍 Extracting information...",
        description: "Using AI to extract ID details. This may take 10-30 seconds.",
      });

      console.log('📤 Sending to extract-id:', {
        fileUrl: fileUrl,
        fileName: file.name,
        fileType: file.type,
      });

      const response = await axios.post(
        getApiUrl('/api/extract-id'),
        {
          fileUrl: fileUrl, // MongoDB file URL
          fileName: file.name,
          fileType: file.type,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 90000, // 90 second timeout for AI processing
        }
      );

      if (response.data.success && response.data.data) {
        setIdData(response.data.data);
      toast({
          title: "✅ Extraction successful",
          description: "ID details extracted successfully. Please verify and confirm.",
      });
      } else {
        throw new Error(response.data.message || "Failed to extract ID data");
      }
    } catch (err: any) {
      console.error("ID extraction error:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error details:", err.response?.data?.error);
      
      // Check if it's a connection error (backend not running)
      const isConnectionError = 
        err.code === 'ERR_CONNECTION_REFUSED' ||
        err.code === 'ECONNREFUSED' ||
        err.message?.includes('ERR_CONNECTION_REFUSED') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('Network Error') ||
        !err.response;
      
      // Provide user-friendly error messages
      let errorMsg = "Failed to extract ID information";
      let errorDescription = "Please try again or contact support if the issue persists.";
      
      if (isConnectionError) {
        errorMsg = "Backend Server Not Available";
        errorDescription = "The backend server is not running or not accessible. Please ensure the backend server is started on port 3000. If you're a developer, check that the backend is running.";
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
        errorDescription = err.response.data.error?.details || errorDescription;
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      // Show detailed error in development
      if (err.response?.data?.error) {
        console.error("Detailed error:", JSON.stringify(err.response.data.error, null, 2));
      }
      
      if (isConnectionError) {
        console.error("Backend connection failed. Make sure the backend server is running on port 3000.");
      }
      
      // Override with specific error messages if not already set
      if (!isConnectionError) {
        if (err.message?.includes('timeout')) {
          errorMsg = "Request timed out";
          errorDescription = "The request took too long. Please try again with a smaller file.";
        } else if (err.message?.includes('MongoDB')) {
          errorMsg = "Database error";
          errorDescription = "Please check MongoDB connection.";
        } else if (err.message?.includes('upload')) {
          errorMsg = err.message;
        } else if (err.response?.data?.message) {
          errorMsg = err.response.data.message;
        } else if (err.message) {
          errorMsg = err.message;
        }
      }

      setError(errorMsg);
      toast({
        title: `❌ ${errorMsg}`,
        description: errorDescription + (isConnectionError ? "" : " Please enter details manually."),
        variant: "destructive",
        duration: isConnectionError ? 15000 : 5000, // Show longer for connection errors
      });

      // Clear extracted data
      setIdData({
        name: "",
        dob: "",
        gender: "",
        address: "",
        id_number: "",
        id_type: "",
      });
    } finally {
      setExtracting(false);
    }
  };

  // Step 2: Profile Photo Upload
  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "❌ Invalid file type",
        description: "Please select an image file (JPG, PNG, etc.).",
        variant: "destructive",
      });
      if (profilePhotoInputRef.current) {
        profilePhotoInputRef.current.value = "";
      }
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "❌ File too large",
        description: "Image must be less than 10MB. Please select a smaller image.",
        variant: "destructive",
      });
      if (profilePhotoInputRef.current) {
        profilePhotoInputRef.current.value = "";
      }
      return;
    }

    // Validate minimum file size (at least 1KB)
    if (file.size < 1024) {
      toast({
        title: "❌ File too small",
        description: "The image file is too small. Please select a valid image.",
        variant: "destructive",
      });
      if (profilePhotoInputRef.current) {
        profilePhotoInputRef.current.value = "";
      }
      return;
    }

    setError("");
    setVerifying(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        if (!imageData || imageData.length < 100) {
          toast({
            title: "❌ Invalid image data",
            description: "The image data is corrupted. Please try again.",
            variant: "destructive",
          });
          setVerifying(false);
          return;
        }

        console.log('📸 Photo selected:', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          dataUrlLength: imageData.length,
        });

        // Upload profile photo to MongoDB
        const response = await axios.post(
          getApiUrl('/api/verify-face'),
          { image: imageData },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          // Store the MongoDB file URL
          if (response.data.faceImageUrl) {
            setFacePhoto(response.data.faceImageUrl);
          } else {
            // Fallback to base64 if URL not provided
            setFacePhoto(imageData);
          }
          setFaceVerified(true);
        toast({
            title: "✅ Photo saved",
            description: "Your profile photo has been saved successfully.",
        });
      } else {
          setFaceVerified(false);
          setFacePhoto(null);
        toast({
            title: "❌ Failed to save photo",
            description: response.data.message || "Please try again.",
            variant: "destructive",
      });
        }
      };

      reader.onerror = () => {
        toast({
          title: "❌ Failed to read file",
          description: "Could not read the image file. Please try again.",
          variant: "destructive",
        });
        setVerifying(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("Profile photo upload error:", err);
      const errorMsg = err.response?.data?.message || err.message || "Failed to upload profile photo";
      setError(errorMsg);
      setFaceVerified(false);
      setFacePhoto(null);
        toast({
        title: "❌ Failed to upload photo",
        description: errorMsg,
          variant: "destructive",
        });
    } finally {
      setVerifying(false);
      if (profilePhotoInputRef.current) {
        profilePhotoInputRef.current.value = "";
      }
    }
  };

  const removePhoto = () => {
    setFacePhoto(null);
    setFaceVerified(false);
    if (profilePhotoInputRef.current) {
      profilePhotoInputRef.current.value = "";
    }
  };

  // Step 3: Add funding condition
  const addCondition = () => {
    if (!newCondition.title || !newCondition.description || !newCondition.fund_estimate) {
      setError("Please fill all condition fields");
      return;
    }

    const condition: FundingCondition = {
      id: Date.now().toString(),
      title: newCondition.title || "",
      description: newCondition.description || "",
      fund_estimate: newCondition.fund_estimate || "",
      priority: (newCondition.priority as "High" | "Medium" | "Low") || "Medium",
    };

    setConditions([...conditions, condition]);
    setNewCondition({
      title: "",
      description: "",
      fund_estimate: "",
      priority: "Medium",
    });
    setError("");
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  // Submit registration
  const handleSubmit = async () => {
    if (!currentUser) {
      setError("You must be logged in to register an NGO");
      return;
    }

    if (!idConfirmed) {
      setError("Please complete ID verification");
      return;
    }

    if (!faceVerified) {
      setError("Please capture and confirm your profile photo");
      return;
    }

    if (!ngoName || !ngoDescription || !donationCategory) {
      setError("Please fill all required NGO fields");
      return;
    }

    if (conditions.length === 0) {
      setError("Please add at least one funding condition");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Profile photo is already in MongoDB (uploaded during face verification)
      // Use the MongoDB URL directly
      let profilePhotoUrl = facePhoto || "";
      
      // If it's a relative MongoDB URL, convert to full URL
      if (profilePhotoUrl && profilePhotoUrl.startsWith('/api/file/')) {
        profilePhotoUrl = getApiUrl(profilePhotoUrl);
      }

      const response = await axios.post(
        getApiUrl('/api/register-ngo'),
        {
          uid: currentUser.uid,
          profile: {
            name: idData.name,
            dob: idData.dob,
            gender: idData.gender,
            address: idData.address,
            id_number: idData.id_number,
            id_type: idData.id_type,
          },
          details: {
            ngo_name: ngoName,
            description: ngoDescription,
            donation_category: donationCategory,
            contact_email: contactEmail || currentUser.email || "",
            contact_phone: contactPhone,
          },
        conditions: conditions.map((c) => ({
          title: c.title,
          description: c.description,
            fund_estimate: parseFloat(c.fund_estimate) || 0,
          priority: c.priority,
        })),
          profilePhotoUrl,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        // Save NGO to Firestore so it appears in BrowseCampaigns
        // Use addDoc to generate unique ID for each NGO (allows multiple NGOs per user)
        try {
          const ngoData = {
            owner_uid: currentUser.uid, // Store owner's UID for reference
            owner_email: contactEmail || currentUser.email || "", // Store owner's email
            profile: {
              name: idData.name,
              dob: idData.dob,
              gender: idData.gender,
              address: idData.address,
              id_number: idData.id_number,
              id_type: idData.id_type,
              verified: true, // Auto-verified for now
              profile_photo_url: profilePhotoUrl || "",
            },
            details: {
              ngo_name: ngoName,
              description: ngoDescription,
              donation_category: donationCategory,
              contact_email: contactEmail || currentUser.email || "",
              contact_phone: contactPhone,
            },
            conditions: conditions.map((c) => ({
              title: c.title,
              description: c.description,
              fund_estimate: parseFloat(c.fund_estimate) || 0,
              priority: c.priority,
            })),
            status: "active", // Set as active to show in BrowseCampaigns
            total_raised: 0, // Initialize total_raised
            total_goal: conditions.reduce((sum, c) => sum + (parseFloat(c.fund_estimate) || 0), 0), // Calculate total goal
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          };
          
          // Use addDoc to generate unique ID - allows multiple NGOs per user
          const ngoDocRef = await addDoc(collection(db, "ngos"), ngoData);

          toast({
            title: "🎉 Registration successful!",
            description: "Your NGO is now active and visible in campaigns.",
          });

          setTimeout(() => {
            navigate("/campaigns");
          }, 2000);
        } catch (firestoreError: any) {
          console.error("Error saving to Firestore:", firestoreError);
          // Still show success but warn about Firestore sync
          toast({
            title: "🎉 Registration successful!",
            description: "NGO registered in MongoDB. Refreshing campaigns page...",
          });
          setTimeout(() => {
            navigate("/campaigns");
          }, 2000);
        }
      } else {
        throw new Error(response.data.message || "Failed to register NGO");
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      const errorMsg = err.response?.data?.message || err.message || "Failed to register NGO";
      setError(errorMsg);
      toast({
        title: "❌ Registration failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Navigation
  const nextStep = () => {
    if (currentStep === 1 && !idConfirmed) {
      setError("Please confirm your ID information");
      return;
    }
    if (currentStep === 2 && !faceVerified) {
      setError("Please capture and confirm your profile photo");
      return;
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      setError("");
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError("");
    }
  };

  // No cleanup needed for gallery upload

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= step
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-400 border-gray-300"
                  }`}
                >
                  {currentStep > step ? <Check className="w-5 h-5" /> : step}
                </div>
                {step < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > step ? "bg-black" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center mt-2 text-xs text-gray-600">
            <div className="flex flex-1 items-start">
              <span className="w-10 text-center">ID Upload</span>
            </div>
            <div className="flex flex-1 items-start justify-center">
              <span className="w-10 text-center">Face Verify</span>
            </div>
            <div className="flex flex-1 items-start justify-end">
              <span className="w-10 text-center">NGO Details</span>
            </div>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">
              Step {currentStep} of 3:{" "}
              {currentStep === 1 && "Upload ID Card"}
              {currentStep === 2 && "Profile Photo"}
              {currentStep === 3 && "NGO Details"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Upload your Aadhaar or PAN card for verification"}
              {currentStep === 2 && "Capture a live photo for your profile picture"}
              {currentStep === 3 && "Enter your NGO details and funding conditions"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Step 1: ID Upload */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-semibold mb-2 block">
                    Upload Aadhaar or PAN Card
                  </Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {idPreview ? (
                      <div className="space-y-4">
                        <img
                          src={idPreview}
                          alt="ID preview"
                          className="max-w-full h-64 mx-auto rounded-lg shadow-sm"
                        />
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIdFile(null);
                            setIdPreview(null);
                            setIdData({
                              name: "",
                              dob: "",
                              gender: "",
                              address: "",
                              id_number: "",
                              id_type: "",
                            });
                            setIdConfirmed(false);
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <Label htmlFor="id-upload" className="cursor-pointer">
                          <Button variant="outline" asChild>
                            <span>
                              <Upload className="mr-2 h-4 w-4" />
                              Choose ID File (JPG/PNG/PDF)
                            </span>
                          </Button>
                        </Label>
                        <Input
                          id="id-upload"
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleIdUpload}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Extracting */}
                {extracting && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-black" />
                      <div>
                        <h3 className="font-semibold">Extracting Information...</h3>
                        <p className="text-xs text-gray-500">
                          Analyzing ID document with AI. This may take 10-30 seconds.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Extracted Data */}
                {idData.name && !extracting && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold">Extracted Information</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Full Name</Label>
                        <Input
                          value={idData.name}
                          onChange={(e) =>
                            setIdData({ ...idData, name: e.target.value })
                          }
                          placeholder="Enter full name"
                        />
                      </div>
                      <div>
                        <Label>Date of Birth (DD-MM-YYYY)</Label>
                        <Input
                          value={idData.dob}
                          onChange={(e) => setIdData({ ...idData, dob: e.target.value })}
                          placeholder="DD-MM-YYYY"
                        />
                      </div>
                      <div>
                        <Label>Gender</Label>
                        <Select
                          value={idData.gender}
                          onValueChange={(value) =>
                            setIdData({ ...idData, gender: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Transgender">Transgender</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>ID Number</Label>
                        <Input
                          value={idData.id_number}
                          onChange={(e) =>
                            setIdData({ ...idData, id_number: e.target.value })
                          }
                          placeholder="ID number"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Full Address</Label>
                        <Textarea
                          value={idData.address}
                          onChange={(e) =>
                            setIdData({ ...idData, address: e.target.value })
                          }
                          placeholder="Enter complete address"
                          rows={3}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="confirm-id"
                        checked={idConfirmed}
                        onCheckedChange={(checked) => setIdConfirmed(checked as boolean)}
                      />
                      <Label htmlFor="confirm-id" className="cursor-pointer">
                        Confirm this information is correct
                      </Label>
                    </div>
                    </div>
                )}
                  </div>
                )}

            {/* Step 2: Profile Photo */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-semibold mb-2 block">
                    Upload Profile Photo
                  </Label>

                  {!facePhoto ? (
                    <div className="space-y-4">
                      {verifying ? (
                        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-black" />
                            <div>
                              <h3 className="font-semibold">Uploading Photo...</h3>
                              <p className="text-xs text-gray-500">
                                Saving your profile photo. Please wait...
                              </p>
                          </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                          <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                          <p className="text-sm text-gray-600 mb-4">
                            Upload a photo from your gallery
                          </p>
                          <Label htmlFor="profile-photo-upload" className="cursor-pointer">
                            <Button variant="outline" asChild>
                              <span>
                                <Upload className="mr-2 h-4 w-4" />
                                Choose Photo from Gallery
                              </span>
                            </Button>
                          </Label>
                        <Input
                            id="profile-photo-upload"
                            ref={profilePhotoInputRef}
                          type="file"
                          accept="image/*"
                            onChange={handleProfilePhotoUpload}
                            className="hidden"
                        />
                          <p className="text-xs text-gray-500 mt-3">
                            Supported formats: JPG, PNG, WebP (Max 10MB)
                          </p>
                      </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {verifying && (
                        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-black" />
                            <div>
                              <h3 className="font-semibold">Saving Photo...</h3>
                              <p className="text-xs text-gray-500">
                                Saving your profile photo. Please wait...
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {faceVerified && !verifying && (
                        <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <h3 className="font-semibold text-green-800">Profile Photo Saved</h3>
                          </div>
                          <p className="text-sm text-green-700 mt-1">
                            Your profile photo has been saved successfully.
                          </p>
                        </div>
                      )}

                      {!faceVerified && !verifying && (
                        <div className="space-y-4">
                          <div className="flex justify-center">
                            <img
                              src={facePhoto.startsWith('/api/file/') ? getApiUrl(facePhoto) : facePhoto}
                        alt="Profile"
                              className="w-48 h-48 rounded-lg shadow-sm object-cover"
                      />
                      </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: NGO Details */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="ngo-name">NGO Name *</Label>
                  <Input
                    id="ngo-name"
                    value={ngoName}
                    onChange={(e) => setNgoName(e.target.value)}
                    placeholder="e.g., Education For All Foundation"
                  />
                </div>
                <div>
                  <Label htmlFor="ngo-desc">Description / Purpose *</Label>
                  <Textarea
                    id="ngo-desc"
                    value={ngoDescription}
                    onChange={(e) => setNgoDescription(e.target.value)}
                    placeholder="Describe your organization's mission and goals..."
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="donation-category">Donation Category *</Label>
                  <Select value={donationCategory} onValueChange={setDonationCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Disaster Relief">Disaster Relief</SelectItem>
                      <SelectItem value="Environment">Environment</SelectItem>
                      <SelectItem value="Poverty Alleviation">Poverty Alleviation</SelectItem>
                      <SelectItem value="Women Empowerment">Women Empowerment</SelectItem>
                      <SelectItem value="Children Welfare">Children Welfare</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact-email">Contact Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder={currentUser?.email || "contact@ngo.org"}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-phone">Contact Number</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>

                {/* Funding Conditions */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold">Add Funding Condition</h3>
                  <div>
                    <Label>Condition Title *</Label>
                    <Input
                      value={newCondition.title}
                      onChange={(e) =>
                        setNewCondition({ ...newCondition, title: e.target.value })
                      }
                      placeholder="e.g., Food for Flood Survivors"
                    />
                  </div>
                  <div>
                    <Label>Description *</Label>
                    <Textarea
                      value={newCondition.description}
                      onChange={(e) =>
                        setNewCondition({ ...newCondition, description: e.target.value })
                      }
                      placeholder="Describe what this funding condition is for..."
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Estimated Fund (₹) *</Label>
                      <Input
                        type="number"
                        value={newCondition.fund_estimate}
                        onChange={(e) =>
                          setNewCondition({ ...newCondition, fund_estimate: e.target.value })
                        }
                        placeholder="50000"
                      />
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Select
                        value={newCondition.priority}
                        onValueChange={(value: "High" | "Medium" | "Low") =>
                          setNewCondition({ ...newCondition, priority: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={addCondition} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Condition
                  </Button>
                </div>

                {/* Conditions List */}
                {conditions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Added Conditions ({conditions.length})</h3>
                    {conditions.map((condition) => (
                      <Card key={condition.id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{condition.title}</h4>
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  condition.priority === "High"
                                    ? "bg-red-100 text-red-700"
                                    : condition.priority === "Medium"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {condition.priority}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{condition.description}</p>
                            <p className="text-sm font-medium">₹{condition.fund_estimate}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCondition(condition.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>

          {/* Navigation Buttons */}
          <div className="flex justify-between p-6 border-t">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1 || loading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            {currentStep < 3 ? (
              <Button
                onClick={nextStep}
                disabled={loading}
                className="bg-black text-white hover:bg-gray-800"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-black text-white hover:bg-gray-800"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Submit Registration
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>
      </div>
      <Footer />

    </div>
  );
};

export default RegisterNGO;
