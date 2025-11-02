import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  Image as ImageIcon,
  DollarSign,
  CheckCircle2,
  Loader2,
  X,
  Camera,
  Save,
  FileText,
  PieChart,
  Wallet,
  Building2,
  Users,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

interface Donation {
  id: string;
  userId: string;
  campaignId: string;
  ngoId: string;
  condition: string;
  amount: number;
  timestamp: any;
  status: string;
  proofSubmitted?: boolean;
  proofId?: string;
}

interface FundingCondition {
  title: string;
  description: string;
  fund_estimate: number;
  priority: string;
}

interface NGOCampaign {
  id: string;
  details: {
    ngo_name: string;
    description: string;
  };
  conditions: FundingCondition[];
  total_raised?: number;
}

interface WorkProof {
  id?: string;
  donationId: string;
  userId: string;
  campaignId: string;
  conditionAllocations: {
    condition: string;
    amount: number;
    percentage: number;
  }[];
  photos: string[];
  description: string;
  timestamp: any;
  status: "pending" | "verified" | "rejected";
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const getApiUrl = (endpoint: string) => {
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  return `${baseUrl}${endpoint}`;
};

const NGODashboard = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [allCampaigns, setAllCampaigns] = useState<NGOCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [campaign, setCampaign] = useState<NGOCampaign | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [showProofDialog, setShowProofDialog] = useState(false);
  
  // Proof upload states (general proof, not per donation)
  const [proofPhotos, setProofPhotos] = useState<File[]>([]);
  const [proofPhotoUrls, setProofPhotoUrls] = useState<string[]>([]);
  const [totalUsedAmount, setTotalUsedAmount] = useState<number>(0);
  const [conditionAllocations, setConditionAllocations] = useState<
    { condition: string; amount: number; percentage: number }[]
  >([]);
  const [proofDescription, setProofDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Image verification states
  const [imageVerificationStatus, setImageVerificationStatus] = useState<Map<number, {
    status: 'pending' | 'verifying' | 'verified' | 'failed';
    message?: string;
  }>>(new Map());
  const [verifyingImages, setVerifyingImages] = useState(false);
  const [activeTab, setActiveTab] = useState<"organization" | "proofs" | "gallery">("organization");
  
  // Image gallery states (separate from work proofs)
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryFileInputRef, setGalleryFileInputRef] = useState<HTMLInputElement | null>(null);
  
  // Wallet stats state - must be declared with all other hooks
  const [usedMoney, setUsedMoney] = useState(0);

  useEffect(() => {
    if (currentUser) {
      loadNGOCampaign();
    }
  }, [currentUser]);

  useEffect(() => {
    if (campaign) {
      // Set up real-time listener for donations to update wallet amounts automatically
      const donationsQuery = query(
        collection(db, "donations"),
        where("campaignId", "==", campaign.id)
      );
      
      const unsubscribe = onSnapshot(donationsQuery, (snapshot) => {
        const donationsData: Donation[] = [];
        snapshot.forEach((doc) => {
          donationsData.push({ id: doc.id, ...doc.data() } as Donation);
        });
        setDonations(donationsData.sort((a, b) => {
          const aTime = a.timestamp?.toDate?.()?.getTime() || 0;
          const bTime = b.timestamp?.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        }));
        
        // Recalculate used money when donations change
        calculateUsedMoney().then(setUsedMoney);
      }, (error) => {
        console.error("Error listening to donations:", error);
      });
      
      return () => unsubscribe();
    } else {
      // Reset donations when no campaign is selected
      setDonations([]);
    }
  }, [campaign]);

  useEffect(() => {
    if (selectedCampaignId && allCampaigns.length > 0) {
      const selected = allCampaigns.find(c => c.id === selectedCampaignId);
      if (selected) {
        setCampaign(selected);
      }
    } else if (allCampaigns.length > 0) {
      setSelectedCampaignId(allCampaigns[0].id);
      setCampaign(allCampaigns[0]);
    }
  }, [selectedCampaignId, allCampaigns]);

  useEffect(() => {
    if (campaign) {
      initializeConditionAllocations();
      loadGalleryImages();
      
      // Set up real-time listener for workProofs to update usedMoney automatically
      const proofQuery = query(
        collection(db, "workProofs"),
        where("campaignId", "==", campaign.id)
      );
      
      const unsubscribe = onSnapshot(proofQuery, async () => {
        // Recalculate used money when workProofs change
        // calculateUsedMoney now fetches fresh data, so no need for donations dependency
        const newUsedMoney = await calculateUsedMoney();
        setUsedMoney(newUsedMoney);
      }, (error) => {
        console.error("Error listening to workProofs:", error);
      });
      
      return () => unsubscribe();
    }
  }, [campaign]);

  const loadGalleryImages = async () => {
    if (!campaign) return;
    
    try {
      const ngoDocRef = doc(db, "ngos", campaign.id);
      const ngoDoc = await getDoc(ngoDocRef);
      
      if (ngoDoc.exists()) {
        const data = ngoDoc.data();
        setGalleryImages(data.galleryImages || []);
      }
    } catch (error) {
      console.error("Error loading gallery images:", error);
    }
  };

  const calculateUsedMoney = async () => {
    if (!campaign) return 0;
    try {
      // Fetch fresh workProofs data for this specific campaign
      const proofQuery = query(
        collection(db, "workProofs"),
        where("campaignId", "==", campaign.id)
      );
      const proofSnapshot = await getDocs(proofQuery);
      let totalUsed = 0;
      proofSnapshot.forEach((doc) => {
        const proof = doc.data();
        // Ensure proof belongs to this campaign
        if (proof.campaignId === campaign.id && proof.conditionAllocations) {
          const proofTotal = proof.conditionAllocations.reduce(
            (sum: number, alloc: { amount: number }) => {
              const amount = typeof alloc.amount === 'number' ? alloc.amount : Number(alloc.amount) || 0;
              return sum + amount;
            },
            0
          );
          totalUsed += proofTotal;
        }
      });
      
      // Fetch fresh donations data for this specific campaign to ensure accuracy
      const donationsQuery = query(
        collection(db, "donations"),
        where("campaignId", "==", campaign.id)
      );
      const donationsSnapshot = await getDocs(donationsQuery);
      let walletBalance = 0;
      donationsSnapshot.forEach((doc) => {
        const donation = doc.data();
        // Double-check campaignId matches
        if (donation.campaignId === campaign.id) {
          const amount = typeof donation.amount === 'number' ? donation.amount : Number(donation.amount) || 0;
          walletBalance += amount;
        }
      });
      
      // Cap used money at wallet balance
      return Math.min(totalUsed, walletBalance);
    } catch (error) {
      console.error("Error calculating used money:", error);
      return 0;
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !campaign) return;

    const newFiles = Array.from(files);
    if (newFiles.length + galleryImages.length > 20) {
      toast({
        title: "Too Many Images",
        description: "Maximum 20 images allowed in gallery.",
        variant: "destructive",
      });
      return;
    }

    try {
      setGalleryUploading(true);
      const uploadedUrls: string[] = [];

      for (const file of newFiles) {
        // Validate file
        if (!file || !file.type.startsWith('image/')) {
          toast({
            title: "Invalid File",
            description: `${file.name} is not a valid image file.`,
            variant: "destructive",
          });
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        
        // Add verification flags and conditions for image verification
        formData.append("verifyImage", "true");
        formData.append("requireVerification", "true");
        if (campaign && campaign.conditions && campaign.conditions.length > 0) {
          formData.append("conditions", JSON.stringify(campaign.conditions));
        }

        try {
          const response = await axios.post(getApiUrl("/api/upload-file"), formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          if (response.data.success && response.data.data) {
            const fileUrl = response.data.data.fileUrl || response.data.data.fullUrl;
            if (fileUrl) {
              if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
                const urlObj = new URL(fileUrl);
                uploadedUrls.push(urlObj.pathname);
              } else {
                uploadedUrls.push(fileUrl);
              }
            }
          }
        } catch (uploadError: any) {
          // Handle verification failure or upload error
          console.error("Image upload error:", uploadError);
          console.error("Error response:", uploadError.response?.data);
          console.error("Error status:", uploadError.response?.status);
          
          let errorMessage = "Unknown error occurred";
          
          if (uploadError.response?.data?.message) {
            errorMessage = uploadError.response.data.message;
          } else if (uploadError.message) {
            errorMessage = uploadError.message;
          }
          
          if (uploadError.response?.status === 400) {
            toast({
              title: "⚠️ Image Upload Failed",
              description: `${file.name}: ${errorMessage}`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Upload Failed",
              description: `Failed to upload ${file.name}: ${errorMessage}`,
              variant: "destructive",
            });
          }
          // Continue with next file
          continue;
        }
      }

      // Update NGO document with new gallery images
      const ngoDocRef = doc(db, "ngos", campaign.id);
      const updatedImages = [...galleryImages, ...uploadedUrls];
      await updateDoc(ngoDocRef, {
        galleryImages: updatedImages,
        galleryUpdatedAt: serverTimestamp(),
      });

      setGalleryImages(updatedImages);
      toast({
        title: "✅ Images Uploaded",
        description: `${uploadedUrls.length} image(s) added to gallery. All donors can now view them.`,
      });

      if (galleryFileInputRef) {
        galleryFileInputRef.value = "";
      }
    } catch (error: any) {
      console.error("Error uploading gallery images:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload images.",
        variant: "destructive",
      });
    } finally {
      setGalleryUploading(false);
    }
  };

  const removeGalleryImage = async (index: number) => {
    if (!campaign) return;

    try {
      const updatedImages = galleryImages.filter((_, i) => i !== index);
      const ngoDocRef = doc(db, "ngos", campaign.id);
      await updateDoc(ngoDocRef, {
        galleryImages: updatedImages,
        galleryUpdatedAt: serverTimestamp(),
      });

      setGalleryImages(updatedImages);
      toast({
        title: "✅ Image Removed",
        description: "Image removed from gallery.",
      });
    } catch (error: any) {
      console.error("Error removing gallery image:", error);
      toast({
        title: "Error",
        description: "Failed to remove image.",
        variant: "destructive",
      });
    }
  };

  const loadNGOCampaign = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      // Get all NGOs for this user (by email)
      const allNgosQuery = query(collection(db, "ngos"));
      const snapshot = await getDocs(allNgosQuery);
      
      const campaigns: NGOCampaign[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Match by owner email or owner UID to find all NGOs for this user
        // Support both old format (contact_email) and new format (owner_email, owner_uid)
        const matchesEmail = data.details?.contact_email === currentUser.email || 
                           data.owner_email === currentUser.email;
        const matchesUID = data.owner_uid === currentUser.uid;
        
        if (matchesEmail || matchesUID) {
          campaigns.push({
            id: docSnap.id,
            details: data.details,
            conditions: data.conditions || [],
            total_raised: data.total_raised || 0,
          });
        }
      });

      if (campaigns.length > 0) {
        setAllCampaigns(campaigns);
        setSelectedCampaignId(campaigns[0].id);
        setCampaign(campaigns[0]);
      } else {
        toast({
          title: "NGO Not Found",
          description: "Please register your NGO first.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error loading NGO campaigns:", error);
      toast({
        title: "Error",
        description: "Failed to load NGO campaigns.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDonations = async () => {
    if (!campaign) return;

    try {
      const donationsQuery = query(
        collection(db, "donations"),
        where("campaignId", "==", campaign.id)
      );
      const snapshot = await getDocs(donationsQuery);
      
      const donationsData: Donation[] = [];
      snapshot.forEach((doc) => {
        donationsData.push({
          id: doc.id,
          ...doc.data(),
        } as Donation);
      });

      setDonations(donationsData.sort((a, b) => {
        const aTime = a.timestamp?.toDate?.() || new Date(0);
        const bTime = b.timestamp?.toDate?.() || new Date(0);
        return bTime.getTime() - aTime.getTime();
      }));
    } catch (error) {
      console.error("Error loading donations:", error);
      toast({
        title: "Error",
        description: "Failed to load donations.",
        variant: "destructive",
      });
    }
  };

  const initializeConditionAllocations = () => {
    if (!campaign) return;

    // Initialize allocations for all conditions
    const allocations = campaign.conditions.map((condition) => ({
      condition: condition.title,
      amount: 0,
      percentage: 0,
    }));

    setConditionAllocations(allocations);
    setTotalUsedAmount(0);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    
    if (newFiles.length + proofPhotos.length > 10) {
      toast({
        title: "Too Many Photos",
        description: "Maximum 10 photos allowed.",
        variant: "destructive",
      });
      return;
    }

    const newPreviewUrls: string[] = [];
    let loadedCount = 0;
    
    // Create preview URLs
    newFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          newPreviewUrls[index] = e.target.result as string;
          loadedCount++;
          if (loadedCount === newFiles.length) {
            setProofPhotoUrls([...proofPhotoUrls, ...newPreviewUrls]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
    
    setProofPhotos([...proofPhotos, ...newFiles]);
  };

  const removePhoto = (index: number) => {
    setProofPhotos(proofPhotos.filter((_, i) => i !== index));
    setProofPhotoUrls(proofPhotoUrls.filter((_, i) => i !== index));
    // Remove verification status for this image
    const newStatus = new Map(imageVerificationStatus);
    newStatus.delete(index);
    // Reindex remaining statuses
    const reindexedStatus = new Map<number, { status: 'pending' | 'verifying' | 'verified' | 'failed'; message?: string }>();
    newStatus.forEach((value, key) => {
      if (key > index) {
        reindexedStatus.set(key - 1, value);
      } else {
        reindexedStatus.set(key, value);
      }
    });
    setImageVerificationStatus(reindexedStatus);
  };

  // Verify all images before submission
  const verifyAllImages = async () => {
    if (!campaign || proofPhotos.length === 0) {
      toast({
        title: "No Images",
        description: "Please select images to verify first.",
        variant: "destructive",
      });
      return;
    }

    // Get conditions that received allocations
    const allocatedConditions = conditionAllocations
      .filter(alloc => alloc.amount > 0)
      .map(alloc => {
        const fullCondition = campaign?.conditions?.find(c => c.title === alloc.condition);
        return fullCondition || { title: alloc.condition, description: '' };
      });

    if (allocatedConditions.length === 0) {
      toast({
        title: "No Allocations",
        description: "Please allocate money to at least one condition before verifying images.",
        variant: "destructive",
      });
      return;
    }

    setVerifyingImages(true);
    const verificationStatus = new Map<number, { status: 'pending' | 'verifying' | 'verified' | 'failed'; message?: string }>();

    // Initialize all as verifying
    proofPhotos.forEach((_, index) => {
      verificationStatus.set(index, { status: 'verifying' });
    });
    setImageVerificationStatus(verificationStatus);

    let allVerified = true;

    // Verify each image
    for (let index = 0; index < proofPhotos.length; index++) {
      const photo = proofPhotos[index];
      
      if (!photo || !photo.type.startsWith('image/')) {
        verificationStatus.set(index, {
          status: 'failed',
          message: 'Invalid image file'
        });
        allVerified = false;
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", photo);
        formData.append("verifyImage", "true");
        formData.append("requireVerification", "true");
        formData.append("conditions", JSON.stringify(allocatedConditions));
        formData.append("requireConditionMatch", "true");

        console.log(`Verifying image ${index + 1}/${proofPhotos.length}...`);
        console.log('Conditions being checked:', allocatedConditions.map(c => c.title).join(', '));

        const response = await axios.post(getApiUrl("/api/upload-file"), formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        console.log(`Image ${index + 1} verification response:`, {
          success: response.data.success,
          message: response.data.message,
          fileUrl: response.data.fileUrl ? 'Received' : 'Missing'
        });

        // Check if verification passed - success means both verification passed AND file uploaded
        // Backend returns { success: true, data: { fileUrl: ... }, message: ... }
        const fileUrl = response.data.data?.fileUrl || response.data.fileUrl;
        if (response.data.success === true && fileUrl) {
          verificationStatus.set(index, {
            status: 'verified',
            message: 'Image verified: Real photo matching allocated conditions'
          });
          console.log(`✅ Image ${index + 1} verified successfully`);
        } else {
          // Check if there's a specific verification error message
          const errorMsg = response.data.message || response.data.verification?.reason || 'Verification failed';
          verificationStatus.set(index, {
            status: 'failed',
            message: errorMsg
          });
          allVerified = false;
          console.error(`❌ Image ${index + 1} verification failed:`, errorMsg);
        }
      } catch (error: any) {
        // More detailed error handling
        const errorMessage = error.response?.data?.message || 
                           error.response?.data?.verification?.reason ||
                           error.message || 
                           'Verification failed';
        
        console.error(`❌ Image ${index + 1} verification error:`, {
          message: errorMessage,
          status: error.response?.status,
          data: error.response?.data
        });

        verificationStatus.set(index, {
          status: 'failed',
          message: errorMessage
        });
        allVerified = false;
      }

      // Update status after each verification
      setImageVerificationStatus(new Map(verificationStatus));
    }

    setVerifyingImages(false);

    if (allVerified) {
      toast({
        title: "✅ All Images Verified",
        description: `All ${proofPhotos.length} image(s) passed verification. They are real photos and match the allocated conditions.`,
      });
    } else {
      const failedCount = Array.from(verificationStatus.values()).filter(v => v.status === 'failed').length;
      toast({
        title: "⚠️ Verification Failed",
        description: `${failedCount} out of ${proofPhotos.length} image(s) failed verification. Please check the details and remove or replace failed images.`,
        variant: "destructive",
      });
    }
  };

  const updateConditionAllocation = (index: number, amount: number) => {
    const newAllocations = [...conditionAllocations];
    const otherAllocationsTotal = newAllocations
      .filter((_, i) => i !== index)
      .reduce((sum, alloc) => sum + alloc.amount, 0);
    
    // Calculate maximum allowed amount (remaining money = walletBalance - usedMoney)
    if (!campaign) return;
    const selectedDonations = donations.filter(d => d.campaignId === campaign.id);
    const walletBalance = selectedDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
    const remainingMoney = Math.max(0, walletBalance - usedMoney);
    
    // Maximum amount for this allocation = remaining money - other allocations
    const maxAllowed = remainingMoney - otherAllocationsTotal;
    
    // Ensure amount doesn't exceed remaining money
    const clampedAmount = Math.max(0, Math.min(amount, maxAllowed));
    newAllocations[index].amount = clampedAmount;
    
    // If amount was clamped, show a warning
    if (amount > maxAllowed && maxAllowed >= 0) {
      toast({
        title: "Amount Limited",
        description: `Maximum amount available for allocation is ₹${maxAllowed.toLocaleString()}. Total allocated cannot exceed total received (₹${walletBalance.toLocaleString()}) minus already used (₹${usedMoney.toLocaleString()}).`,
        variant: "default",
      });
    }
    
    // Recalculate total and percentages
    const totalAllocated = newAllocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    setTotalUsedAmount(totalAllocated);
    
    if (totalAllocated > 0) {
      newAllocations.forEach((alloc) => {
        alloc.percentage = (alloc.amount / totalAllocated) * 100;
      });
    } else {
      newAllocations.forEach((alloc) => {
        alloc.percentage = 0;
      });
    }

    setConditionAllocations(newAllocations);
  };

  const handleSubmitProof = async () => {
    if (!campaign || !currentUser) return;

    // Validate allocations
    const totalAllocated = conditionAllocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    
    if (totalAllocated <= 0) {
      toast({
        title: "Invalid Allocation",
        description: "Please allocate at least some amount to at least one condition.",
        variant: "destructive",
      });
      return;
    }

    // Validate that total allocated doesn't exceed available balance
    if (!campaign) return;
    const selectedDonations = donations.filter(d => d.campaignId === campaign.id);
    const walletBalance = selectedDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
    const remainingMoney = Math.max(0, walletBalance - usedMoney);
    
    if (totalAllocated > remainingMoney) {
      toast({
        title: "Insufficient Balance",
        description: `Total allocated amount (₹${totalAllocated.toLocaleString()}) exceeds available balance (₹${remainingMoney.toLocaleString()}). Amount received is ₹${walletBalance.toLocaleString()} and ₹${usedMoney.toLocaleString()} has already been used.`,
        variant: "destructive",
      });
      return;
    }

    if (proofPhotos.length === 0) {
      toast({
        title: "Photos Required",
        description: "Please upload at least one photo as proof of work.",
        variant: "destructive",
      });
      return;
    }

    // Check if all images are verified
    const unverifiedCount = Array.from(imageVerificationStatus.values()).filter(v => v.status !== 'verified').length;
    if (unverifiedCount > 0 || imageVerificationStatus.size !== proofPhotos.length) {
      toast({
        title: "Images Not Verified",
        description: "Please verify all images before submission. Click 'Verify Images' button to check if images are AI-generated and match the allocated conditions.",
        variant: "destructive",
      });
      return;
    }

    // Check if any image failed verification
    const failedCount = Array.from(imageVerificationStatus.values()).filter(v => v.status === 'failed').length;
    if (failedCount > 0) {
      toast({
        title: "Verification Failed",
        description: `${failedCount} image(s) failed verification. Please remove or replace failed images before submission.`,
        variant: "destructive",
      });
      return;
    }

    if (!proofDescription.trim()) {
      toast({
        title: "Description Required",
        description: "Please provide a description of the work done.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      // Upload photos
      const uploadedPhotoUrls: string[] = [];
      
      for (const photo of proofPhotos) {
        // Validate file
        if (!photo || !photo.type.startsWith('image/')) {
          toast({
            title: "Invalid File",
            description: "One of the selected files is not a valid image.",
            variant: "destructive",
          });
          continue;
        }

        const formData = new FormData();
        formData.append("file", photo);
        
        // Add verification flags and conditions for image verification
        // Only verify against conditions that received allocations in this proof
        formData.append("verifyImage", "true");
        formData.append("requireVerification", "true");
        
        // Get conditions that received allocations (amount > 0)
        const allocatedConditions = conditionAllocations
          .filter(alloc => alloc.amount > 0)
          .map(alloc => {
            // Find the full condition details from campaign.conditions
            const fullCondition = campaign?.conditions?.find(c => c.title === alloc.condition);
            return fullCondition || { title: alloc.condition, description: '' };
          });
        
        // Only verify if there are allocated conditions
        if (allocatedConditions.length > 0) {
          formData.append("conditions", JSON.stringify(allocatedConditions));
          formData.append("requireConditionMatch", "true"); // Flag to require strict condition matching
        } else if (campaign && campaign.conditions && campaign.conditions.length > 0) {
          // Fallback: use all conditions if no allocations specified
          formData.append("conditions", JSON.stringify(campaign.conditions));
        }

        try {
          const response = await axios.post(getApiUrl("/api/upload-file"), formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          if (response.data.success && response.data.data) {
            // The backend returns { success: true, data: { fileUrl: "/api/file/:fileId" } }
            // Store relative URL in Firestore, convert to full URL when displaying
            const fileUrl = response.data.data.fileUrl || response.data.data.fullUrl;
            if (fileUrl) {
              // Store relative URL (starts with /api/file/) - convert to full URL only when displaying
              // If it's already a full URL, extract the relative part
              if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
                // Extract relative path from full URL
                const urlObj = new URL(fileUrl);
                uploadedPhotoUrls.push(urlObj.pathname);
              } else {
                // Already relative, store as-is
                uploadedPhotoUrls.push(fileUrl);
              }
            }
          } else if (response.data.url) {
            // Fallback for old format
            const url = response.data.url;
            if (url.startsWith("http://") || url.startsWith("https://")) {
              const urlObj = new URL(url);
              uploadedPhotoUrls.push(urlObj.pathname);
            } else {
              uploadedPhotoUrls.push(url);
            }
          }
        } catch (uploadError: any) {
          // Handle verification failure or upload error
          if (uploadError.response?.status === 400 && uploadError.response?.data?.message) {
            toast({
              title: "⚠️ Image Verification Failed",
              description: uploadError.response.data.message,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Upload Failed",
              description: uploadError.message || "Failed to upload image",
              variant: "destructive",
            });
          }
          // Continue with next photo
          continue;
        }
      }

      // Create general work proof document (visible to all donors who donated to this NGO)
      const proofData: Omit<WorkProof, "id"> = {
        donationId: "", // Empty - general proof for all donations to this NGO
        userId: "", // Empty - visible to all donors
        campaignId: campaign.id,
        conditionAllocations: conditionAllocations.filter(alloc => alloc.amount > 0),
        photos: uploadedPhotoUrls,
        description: proofDescription,
        timestamp: serverTimestamp(),
        status: "pending",
      };

      await addDoc(collection(db, "workProofs"), proofData);

      // Recalculate used money immediately after submission to update wallet amounts
      const newUsedMoney = await calculateUsedMoney();
      setUsedMoney(newUsedMoney);

      toast({
        title: "✅ Proof Submitted!",
        description: "Work proof has been submitted. All donors for this NGO can now view how their money was used.",
      });

      // Reset form
      setShowProofDialog(false);
      setProofPhotos([]);
      setProofPhotoUrls([]);
      setConditionAllocations([]);
      setTotalUsedAmount(0);
      setProofDescription("");
      setImageVerificationStatus(new Map());
      
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Reinitialize allocations
      initializeConditionAllocations();
    } catch (error: any) {
      console.error("Error submitting proof:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit work proof.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleOpenProofDialog = () => {
    setShowProofDialog(true);
    initializeConditionAllocations();
  };

  // Calculate wallet stats for selected NGO - use memoized calculations for accuracy
  // IMPORTANT: This hook must be called before any early returns to maintain hook order
  const walletStats = useMemo(() => {
    if (!campaign) {
      return {
        walletBalance: 0,
        cappedUsedMoney: 0,
        remainingMoney: 0,
        totalRaised: 0,
        proofsSubmitted: 0,
        donationCount: 0,
      };
    }
    
    // Filter donations for this specific campaign only
    // Note: donations state is already filtered by the listener, but double-check for safety
    const selectedDonations = donations.filter(d => {
      // Ensure campaignId matches exactly
      return d.campaignId === campaign.id && d.amount != null;
    });
    
    // Calculate total raised - ensure all amounts are numbers
    const totalRaised = selectedDonations.reduce((sum, d) => {
      const amount = typeof d.amount === 'number' ? d.amount : Number(d.amount) || 0;
      return sum + amount;
    }, 0);
    
    const proofsSubmitted = selectedDonations.filter((d) => d.proofSubmitted).length;
    const walletBalance = totalRaised; // Total money recorded/received
    
    // Ensure used money never exceeds wallet balance
    const cappedUsedMoney = Math.min(usedMoney, walletBalance);
    const remainingMoney = Math.max(0, walletBalance - cappedUsedMoney); // Money received but not yet justified (never negative)
    
    return {
      walletBalance,
      cappedUsedMoney,
      remainingMoney,
      totalRaised,
      proofsSubmitted,
      donationCount: selectedDonations.length,
    };
  }, [campaign?.id, donations, usedMoney]);
  
  // Extract values for cleaner code
  const { walletBalance, cappedUsedMoney, remainingMoney, totalRaised, proofsSubmitted } = walletStats;

  // Early returns AFTER all hooks have been called
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600">Please login to access NGO dashboard.</p>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600 mb-4">No NGO campaign found for your account.</p>
              <Button asChild>
                <a href="/register-ngo">Register NGO</a>
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <div className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">NGO Dashboard</h1>
          <p className="text-gray-600">Manage your deployed organizations and submit work proofs</p>
        </div>

        {/* NGO Selector - Clickable Cards */}
        {allCampaigns.length > 1 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-black mb-4">My Organizations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allCampaigns.map((camp) => {
                const campDonations = donations.filter(d => d.campaignId === camp.id);
                const campTotal = campDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
                const isSelected = selectedCampaignId === camp.id;
                
                return (
                  <Card
                    key={camp.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      isSelected ? "border-2 border-black bg-gray-50" : "hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedCampaignId(camp.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-black mb-1">{camp.details.ngo_name}</h3>
                          <p className="text-sm text-gray-600 line-clamp-2">{camp.details.description}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-5 w-5 text-black flex-shrink-0 ml-2" />
                        )}
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Received</span>
                          <span className="font-bold text-black">₹{campTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-600">Donations</span>
                          <span className="font-semibold text-black">{campDonations.length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Wallet & Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-2 border-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Total Amount Received
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-black">
                ₹{walletBalance.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mt-1">Total Money Recorded</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Amount Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                ₹{cappedUsedMoney.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Money utilized with proof
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                Amount Remaining
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">
                ₹{remainingMoney.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Money available for use
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Total Donations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-black">{donations.length}</p>
              <p className="text-sm text-gray-600 mt-1">All Payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Proofs Submitted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-black">{proofsSubmitted}</p>
              <p className="text-sm text-gray-600 mt-1">Donations with proofs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Pending Proofs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">
                {donations.length - proofsSubmitted}
              </p>
              <p className="text-sm text-gray-600 mt-1">Donations without proofs</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "organization" | "proofs" | "gallery")}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              My Deployed Organization
            </TabsTrigger>
            <TabsTrigger value="proofs" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Submit Work Proofs
            </TabsTrigger>
            <TabsTrigger value="gallery" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Image Gallery
            </TabsTrigger>
          </TabsList>

          {/* My Deployed Organization Tab */}
          <TabsContent value="organization" className="space-y-6">
            {/* Organization Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organization Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-black mb-1">
                      {campaign.details.ngo_name}
                    </h3>
                    <p className="text-gray-600">{campaign.details.description}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label className="text-gray-600">Category</Label>
                      <p className="font-semibold text-black">
                        {campaign.details.donation_category || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Contact Email</Label>
                      <p className="text-black">{campaign.details.contact_email || "N/A"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Funding Conditions */}
            <Card>
              <CardHeader>
                <CardTitle>Funding Conditions</CardTitle>
                <CardDescription>Conditions for which donations are being accepted</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campaign.conditions.map((condition, index) => (
                    <Card key={index} className="bg-gray-50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-black">{condition.title}</h4>
                          <Badge
                            variant="outline"
                            className={
                              condition.priority === "High"
                                ? "bg-red-100 text-red-800"
                                : condition.priority === "Medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }
                          >
                            {condition.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{condition.description}</p>
                        <p className="text-sm font-semibold text-black">
                          Goal: ₹{condition.fund_estimate.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* All Payments Received */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  All Payment Details Received
                </CardTitle>
                <CardDescription>
                  Complete list of all donations received for your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                {donations.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No donations received yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Donation ID</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Condition</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {donations.map((donation) => (
                          <TableRow key={donation.id}>
                            <TableCell className="font-medium">
                              {formatDate(donation.timestamp)}
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {donation.id.slice(0, 8)}...
                              </code>
                            </TableCell>
                            <TableCell className="font-semibold text-black">
                              ₹{donation.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{donation.condition}</Badge>
                            </TableCell>
                            <TableCell>
                              {donation.proofSubmitted ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                                  Proof Submitted
                                </Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-800">
                                  Pending Proof
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {donation.timestamp?.toDate?.()?.toLocaleDateString() || "N/A"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Submit Proofs Tab */}
          <TabsContent value="proofs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Submit Work Proof</CardTitle>
                <CardDescription>
                  Upload photos and show how donated money was used by allocating amounts across conditions.
                  This proof will be visible to all donors who contributed to this organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-6 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-black mb-2">
                          Submit General Work Proof
                        </h3>
                        <p className="text-sm text-gray-600">
                          Upload proof photos and allocate how much money was used for each condition.
                          All donors for {campaign?.details.ngo_name} will be able to see this proof.
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          initializeConditionAllocations();
                          setShowProofDialog(true);
                        }}
                        className="bg-black text-white"
                        disabled={!campaign}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Submit Proof
                      </Button>
                    </div>
                  </div>
                  
                  {donations.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-black mb-3">Recent Donations</h4>
                      <div className="space-y-2">
                        {donations.slice(0, 5).map((donation) => (
                          <div key={donation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <span className="font-semibold text-black">
                                ₹{donation.amount.toLocaleString()}
                              </span>
                              <span className="text-sm text-gray-600 ml-3">
                                {formatDate(donation.timestamp)}
                              </span>
                            </div>
                            <Badge variant="outline">{donation.condition}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Image Gallery Tab */}
          <TabsContent value="gallery" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Image Gallery</CardTitle>
                <CardDescription>
                  Upload images that will be visible to all donors who contributed to this organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <Label htmlFor="gallery-upload" className="cursor-pointer">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={galleryUploading || galleryImages.length >= 20}
                      onClick={() => {
                        const input = document.getElementById('gallery-upload') as HTMLInputElement;
                        input?.click();
                      }}
                    >
                      {galleryUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Images ({galleryImages.length}/20)
                        </>
                      )}
                    </Button>
                  </Label>
                  <input
                    ref={(el) => setGalleryFileInputRef(el)}
                    type="file"
                    id="gallery-upload"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleGalleryUpload}
                    disabled={galleryUploading || galleryImages.length >= 20}
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    Upload up to 20 images. All donors for {campaign?.details.ngo_name} will be able to view these images.
                  </p>
                </div>

                {galleryImages.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {galleryImages.map((imageUrl, index) => {
                      const fullUrl = imageUrl.startsWith('/api/file/') || imageUrl.startsWith('/api/')
                        ? getApiUrl(imageUrl)
                        : imageUrl;

                      return (
                        <div key={index} className="relative group">
                          <img
                            src={fullUrl}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(fullUrl, '_blank')}
                            onError={(e) => {
                              console.error("Image load error:", fullUrl);
                              e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='14' fill='%236b7280'%3EImage not found%3C/text%3E%3C/svg%3E";
                            }}
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeGalleryImage(index);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <ImageIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600 mb-2">No images in gallery yet</p>
                    <p className="text-sm text-gray-500">Upload images to share with your donors</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Submit Proof Dialog */}
      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Work Proof</DialogTitle>
            <DialogDescription>
              Upload photos and allocate money used across conditions. This proof will be visible to all donors who contributed to {campaign?.details.ngo_name}.
            </DialogDescription>
          </DialogHeader>

          {campaign && (
            <div className="space-y-6 py-4">
              {/* Organization Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Organization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label className="text-gray-600">NGO Name</Label>
                    <p className="font-semibold text-black">
                      {campaign.details.ngo_name}
                    </p>
                  </div>
                  <div className="mt-2">
                    <Label className="text-gray-600">Total Received</Label>
                    <p className="font-semibold text-black">
                      ₹{donations.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Photo Upload */}
              <div>
                <Label>Work Proof Photos (Required)</Label>
                <div className="mt-2 space-y-4">
                  {/* Verify Images Button */}
                  {proofPhotos.length > 0 && (
                    <div className="mb-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={verifyAllImages}
                        disabled={verifyingImages || conditionAllocations.filter(a => a.amount > 0).length === 0}
                        className="w-full"
                      >
                        {verifyingImages ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying Images...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Verify Images (Check AI & Condition Match)
                          </>
                        )}
                      </Button>
                      {conditionAllocations.filter(a => a.amount > 0).length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Please allocate money to conditions first
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4">
                    {proofPhotoUrls.map((url, index) => {
                      const verification = imageVerificationStatus.get(index);
                      const status = verification?.status || 'pending';
                      return (
                        <div key={index} className="relative">
                          <img
                            src={url}
                            alt={`Proof ${index + 1}`}
                            className={`w-32 h-32 object-cover rounded-lg border-2 ${
                              status === 'verified' ? 'border-green-500' :
                              status === 'failed' ? 'border-red-500' :
                              status === 'verifying' ? 'border-yellow-500 animate-pulse' :
                              'border-gray-300'
                            }`}
                          />
                          {/* Status Badge */}
                          {status !== 'pending' && (
                            <div className={`absolute top-1 left-1 px-2 py-1 rounded text-xs font-semibold ${
                              status === 'verified' ? 'bg-green-500 text-white' :
                              status === 'failed' ? 'bg-red-500 text-white' :
                              'bg-yellow-500 text-white'
                            }`}>
                              {status === 'verified' ? '✓ Verified' :
                               status === 'failed' ? '✗ Failed' :
                               'Verifying...'}
                            </div>
                          )}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={() => removePhoto(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          {/* Error message tooltip */}
                          {status === 'failed' && verification?.message && (
                            <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-xs p-2 rounded-b-lg z-10 max-h-20 overflow-y-auto">
                              {verification.message.substring(0, 80)}
                              {verification.message.length > 80 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {proofPhotos.length < 10 && (
                      <label className="cursor-pointer">
                        <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 transition-colors">
                          <Camera className="h-8 w-8 text-gray-400" />
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Upload at least one photo showing the work done (Max 10 photos). 
                    <strong className="text-black"> Click "Verify Images" to check if images are AI-generated and match allocated conditions before submission.</strong>
                  </p>
                </div>
              </div>

              {/* Condition Allocations */}
              <div>
                <Label>Allocate Money Used Across Conditions</Label>
                <p className="text-sm text-gray-600 mb-4">
                  Enter how much money was used for each condition. This shows all donors how their contributions were utilized.
                </p>
                <div className="space-y-4">
                  {conditionAllocations.map((allocation, index) => {
                    const condition = campaign.conditions[index];
                    if (!condition) return null;

                    return (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-semibold text-black">{condition.title}</h4>
                              <p className="text-sm text-gray-600">{condition.description}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor={`amount-${index}`}>Amount Used (₹)</Label>
                                <Input
                                  id={`amount-${index}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={allocation.amount}
                                  onChange={(e) =>
                                    updateConditionAllocation(
                                      index,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <Label>Percentage</Label>
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-black h-2 rounded-full transition-all"
                                      style={{ width: `${allocation.percentage}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-semibold text-black min-w-[50px]">
                                    {allocation.percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  <Alert>
                    <AlertDescription>
                      <div className="flex justify-between items-center">
                        <span>
                          Total Allocated: ₹
                          {conditionAllocations
                            .reduce((sum, alloc) => sum + alloc.amount, 0)
                            .toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-600">
                          All donors can see this breakdown
                        </span>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="proof-description">Work Description (Required)</Label>
                <textarea
                  id="proof-description"
                  className="w-full mt-2 min-h-[100px] p-3 border rounded-lg"
                  value={proofDescription}
                  onChange={(e) => setProofDescription(e.target.value)}
                  placeholder="Describe the work done, where it was performed, who benefited, etc."
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowProofDialog(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitProof}
                  disabled={uploading}
                  className="bg-black text-white"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Submit Proof
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default NGODashboard;

