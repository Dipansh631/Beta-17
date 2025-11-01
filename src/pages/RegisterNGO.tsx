import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  Camera,
  CheckCircle2,
  X,
  Plus,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  User,
  FileText,
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

// Use proxy in development (Vite proxy)
const getApiUrl = (endpoint: string) => {
  // In development, use Vite proxy (/api goes to http://localhost:3000/api)
  // In production, use full URL
  if (import.meta.env.DEV) {
    return endpoint; // Use relative URL for proxy
  }
  return `${API_BASE_URL}${endpoint}`;
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

  // Step 2: Face Verification
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      
      // Provide user-friendly error messages
      let errorMsg = "Failed to extract ID information";
      
      if (err.message?.includes('timeout')) {
        errorMsg = "❌ Request timed out. Please try again with a smaller file.";
      } else if (err.message?.includes('MongoDB')) {
        errorMsg = "❌ Database error. Please check MongoDB connection.";
      } else if (err.message?.includes('upload')) {
        errorMsg = err.message;
      } else {
        errorMsg = err.response?.data?.message || err.message || errorMsg;
      }

      setError(errorMsg);
      toast({
        title: "❌ Extraction failed",
        description: errorMsg + ". Please enter details manually.",
        variant: "destructive",
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

  // Step 2: Camera functions
  const isMobileDevice = () => {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || (window.matchMedia && window.matchMedia("(max-width: 768px)").matches)
    );
  };

  const openCamera = async () => {
    const isMobile = isMobileDevice();

    if (isMobile) {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    } else {
      try {
        setError("");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        streamRef.current = stream;
        setCameraActive(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError("Failed to access camera. Please allow camera permissions.");
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setCapturedPhoto(dataUrl);
      stopCamera();
      setShowConfirmDialog(true);
    }
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setCapturedPhoto(imageData);
      setShowConfirmDialog(true);
    };
    reader.readAsDataURL(file);

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  };

  const confirmPhoto = async () => {
    if (!capturedPhoto) return;

    setShowConfirmDialog(false);
    setFacePhoto(capturedPhoto);
    setVerifying(true);
    setError("");

    try {
      const response = await axios.post(
        getApiUrl('/api/verify-face'),
        { image: capturedPhoto },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success && response.data.status === "Verified") {
        setFaceVerified(true);
        toast({
          title: "✅ Face verified",
          description: "Your face has been verified successfully.",
        });
      } else {
        setFaceVerified(false);
        setFacePhoto(null);
        toast({
          title: "❌ Verification failed",
          description: "Face verification failed. Please retake the photo.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Face verification error:", err);
      const errorMsg = err.response?.data?.message || err.message || "Failed to verify face";
      setError(errorMsg);
      setFaceVerified(false);
      setFacePhoto(null);
      toast({
        title: "❌ Verification failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
      setCapturedPhoto(null);
    }
  };

  const retakePhoto = () => {
    setShowConfirmDialog(false);
    setCapturedPhoto(null);
    setFacePhoto(null);
    setFaceVerified(false);
    openCamera();
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

    if (!idConfirmed || !faceVerified) {
      setError("Please complete ID verification and face verification");
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
      // Upload profile photo if exists
      let profilePhotoUrl = "";
      if (facePhoto) {
        // In production, upload to Firebase Storage first
        // For now, we'll use base64 or upload URL
        profilePhotoUrl = facePhoto;
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
        toast({
          title: "🎉 Registration successful!",
          description: "Your NGO registration is pending verification.",
        });

        setTimeout(() => {
          navigate("/");
        }, 2000);
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
      setError("Please complete face verification");
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

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>ID Upload</span>
            <span>Face Verify</span>
            <span>NGO Details</span>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">
              Step {currentStep} of 3:{" "}
              {currentStep === 1 && "Upload ID Card"}
              {currentStep === 2 && "Face Verification"}
              {currentStep === 3 && "NGO Details"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Upload your Aadhaar or PAN card for verification"}
              {currentStep === 2 && "Capture a live photo for face verification"}
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

            {/* Step 2: Face Verification */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-semibold mb-2 block">
                    Capture Live Photo
                  </Label>

                  <Input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleCameraCapture}
                    className="hidden"
                  />

                  {!facePhoto ? (
                    <div className="space-y-4">
                      {!cameraActive ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                          <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                          <p className="text-sm text-gray-600 mb-4">
                            Click below to open your camera and capture a photo
                          </p>
                          <Button onClick={openCamera} variant="outline" className="w-full">
                            <Camera className="mr-2 h-4 w-4" />
                            Open Camera
                          </Button>
                          <p className="text-xs text-gray-500 mt-3">
                            This will open your device camera directly
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              className="w-full h-64 object-cover"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={capturePhoto} className="flex-1">
                              <Camera className="mr-2 h-4 w-4" />
                              Capture Photo
                            </Button>
                            <Button onClick={stopCamera} variant="outline">
                              Cancel
                            </Button>
                          </div>
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
                              <h3 className="font-semibold">Verifying Face...</h3>
                              <p className="text-xs text-gray-500">
                                Analyzing photo with AI. This may take 5-10 seconds.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {faceVerified && !verifying && (
                        <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <h3 className="font-semibold text-green-800">Face Verified</h3>
                          </div>
                          <p className="text-sm text-green-700 mt-1">
                            Your face has been verified successfully.
                          </p>
                        </div>
                      )}

                      {!faceVerified && !verifying && facePhoto && (
                        <div className="space-y-4">
                          <img
                            src={facePhoto}
                            alt="Profile"
                            className="w-48 h-48 mx-auto rounded-lg shadow-sm object-cover"
                          />
                          <Button
                            variant="outline"
                            onClick={() => {
                              setFacePhoto(null);
                              setFaceVerified(false);
                              openCamera();
                            }}
                            className="w-full"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Retake Photo
                          </Button>
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

      {/* Photo Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Photo</DialogTitle>
            <DialogDescription>
              Please review your captured photo. Do you want to use this for verification?
            </DialogDescription>
          </DialogHeader>
          {capturedPhoto && (
            <div className="flex justify-center py-4">
              <img
                src={capturedPhoto}
                alt="Captured photo"
                className="w-64 h-64 rounded-lg shadow-sm object-cover"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={retakePhoto}>
              <X className="mr-2 h-4 w-4" />
              Retake
            </Button>
            <Button onClick={confirmPhoto}>
              <Check className="mr-2 h-4 w-4" />
              Confirm & Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegisterNGO;
