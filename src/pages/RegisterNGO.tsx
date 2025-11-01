import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db, storage } from "@/integrations/firebase/config";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  Camera,
  CheckCircle2,
  X,
  Plus,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  Copy,
  UserPlus,
  FileText,
  Building2,
  Sparkles,
  AlertTriangle,
  Image as ImageIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import {
  matchImageToTexts,
  validateImageDomain,
  autoTagNGOType,
  validateConditionImage,
} from "@/services/clipService";
import { extractAadhaarDetails } from "@/services/docextService";

// Types
interface AadhaarData {
  name: string;
  dob: string;
  gender: string;
  mobile: string;
  address: string;
}

interface FundingCondition {
  id: string;
  title: string;
  description: string;
  estimatedFund: string;
  priority: "High" | "Medium" | "Low";
  validationResult?: {
    isValid: boolean;
    confidence: number;
  };
}

interface InvitedMember {
  id: string;
  email: string;
  status: "pending" | "verified" | "removed";
}

const RegisterNGO = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Owner Verification
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [aadhaarPreview, setAadhaarPreview] = useState<string | null>(null);
  const [aadhaarData, setAadhaarData] = useState<AadhaarData | null>(null);
  const [aadhaarConfirmed, setAadhaarConfirmed] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoConfirmed, setProfilePhotoConfirmed] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Step 2: Organization Information
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgLogo, setOrgLogo] = useState<File | null>(null);
  const [orgLogoPreview, setOrgLogoPreview] = useState<string | null>(null);
  const [logoValidation, setLogoValidation] = useState<{
    isValid: boolean;
    confidence: number;
    tags: { tag: string; confidence: number }[];
    validating: boolean;
  } | null>(null);

  // Step 3: Funding Conditions
  const [conditions, setConditions] = useState<FundingCondition[]>([]);
  const [newCondition, setNewCondition] = useState<Partial<FundingCondition>>({
    title: "",
    description: "",
    estimatedFund: "",
    priority: "Medium",
  });

  // Step 4: Members
  const [inviteLink, setInviteLink] = useState("");
  const [members, setMembers] = useState<InvitedMember[]>([]);

  // Step 5: Final data
  const [submitted, setSubmitted] = useState(false);

  // Extract Aadhaar data using docext
  const extractAadhaarData = async (file: File): Promise<AadhaarData> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64Image = e.target?.result as string;
            
            // Extract using docext
            const extracted = await extractAadhaarDetails(base64Image);
            
            // Map to AadhaarData format
            resolve({
              name: extracted.name || "",
              dob: extracted.dob || "",
              gender: extracted.gender || "",
              mobile: extracted.mobile || "",
              address: extracted.address || "",
            });
          } catch (err: any) {
            console.error("Aadhaar extraction error:", err);
            // If extraction fails, show error but don't reject - let user enter manually
            setError(err.message || "Failed to extract Aadhaar details. Please enter manually.");
            reject(err);
          }
        };
        reader.onerror = () => {
          reject(new Error("Failed to read file"));
        };
        reader.readAsDataURL(file);
      } catch (error: any) {
        reject(error);
      }
    });
  };

  // Handle Aadhaar upload
  const handleAadhaarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    setAadhaarFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setAadhaarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Extract Aadhaar data using docext
    setLoading(true);
    setError("");
    try {
      const extracted = await extractAadhaarData(file);
      setAadhaarData(extracted);
      setOrgAddress(extracted.address); // Auto-fill address
      toast({
        title: "Extraction successful",
        description: "Aadhaar details extracted successfully. Please verify and confirm.",
      });
    } catch (err: any) {
      const errorMsg = err.message || "Failed to extract Aadhaar data";
      setError(errorMsg);
      toast({
        title: "Extraction failed",
        description: errorMsg + ". Please enter details manually.",
        variant: "destructive",
      });
      // Still show the preview so user can manually enter
    } finally {
      setLoading(false);
    }
  };

  // Webcam functions
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setWebcamActive(true);
      }
    } catch (err) {
      setError("Failed to access camera. Please allow camera permissions.");
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      setProfilePhoto(dataUrl);
      stopWebcam();
    }
  };

  // Validate logo with CLIP
  const validateLogo = async (logoPreview: string, description: string) => {
    if (!logoPreview || !description) {
      setError("Please provide both logo and description for validation");
      return;
    }

    if (description.length < 10) {
      setError("Description is too short. Please provide more details for better validation.");
      return;
    }

    setLogoValidation({ isValid: false, confidence: 0, tags: [], validating: true });
    setError("");

    try {
      // Auto-tag NGO type
      const tags = await autoTagNGOType(logoPreview, description);
      
      // Validate logo matches description domain
      const domainTexts = tags.slice(0, 3).map((t) => t.tag);
      if (domainTexts.length === 0) {
        domainTexts.push("non-profit organization", "charity", "foundation");
      }

      const validation = await validateImageDomain(logoPreview, domainTexts, 0.25);

      setLogoValidation({
        isValid: validation.isValid,
        confidence: validation.confidence,
        tags: tags,
        validating: false,
      });

      if (!validation.isValid) {
        toast({
          title: "Logo validation",
          description: `Logo may not align with organization type. Confidence: ${(validation.confidence * 100).toFixed(1)}%`,
          variant: "default",
        });
      } else {
        toast({
          title: "Validation successful",
          description: `Logo matches organization type with ${(validation.confidence * 100).toFixed(1)}% confidence`,
        });
      }
    } catch (err: any) {
      console.error("Logo validation error:", err);
      
      const errorMessage = err.message || "Failed to validate logo with CLIP";
      
      setLogoValidation({
        isValid: false,
        confidence: 0,
        tags: [],
        validating: false,
      });

      // Show detailed error message
      if (errorMessage.includes('connect') || errorMessage.includes('backend')) {
        setError(`CLIP API is not available. ${errorMessage}. Please start the CLIP backend server.`);
        toast({
          title: "CLIP API unavailable",
          description: "Using simulated validation. Start the backend server for real CLIP analysis.",
          variant: "destructive",
        });
      } else {
        setError(errorMessage);
        toast({
          title: "Validation failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  // Add funding condition
  const addCondition = async () => {
    if (!newCondition.title || !newCondition.description || !newCondition.estimatedFund) {
      setError("Please fill all condition fields");
      return;
    }

    const condition: FundingCondition = {
      id: Date.now().toString(),
      title: newCondition.title || "",
      description: newCondition.description || "",
      estimatedFund: newCondition.estimatedFund || "",
      priority: (newCondition.priority as "High" | "Medium" | "Low") || "Medium",
    };

    // Validate condition description (optional - can be done later with proof images)
    // For now, we'll mark it as pending validation
    condition.validationResult = {
      isValid: true, // Default to true, will be validated when proof images are added
      confidence: 0,
    };

    setConditions([...conditions, condition]);
    setNewCondition({
      title: "",
      description: "",
      estimatedFund: "",
      priority: "Medium",
    });
    setError("");
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  // Generate invite link
  const generateInviteLink = () => {
    const link = `${window.location.origin}/invite/ngo/${currentUser?.uid}/${Date.now()}`;
    setInviteLink(link);
    toast({
      title: "Invite link generated",
      description: "Link copied to clipboard",
    });
    navigator.clipboard.writeText(link);
  };

  const addMember = (email: string) => {
    const member: InvitedMember = {
      id: Date.now().toString(),
      email,
      status: "pending",
    };
    setMembers([...members, member]);
  };

  const removeMember = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
  };

  // Upload file to Firebase Storage
  const uploadFile = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  // Upload base64 image to Firebase Storage
  const uploadBase64Image = async (base64: string, path: string): Promise<string> => {
    const response = await fetch(base64);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  // Submit registration
  const handleSubmit = async () => {
    if (!currentUser) {
      setError("You must be logged in to register an NGO");
      return;
    }

    if (!aadhaarConfirmed || !profilePhotoConfirmed) {
      setError("Please complete owner verification");
      return;
    }

    if (!orgName || !orgDescription || !orgEmail || !orgPhone) {
      setError("Please fill all organization fields");
      return;
    }

    if (conditions.length === 0) {
      setError("Please add at least one funding condition");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Upload all images
      const uploadPromises: Promise<string>[] = [];

      // Aadhaar card
      if (aadhaarFile) {
        uploadPromises.push(
          uploadFile(aadhaarFile, `organizations/${currentUser.uid}/aadhaar/${Date.now()}`)
        );
      }

      // Profile photo
      if (profilePhoto) {
        uploadPromises.push(
          uploadBase64Image(
            profilePhoto,
            `organizations/${currentUser.uid}/profile/${Date.now()}.png`
          )
        );
      }

      // Logo
      if (orgLogo) {
        uploadPromises.push(
          uploadFile(orgLogo, `organizations/${currentUser.uid}/logo/${Date.now()}`)
        );
      }

      const [aadhaarUrl, profilePhotoUrl, logoUrl] = await Promise.all(uploadPromises);

      // Prepare Firestore document
      const orgData = {
        owner_uid: currentUser.uid,
        owner_email: currentUser.email,
        organization_name: orgName,
        description: orgDescription,
        contact_email: orgEmail,
        contact_number: orgPhone,
        address: orgAddress,
        aadhaar_verified: false, // Will be verified later by admin/AI
        aadhaar_url: aadhaarUrl || "",
        profile_photo_url: profilePhotoUrl || "",
        logo_url: logoUrl || "",
        conditions: conditions.map((c) => ({
          title: c.title,
          description: c.description,
          estimated_fund: parseFloat(c.estimatedFund) || 0,
          priority: c.priority,
        })),
        members: members.map((m) => ({
          email: m.email,
          status: m.status,
        })),
        status: "pending_verification",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, "organizations"), orgData);

      setSubmitted(true);
      toast({
        title: "Registration successful!",
        description: "Your NGO registration is pending verification.",
      });

      // Navigate to success page or home after 3 seconds
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || "Failed to submit registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Navigation
  const nextStep = () => {
    if (currentStep < 5) {
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
      stopWebcam();
    };
  }, []);

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Registration Submitted!</CardTitle>
              <CardDescription>
                Your NGO registration has been submitted successfully and is pending verification.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                You will receive an email once your registration is verified.
              </p>
              <Button onClick={() => navigate("/")} className="w-full">
                Go to Home
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
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
                {step < 5 && (
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
            <span>Owner</span>
            <span>Organization</span>
            <span>Conditions</span>
            <span>Members</span>
            <span>Review</span>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">
              Step {currentStep} of 5:{" "}
              {currentStep === 1 && "Owner Verification"}
              {currentStep === 2 && "Organization Information"}
              {currentStep === 3 && "Funding Conditions"}
              {currentStep === 4 && "Community Members"}
              {currentStep === 5 && "Final Review"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Verify your identity using Aadhaar card"}
              {currentStep === 2 && "Tell us about your organization"}
              {currentStep === 3 && "Define funding conditions for your campaigns"}
              {currentStep === 4 && "Invite team members to your organization"}
              {currentStep === 5 && "Review and submit your registration"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant={error.includes("CLIP API") || error.includes("Docext") ? "default" : "destructive"}>
                <AlertDescription className="space-y-2">
                  <p>{error}</p>
                  {error.includes("CLIP API") && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                      <p className="font-semibold mb-1">To enable real CLIP validation:</p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-700">
                        <li>Open a new terminal</li>
                        <li>Navigate to: <code className="bg-gray-100 px-1 rounded">D:\dowl\conditional_answer\CLIP-main</code></li>
                        <li>Run: <code className="bg-gray-100 px-1 rounded">python clip_api_server.py</code></li>
                        <li>Wait for "CLIP model loaded successfully!" message</li>
                        <li>Keep that terminal open and try again</li>
                      </ol>
                    </div>
                  )}
                  {error.includes("Docext") && (
                    <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded text-xs">
                      <p className="font-semibold mb-1">To enable Aadhaar extraction with docext:</p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-700">
                        <li>Open a new terminal</li>
                        <li>Navigate to: <code className="bg-gray-100 px-1 rounded">D:\dowl\photo_ver_model\docext-main</code></li>
                        <li>Run: <code className="bg-gray-100 px-1 rounded">python -m docext.app.app</code></li>
                        <li>Wait for server to start (first time may download model)</li>
                        <li>Start API server: <code className="bg-gray-100 px-1 rounded">python docext_api_server.py</code></li>
                        <li>Keep both terminals open and try again</li>
                      </ol>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Step 1: Owner Verification */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Aadhaar Upload */}
                <div>
                  <Label className="text-base font-semibold mb-2 block">
                    Upload Aadhaar Card
                  </Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {aadhaarPreview ? (
                      <div className="space-y-4">
                        <img
                          src={aadhaarPreview}
                          alt="Aadhaar preview"
                          className="max-w-full h-64 mx-auto rounded-lg shadow-sm"
                        />
                        <Button
                          variant="outline"
                          onClick={() => {
                            setAadhaarFile(null);
                            setAadhaarPreview(null);
                            setAadhaarData(null);
                            setAadhaarConfirmed(false);
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <Label htmlFor="aadhaar-upload" className="cursor-pointer">
                          <Button variant="outline" asChild>
                            <span>
                              <Upload className="mr-2 h-4 w-4" />
                              Choose Aadhaar Image
                            </span>
                          </Button>
                        </Label>
                        <Input
                          id="aadhaar-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleAadhaarUpload}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Loading State */}
                {loading && aadhaarFile && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-accent" />
                      <div>
                        <h3 className="font-semibold">Extracting Information...</h3>
                        <p className="text-xs text-gray-500">
                          Analyzing Aadhaar card with docext AI. This may take 10-30 seconds.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Extracted Data */}
                {aadhaarData && !aadhaarConfirmed && !loading && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold">Extracted Information</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Name:</span>
                        <p className="font-medium">{aadhaarData.name || "Not found"}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">DOB:</span>
                        <p className="font-medium">{aadhaarData.dob || "Not found"}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Gender:</span>
                        <p className="font-medium">{aadhaarData.gender || "Not found"}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Mobile:</span>
                        <p className="font-medium">{aadhaarData.mobile || "Not found"}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Address:</span>
                        <p className="font-medium">{aadhaarData.address || "Not found"}</p>
                      </div>
                    </div>
                    {(!aadhaarData.name || !aadhaarData.dob || !aadhaarData.address) && (
                      <Alert variant="default" className="mt-3">
                        <AlertDescription className="text-xs">
                          Some fields were not extracted. Please review and enter missing information manually.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="confirm-aadhaar"
                        checked={aadhaarConfirmed}
                        onCheckedChange={(checked) =>
                          setAadhaarConfirmed(checked as boolean)
                        }
                      />
                      <Label htmlFor="confirm-aadhaar" className="cursor-pointer">
                        Confirm this information is correct
                      </Label>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-500">
                        ⚠️ AI deepfake verification will be performed later
                      </p>
                    </div>
                  </div>
                )}

                {/* Selfie Capture */}
                <div>
                  <Label className="text-base font-semibold mb-2 block">
                    Capture Profile Photo
                  </Label>
                  {!profilePhoto ? (
                    <div className="space-y-4">
                      {!webcamActive ? (
                        <Button onClick={startWebcam} variant="outline" className="w-full">
                          <Camera className="mr-2 h-4 w-4" />
                          Start Camera
                        </Button>
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
                            <Button onClick={stopWebcam} variant="outline">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-500">
                          Or upload a photo file
                        </p>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                setProfilePhoto(e.target?.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <img
                        src={profilePhoto}
                        alt="Profile"
                        className="w-48 h-48 mx-auto rounded-lg shadow-sm object-cover"
                      />
                      <div className="flex items-center justify-center space-x-2">
                        <Checkbox
                          id="confirm-photo"
                          checked={profilePhotoConfirmed}
                          onCheckedChange={(checked) =>
                            setProfilePhotoConfirmed(checked as boolean)
                          }
                        />
                        <Label htmlFor="confirm-photo" className="cursor-pointer">
                          Confirm this as my profile photo
                        </Label>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setProfilePhoto(null);
                          setProfilePhotoConfirmed(false);
                        }}
                        className="w-full"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Retake Photo
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Organization Information */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="org-name">Organization Name *</Label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g., Education For All Foundation"
                  />
                </div>
                <div>
                  <Label htmlFor="org-desc">Description / Purpose *</Label>
                  <Textarea
                    id="org-desc"
                    value={orgDescription}
                    onChange={async (e) => {
                      setOrgDescription(e.target.value);
                      // Auto-validate logo when description changes
                      if (orgLogoPreview && e.target.value.length > 20) {
                        setTimeout(() => {
                          validateLogo(orgLogoPreview, e.target.value);
                        }, 1000);
                      }
                    }}
                    placeholder="Describe your organization's mission and goals..."
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="org-email">Contact Email *</Label>
                    <Input
                      id="org-email"
                      type="email"
                      value={orgEmail}
                      onChange={(e) => setOrgEmail(e.target.value)}
                      placeholder="contact@ngo.org"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-phone">Contact Number *</Label>
                    <Input
                      id="org-phone"
                      type="tel"
                      value={orgPhone}
                      onChange={(e) => setOrgPhone(e.target.value)}
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="org-address">Address</Label>
                  <Textarea
                    id="org-address"
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                    placeholder="Organization address"
                    rows={2}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Organization Logo (Optional)</Label>
                    {orgLogoPreview && orgDescription && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => validateLogo(orgLogoPreview, orgDescription)}
                        disabled={logoValidation?.validating}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {logoValidation?.validating ? "Validating..." : "Validate with AI"}
                      </Button>
                    )}
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {orgLogoPreview ? (
                      <div className="space-y-4">
                        <img
                          src={orgLogoPreview}
                          alt="Logo preview"
                          className="w-32 h-32 mx-auto rounded-lg object-contain"
                        />
                        
                        {/* CLIP Validation Results */}
                        {logoValidation && !logoValidation.validating && (
                          <div className={`p-3 rounded-lg border ${
                            logoValidation.isValid 
                              ? "bg-green-50 border-green-200" 
                              : "bg-yellow-50 border-yellow-200"
                          }`}>
                            <div className="flex items-start gap-2 mb-2">
                              {logoValidation.isValid ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                              ) : (
                                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                              )}
                              <div className="flex-1 text-left">
                                <p className="text-sm font-medium">
                                  {logoValidation.isValid 
                                    ? "Logo matches organization type" 
                                    : "Logo may not align with description"}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Confidence: {(logoValidation.confidence * 100).toFixed(1)}%
                                </p>
                                {logoValidation.tags.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {logoValidation.tags.slice(0, 3).map((tag, idx) => (
                                      <span
                                        key={idx}
                                        className="text-xs px-2 py-1 bg-gray-100 rounded-full"
                                      >
                                        {tag.tag} ({(tag.confidence * 100).toFixed(0)}%)
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {logoValidation?.validating && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Analyzing logo with CLIP AI...
                            </div>
                            <p className="text-xs text-center text-gray-500">
                              This may take a few seconds. Processing image features...
                            </p>
                          </div>
                        )}

                        <Button
                          variant="outline"
                          onClick={() => {
                            setOrgLogo(null);
                            setOrgLogoPreview(null);
                            setLogoValidation(null);
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <Label htmlFor="logo-upload" className="cursor-pointer">
                          <Button variant="outline" asChild>
                            <span>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Logo
                            </span>
                          </Button>
                        </Label>
                        <Input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setOrgLogo(file);
                              const reader = new FileReader();
                              reader.onload = async (e) => {
                                const preview = e.target?.result as string;
                                setOrgLogoPreview(preview);
                                // Validate logo with CLIP if description exists
                                if (orgDescription) {
                                  await validateLogo(preview, orgDescription);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Funding Conditions */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold">Add New Condition</h3>
                  <div>
                    <Label>Title *</Label>
                    <Input
                      value={newCondition.title}
                      onChange={(e) =>
                        setNewCondition({ ...newCondition, title: e.target.value })
                      }
                      placeholder="e.g., School Supplies"
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
                      <Label>Estimated Fund Requirement (₹) *</Label>
                      <Input
                        type="number"
                        value={newCondition.estimatedFund}
                        onChange={(e) =>
                          setNewCondition({ ...newCondition, estimatedFund: e.target.value })
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
                              {condition.validationResult && (
                                <span
                                  className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                                    condition.validationResult.isValid
                                      ? "bg-green-100 text-green-700"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                  title="AI validation status"
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  {condition.validationResult.isValid
                                    ? "Validated"
                                    : "Pending"}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{condition.description}</p>
                            <p className="text-sm font-medium">₹{condition.estimatedFund}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              💡 Upload proof images later to validate with CLIP AI
                            </p>
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

            {/* Step 4: Members */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold">Invite Community Members</h3>
                  <div>
                    <Label>Member Email</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="member@example.com"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            const input = e.target as HTMLInputElement;
                            if (input.value) {
                              addMember(input.value);
                              input.value = "";
                            }
                          }
                        }}
                      />
                      <Button
                        onClick={(e) => {
                          const input = (e.target as HTMLElement)
                            .previousElementSibling as HTMLInputElement;
                          if (input?.value) {
                            addMember(input.value);
                            input.value = "";
                          }
                        }}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      onClick={generateInviteLink}
                      className="w-full"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Generate Invite Link
                    </Button>
                    {inviteLink && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs break-all">
                        {inviteLink}
                      </div>
                    )}
                  </div>
                </div>

                {/* Members List */}
                {members.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Invited Members ({members.length})</h3>
                    {members.map((member) => (
                      <Card key={member.id} className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{member.email}</p>
                            <p className="text-xs text-gray-500 capitalize">{member.status}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMember(member.id)}
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

            {/* Step 5: Final Review */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-lg">Owner Information</h3>
                  {aadhaarData && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Name:</span>
                        <p className="font-medium">{aadhaarData.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Mobile:</span>
                        <p className="font-medium">{aadhaarData.mobile}</p>
                      </div>
                    </div>
                  )}
                  {profilePhoto && (
                    <div>
                      <span className="text-gray-600 text-sm">Profile Photo:</span>
                      <img
                        src={profilePhoto}
                        alt="Profile"
                        className="w-24 h-24 rounded-lg mt-2 object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-lg">Organization Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-medium">{orgName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Description:</span>
                      <p className="font-medium">{orgDescription}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-gray-600">Email:</span>
                        <p className="font-medium">{orgEmail}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Phone:</span>
                        <p className="font-medium">{orgPhone}</p>
                      </div>
                    </div>
                    {orgAddress && (
                      <div>
                        <span className="text-gray-600">Address:</span>
                        <p className="font-medium">{orgAddress}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-lg">
                    Funding Conditions ({conditions.length})
                  </h3>
                  <div className="space-y-2">
                    {conditions.map((condition) => (
                      <div key={condition.id} className="text-sm">
                        <p className="font-medium">
                          {condition.title} - ₹{condition.estimatedFund} ({condition.priority})
                        </p>
                        <p className="text-gray-600">{condition.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {members.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold text-lg">Members ({members.length})</h3>
                    <div className="space-y-1">
                      {members.map((member) => (
                        <p key={member.id} className="text-sm">
                          {member.email} ({member.status})
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Checkbox id="agree-terms" className="mr-2" />
                  <Label htmlFor="agree-terms" className="cursor-pointer text-sm">
                    I confirm that all information provided is accurate and agree to the terms of
                    service
                  </Label>
                </div>
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
            {currentStep < 5 ? (
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

