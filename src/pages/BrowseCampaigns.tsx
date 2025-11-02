import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  increment,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Filter,
  Heart,
  TrendingUp,
  CheckCircle2,
  DollarSign,
  Calendar,
  Users,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Types
interface FundingCondition {
  title: string;
  description: string;
  fund_estimate: number;
  priority: "High" | "Medium" | "Low";
  raised?: number;
}

interface NGOCampaign {
  id: string;
  profile: {
    name: string;
    dob: string;
    gender: string;
    address: string;
    id_number: string;
    id_type: string;
    verified: boolean;
    profile_photo_url: string;
  };
  details: {
    ngo_name: string;
    description: string;
    donation_category: string;
    contact_email: string;
    contact_phone: string;
  };
  conditions: FundingCondition[];
  status: string;
  created_at: any;
  updated_at: any;
  total_raised?: number;
  total_goal?: number;
}

interface Transaction {
  id: string;
  userId: string;
  campaignId: string;
  ngoId: string;
  condition: string;
  amount: number;
  timestamp: any;
}

const COLORS = ['#000000', '#4a4a4a', '#8a8a8a', '#c0c0c0'];

const BrowseCampaigns = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<NGOCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<NGOCampaign | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [donations, setDonations] = useState<Transaction[]>([]);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showDonationDialog, setShowDonationDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [donationAmount, setDonationAmount] = useState<string>("");
  const [paymentPassword, setPaymentPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [selectedCondition, setSelectedCondition] = useState<FundingCondition | undefined>(undefined);
  const [pendingDonation, setPendingDonation] = useState<{campaign: NGOCampaign, condition?: FundingCondition, amount: number} | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [completedDonation, setCompletedDonation] = useState<{campaign: NGOCampaign, amount: number} | null>(null);

  // Fetch campaigns from Firestore with real-time listener
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    
    let q = query(collection(db, "ngos"));
    
    // Apply filters
    const filters: any[] = [];
    if (selectedCategory !== "all") {
      filters.push(where("details.donation_category", "==", selectedCategory));
    }
    
    // Note: Firestore doesn't support OR queries easily, so we'll filter verified in client
    if (filters.length > 0) {
      q = query(collection(db, "ngos"), ...filters);
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Check if component is still mounted before processing
      if (!isMounted) {
        return;
      }

      try {
        const campaignsData: NGOCampaign[] = [];
        
        for (const docSnap of snapshot.docs) {
          // Check mounted status before each async operation
          if (!isMounted) {
            return;
          }

          const data = docSnap.data() as Omit<NGOCampaign, "id">;
          
          // Client-side verified filter
          if (verifiedOnly && !data.profile?.verified) {
            continue;
          }
          
          // Calculate totals
          const totalGoal = data.conditions?.reduce((sum, cond) => sum + (cond.fund_estimate || 0), 0) || 0;
          
          // Fetch donations for this campaign
          const donationsQuery = query(
            collection(db, "donations"),
            where("campaignId", "==", docSnap.id)
          );
          const donationsSnapshot = await getDocs(donationsQuery);
          
          // Check mounted status after async operation
          if (!isMounted) {
            return;
          }

          const campaignDonations = donationsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Transaction[];
          
          // Calculate raised amounts per condition
          const conditionRaised: Record<string, number> = {};
          campaignDonations.forEach(donation => {
            if (donation.condition) {
              conditionRaised[donation.condition] = (conditionRaised[donation.condition] || 0) + donation.amount;
            }
          });
          
          // Update conditions with raised amounts
          const conditionsWithRaised = data.conditions?.map(cond => ({
            ...cond,
            raised: conditionRaised[cond.title] || 0
          })) || [];
          
          const totalRaised = campaignDonations.reduce((sum, d) => sum + d.amount, 0);
          
          // Get total_raised from document or use calculated value
          const documentTotalRaised = data.total_raised || 0;
          const finalTotalRaised = documentTotalRaised > 0 ? documentTotalRaised : totalRaised;
          
          campaignsData.push({
            id: docSnap.id,
            ...data,
            conditions: conditionsWithRaised,
            total_raised: finalTotalRaised,
            total_goal: totalGoal,
          });
        }
        
        // Final mounted check before state updates
        if (!isMounted) {
          return;
        }
        
        // Show all registered campaigns (including completed ones)
        // Only ensure campaign has required data (details, conditions) to appear
        const allCampaigns = campaignsData.filter(campaign => {
          // Must have NGO details and conditions to be shown
          if (!campaign.details?.ngo_name || !campaign.conditions || campaign.conditions.length === 0) {
            return false;
          }
          return true; // Show all campaigns that have required data
        });
        
        // Apply search filter
        let filtered = allCampaigns;
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          filtered = allCampaigns.filter(campaign =>
            campaign.details.ngo_name.toLowerCase().includes(query) ||
            campaign.details.description.toLowerCase().includes(query) ||
            campaign.details.donation_category.toLowerCase().includes(query)
          );
        }
        
        setCampaigns(filtered);
        setLoading(false);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.error("Error processing campaigns:", error);
        toast({
          title: "Error",
          description: "Failed to process campaigns. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
      }
    }, (error) => {
      if (!isMounted) {
        return;
      }
      console.error("Error fetching campaigns:", error);
      toast({
        title: "Error",
        description: "Failed to load campaigns. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [selectedCategory, verifiedOnly, searchQuery, toast]);

  // Load donations when details modal opens
  useEffect(() => {
    if (selectedCampaign && isDetailsOpen) {
      const loadDonations = async () => {
        const donationsQuery = query(
          collection(db, "donations"),
          where("campaignId", "==", selectedCampaign.id)
        );
        const donationsSnapshot = await getDocs(donationsQuery);
        const donationsData = donationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        setDonations(donationsData);
      };
      loadDonations();
    }
  }, [selectedCampaign, isDetailsOpen]);

  const handleViewDetails = (campaign: NGOCampaign) => {
    setSelectedCampaign(campaign);
    setIsDetailsOpen(true);
  };

  const handleDonateClick = (campaign: NGOCampaign, condition?: FundingCondition) => {
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "Please login to make a donation.",
        variant: "destructive",
      });
      return;
    }

    // Check if condition goal is reached
    if (condition) {
      const conditionRaised = condition.raised || 0;
      const conditionGoal = condition.fund_estimate || 0;
      
      if (conditionRaised >= conditionGoal && conditionGoal > 0) {
        toast({
          title: "Donation Limit Reached",
          description: `The funding goal for "${condition.title}" has been reached. Thank you for your interest!`,
          variant: "destructive",
        });
        return;
      }
    }

    // Check if campaign total goal is reached AND all conditions are fulfilled
    // Allow donations if at least one condition still needs funding
    const campaignRaised = campaign.total_raised || 0;
    const campaignGoal = campaign.total_goal || 0;
    
    // Check if there are any conditions that haven't reached their goals
    const availableConditions = (campaign.conditions || []).filter((cond) => {
      const conditionRaised = cond.raised || 0;
      const conditionGoal = cond.fund_estimate || 0;
      return conditionGoal === 0 || conditionRaised < conditionGoal;
    });
    
    // Only block if all conditions are fulfilled AND total goal is reached
    if (availableConditions.length === 0 && campaignRaised >= campaignGoal && campaignGoal > 0) {
      toast({
        title: "All Goals Reached",
        description: `All conditions and the campaign goal for "${campaign.details.ngo_name}" have been reached. Thank you for your interest!`,
        variant: "destructive",
      });
      return;
    }
    
    // If total goal is reached but some conditions still need funding, allow donations
    // (The donation will be distributed only to available conditions)

    // Store selected campaign and condition
    setSelectedCondition(condition);
    setPendingDonation({ campaign, condition, amount: 0 });
    
    // Set default amount from condition or empty
    if (condition?.fund_estimate) {
      setDonationAmount(condition.fund_estimate.toString());
    } else {
      setDonationAmount("");
    }
    
    // Show donation amount input dialog
    setShowDonationDialog(true);
  };

  const handleAmountConfirm = async () => {
    const amount = parseFloat(donationAmount);
    
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid donation amount.",
        variant: "destructive",
      });
      return;
    }

    if (amount < 1) {
      toast({
        title: "Minimum Amount",
        description: "Minimum donation amount is ₹1.",
        variant: "destructive",
      });
      return;
    }

    if (!pendingDonation || !currentUser) return;

    const { campaign, condition } = pendingDonation;

    // Check if condition goal will be exceeded
    if (condition) {
      const conditionRaised = condition.raised || 0;
      const conditionGoal = condition.fund_estimate || 0;
      
      if (conditionGoal > 0) {
        const remainingAmount = conditionGoal - conditionRaised;
        
        if (conditionRaised >= conditionGoal) {
          toast({
            title: "Donation Limit Reached",
            description: `The funding goal for "${condition.title}" has been reached. Thank you for your interest!`,
            variant: "destructive",
          });
          setShowDonationDialog(false);
          return;
        }
        
        if (amount > remainingAmount) {
          toast({
            title: "Amount Exceeds Goal",
            description: `The maximum donation amount for "${condition.title}" is ₹${remainingAmount.toLocaleString()}. The funding goal is ₹${conditionGoal.toLocaleString()} and ₹${conditionRaised.toLocaleString()} has already been raised.`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Check if campaign total goal will be exceeded
    // Allow donations if at least one condition still needs funding
    const campaignRaised = campaign.total_raised || 0;
    const campaignGoal = campaign.total_goal || 0;
    
    // Check if there are any conditions that haven't reached their goals
    const availableConditions = (campaign.conditions || []).filter((cond) => {
      const conditionRaised = cond.raised || 0;
      const conditionGoal = cond.fund_estimate || 0;
      return conditionGoal === 0 || conditionRaised < conditionGoal;
    });
    
    if (campaignGoal > 0) {
      const remainingAmount = campaignGoal - campaignRaised;
      
      // Only block if all conditions are fulfilled AND total goal is reached
      if (availableConditions.length === 0 && campaignRaised >= campaignGoal) {
        toast({
          title: "All Goals Reached",
          description: `All conditions and the campaign goal for "${campaign.details.ngo_name}" have been reached. Thank you for your interest!`,
          variant: "destructive",
        });
        setShowDonationDialog(false);
        return;
      }
      
      // If no conditions are available and amount exceeds remaining, block
      if (availableConditions.length === 0 && amount > remainingAmount) {
        toast({
          title: "Amount Exceeds Goal",
          description: `The maximum donation amount for this campaign is ₹${remainingAmount.toLocaleString()}. The campaign goal is ₹${campaignGoal.toLocaleString()} and ₹${campaignRaised.toLocaleString()} has already been raised.`,
          variant: "destructive",
        });
        return;
      }
      
      // If conditions are available but amount exceeds total goal, allow but will be adjusted later
      // (The donation will be distributed only to available conditions)
    }

    // Check if user has payment password set
    const userProfileRef = doc(db, "users", currentUser.uid);
    const userProfileDoc = await getDoc(userProfileRef);
    
    if (userProfileDoc.exists() && userProfileDoc.data().paymentPassword) {
      // User has payment password, ask for it
      setPendingDonation({ ...pendingDonation, amount });
      setShowDonationDialog(false);
      setPaymentPassword("");
      setPasswordError("");
      setShowPasswordDialog(true);
    } else {
      // No payment password set, show setup message
      toast({
        title: "Payment Password Required",
        description: "Please set a payment password in your profile first.",
        variant: "destructive",
      });
      return;
    }
  };

  const handlePasswordVerify = async () => {
    if (!currentUser || !pendingDonation) return;

    if (!paymentPassword) {
      setPasswordError("Please enter your payment password");
      return;
    }

    try {
      // Verify payment password
      const userProfileRef = doc(db, "users", currentUser.uid);
      const userProfileDoc = await getDoc(userProfileRef);
      
      if (!userProfileDoc.exists()) {
        setPasswordError("User profile not found");
        return;
      }

      const storedPassword = userProfileDoc.data().paymentPassword;
      if (storedPassword !== paymentPassword) {
        setPasswordError("Incorrect payment password");
        return;
      }

      // Password verified, proceed with payment
      setShowPasswordDialog(false);
      setPaymentPassword("");
      setPasswordError("");
      await handlePaymentConfirm();
    } catch (error: any) {
      setPasswordError(error.message || "Failed to verify password");
    }
  };

  const handlePaymentConfirm = async () => {
    if (!currentUser || !pendingDonation) return;

    // Final check before processing payment - verify goals haven't been reached
    const amount = pendingDonation.amount;
    const campaign = pendingDonation.campaign;
    const condition = pendingDonation.condition;

    // Re-check condition goal
    if (condition) {
      const conditionRaised = condition.raised || 0;
      const conditionGoal = condition.fund_estimate || 0;
      
      if (conditionGoal > 0) {
        const remainingAmount = conditionGoal - conditionRaised;
        
        if (conditionRaised >= conditionGoal || amount > remainingAmount) {
          toast({
            title: "Donation Limit Reached",
            description: `The funding goal for "${condition.title}" has been reached. Thank you for your interest!`,
            variant: "destructive",
          });
          setProcessingPayment(false);
          setShowPasswordDialog(false);
          return;
        }
      }
    }

    // Re-check campaign total goal - only block if total goal is reached
    // Individual conditions can still accept donations if they haven't reached their goals
    const campaignRaised = campaign.total_raised || 0;
    const campaignGoal = campaign.total_goal || 0;
    
    // Check if there are any available conditions that haven't reached their goals
    const availableConditions = (campaign.conditions || []).filter((cond) => {
      const conditionRaised = cond.raised || 0;
      const conditionGoal = cond.fund_estimate || 0;
      return conditionGoal === 0 || conditionRaised < conditionGoal;
    });
    
    // Only block if:
    // 1. Campaign total goal is reached AND all individual condition goals are reached, OR
    // 2. Campaign total goal is reached and donation would exceed it
    if (campaignGoal > 0) {
      const remainingAmount = campaignGoal - campaignRaised;
      
      // If all conditions are fulfilled AND total goal is reached, block donation
      if (availableConditions.length === 0 && campaignRaised >= campaignGoal) {
        toast({
          title: "All Goals Reached",
          description: `All conditions and the campaign goal for "${campaign.details.ngo_name}" have been reached. Thank you for your interest!`,
          variant: "destructive",
        });
        setProcessingPayment(false);
        setShowPasswordDialog(false);
        return;
      }
      
      // If total goal would be exceeded and no conditions are available, block
      if (availableConditions.length === 0 && amount > remainingAmount) {
        toast({
          title: "Donation Limit Reached",
          description: `The campaign "${campaign.details.ngo_name}" has reached its funding goal. Thank you for your interest and visit!`,
          variant: "destructive",
        });
        setProcessingPayment(false);
        setShowPasswordDialog(false);
        return;
      }
      
      // If donation would exceed total goal, adjust it (but still allow if conditions need funding)
      if (amount > remainingAmount && remainingAmount > 0 && availableConditions.length > 0) {
        // This will be handled in the total_raised update logic
        // Don't block here if there are available conditions
      }
    }

    setProcessingPayment(true);

    try {

      // 1. Save donation transaction to Firestore
      const donationRef = await addDoc(collection(db, "donations"), {
        userId: currentUser.uid,
        campaignId: campaign.id,
        ngoId: campaign.id,
        condition: condition?.title || "General",
        amount: amount,
        timestamp: serverTimestamp(),
        status: "success",
      });

      // 2. Auto-divide donation equally across all conditions that haven't reached their goals
      const conditions = campaign.conditions || [];
      
      // Filter out conditions that have already reached their goals
      const availableConditions = conditions.filter((cond) => {
        const conditionRaised = cond.raised || 0;
        const conditionGoal = cond.fund_estimate || 0;
        // Include condition if no goal is set (goal = 0) or if goal hasn't been reached
        return conditionGoal === 0 || conditionRaised < conditionGoal;
      });
      
      // If all conditions are fulfilled but total goal isn't reached, distribute equally
      // Otherwise, only divide among available conditions
      const conditionsToUse = availableConditions.length > 0 ? availableConditions : conditions;
      const conditionCount = conditionsToUse.length > 0 ? conditionsToUse.length : 1;
      const amountPerCondition = amount / conditionCount;
      
      // Create allocations - only for conditions that haven't reached their goals
      const allocations = conditions.map((cond) => {
        const isAvailable = availableConditions.some(ac => ac.title === cond.title);
        return {
          condition: cond.title,
          amount: isAvailable ? amountPerCondition : 0, // Only allocate to available conditions
          percentage: isAvailable ? (1 / conditionCount) * 100 : 0,
        };
      });

      // 3. Update user profile with donation history
      const userProfileRef = doc(db, "users", currentUser.uid);
      const userProfileDoc = await getDoc(userProfileRef);
      
      // Use Timestamp.now() instead of serverTimestamp() for array elements
      const donationRecord = {
        donationId: donationRef.id,
        campaignId: campaign.id,
        ngoName: campaign.details.ngo_name,
        condition: condition?.title || "General",
        amount: amount,
        timestamp: Timestamp.now(),
        allocations: allocations, // Store how money was divided
      };

      if (userProfileDoc.exists()) {
        // Update existing profile
        const existingData = userProfileDoc.data();
        const donationHistory = existingData.donationHistory || [];
        const totalDonated = (existingData.totalDonated || 0) + amount;
        const donationCount = (existingData.donationCount || 0) + 1;

        // Calculate badges based on donation count milestones
        const milestones = [1, 5, 10, 25, 50, 100, 150, 200];
        const existingBadges = existingData.badges || [];
        const updatedBadges = [...existingBadges];
        
        // Add badges for milestones reached
        milestones.forEach((milestone) => {
          const badgeKey = `${milestone}_donations`;
          if (donationCount >= milestone && !updatedBadges.includes(badgeKey)) {
            updatedBadges.push(badgeKey);
          }
        });

        // Also add first_donation badge if this is the first donation
        if (donationCount === 1 && !updatedBadges.includes("first_donation")) {
          updatedBadges.push("first_donation");
        }

        // Calculate rank based on total donated
        const calculateRank = (total: number): string => {
          if (total >= 100000) return "Diamond";
          if (total >= 50000) return "Gold";
          if (total >= 25000) return "Silver";
          return "Bronze";
        };

        const rank = calculateRank(totalDonated);

        await updateDoc(userProfileRef, {
          donationHistory: [...donationHistory, donationRecord],
          totalDonated: totalDonated,
          donationCount: donationCount,
          badges: updatedBadges,
          rank: rank,
          lastUpdated: serverTimestamp(),
        });
      } else {
        // Create new profile with first donation
        await setDoc(userProfileRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          donationHistory: [donationRecord],
          totalDonated: amount,
          donationCount: 1,
          badges: ["first_donation", "1_donations"], // First donation badges
          rank: "Bronze",
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        });
      }

      // 3. Update organization/campaign totals
      // Ensure total_raised never exceeds total_goal
      const campaignRef = doc(db, "ngos", campaign.id);
      const campaignDoc = await getDoc(campaignRef);
      
      let actualDonationAmount = amount; // Track actual amount that was processed
      
      if (campaignDoc.exists()) {
        const currentData = campaignDoc.data();
        const currentRaised = currentData.total_raised || 0;
        const goal = currentData.total_goal || 0;
        
        // Calculate new total after donation
        let newTotalRaised = currentRaised + amount;
        
        // Cap at goal if it would exceed
        if (goal > 0 && newTotalRaised > goal) {
          const remainingToGoal = goal - currentRaised;
          if (remainingToGoal > 0) {
            // Adjust donation to only fill remaining amount
            actualDonationAmount = remainingToGoal;
            newTotalRaised = goal; // Cap at goal
            toast({
              title: "Donation Adjusted",
              description: `The campaign goal has nearly been reached. Your donation was adjusted to ₹${remainingToGoal.toLocaleString()} to match the remaining goal amount.`,
              variant: "default",
            });
            
            // Update donation record with adjusted amount
            await updateDoc(donationRef, {
              amount: actualDonationAmount,
            });
          } else {
            // Goal already reached, no donation should be processed
            // Cancel the donation record since goal is already reached
            await updateDoc(donationRef, {
              status: "cancelled",
            });
            
            toast({
              title: "Campaign Goal Reached",
              description: `The campaign "${campaign.details.ngo_name}" has already reached its funding goal. Donation cancelled.`,
              variant: "destructive",
            });
            setProcessingPayment(false);
            setShowPasswordDialog(false);
            return;
          }
        }
        
        // Update with capped value to ensure it never exceeds goal
        await updateDoc(campaignRef, {
          total_raised: newTotalRaised, // Use set value instead of increment to ensure it doesn't exceed goal
          updated_at: serverTimestamp(),
        });
      } else {
        // Fallback: use increment if document doesn't exist (shouldn't happen)
        await updateDoc(campaignRef, {
          total_raised: increment(amount),
          updated_at: serverTimestamp(),
        });
      }

      // 4. Show success confirmation (use actual donation amount if adjusted)
      setCompletedDonation({ campaign, amount: actualDonationAmount });
      setShowConfirmation(true);
      
      toast({
        title: "✅ Donation Successful!",
        description: `Your donation of ₹${actualDonationAmount.toLocaleString()} to ${campaign.details.ngo_name} has been recorded.`,
      });

      // Close details modal
      setIsDetailsOpen(false);
      setSelectedCampaign(null);
      setPendingDonation(null);
      setProcessingPayment(false);
    } catch (error: any) {
      console.error("Donation error:", error);
      toast({
        title: "Donation Failed",
        description: error.message || "Failed to process donation.",
        variant: "destructive",
      });
      setProcessingPayment(false);
      setShowPaymentDialog(false);
    }
  };

  // Prepare chart data for condition-wise spending
  const getChartData = (campaign: NGOCampaign) => {
    if (!campaign.conditions || campaign.conditions.length === 0) return [];
    
    return campaign.conditions.map(cond => ({
      name: cond.title.substring(0, 20) + (cond.title.length > 20 ? "..." : ""),
      goal: cond.fund_estimate || 0,
      raised: cond.raised || 0,
      remaining: Math.max(0, (cond.fund_estimate || 0) - (cond.raised || 0)),
    }));
  };

  // Memoize chart data to ensure pie chart updates when campaign data changes
  const chartDataForSelectedCampaign = useMemo(() => {
    if (!selectedCampaign) return [];
    return getChartData(selectedCampaign);
  }, [selectedCampaign?.id, selectedCampaign?.conditions, selectedCampaign?.total_raised, selectedCampaign?.conditions?.map(c => c.raised).join(',')]);

  // Loading Skeleton
  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6 space-y-4">
            <div className="h-48 bg-gray-200 rounded-lg"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <div className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">Browse Campaigns</h1>
          <p className="text-gray-600">Discover and support verified NGO campaigns</p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search campaigns by name, description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
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

              {/* Verified Only */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="verified-only"
                  checked={verifiedOnly}
                  onCheckedChange={(checked) => setVerifiedOnly(checked as boolean)}
                />
                <Label htmlFor="verified-only" className="cursor-pointer">
                  Verified Only
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campaigns Grid */}
        {loading ? (
          <LoadingSkeleton />
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Heart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-black mb-2">No active campaigns found</h3>
              <p className="text-gray-600">
                {searchQuery || selectedCategory !== "all" || verifiedOnly
                  ? "Try adjusting your filters to see more campaigns."
                  : "Check back soon for new campaigns."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => {
              const progress = campaign.total_goal
                ? Math.min(100, (campaign.total_raised || 0) / campaign.total_goal * 100)
                : 0;
              
              const isGoalReached = campaign.total_goal > 0 && (campaign.total_raised || 0) >= campaign.total_goal;

              return (
                <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    {/* Campaign Image */}
                    <div className="relative h-48 bg-gray-100 rounded-lg mb-4 overflow-hidden">
                      {campaign.profile?.profile_photo_url ? (
                        <img
                          src={campaign.profile.profile_photo_url}
                          alt={campaign.details.ngo_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Heart className="h-16 w-16 text-gray-300" />
                        </div>
                      )}
                      {campaign.profile?.verified && (
                        <div className="absolute top-2 right-2 bg-black text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified
                        </div>
                      )}
                    </div>

                    <CardTitle className="text-xl text-black mb-1">
                      {campaign.details.ngo_name}
                    </CardTitle>
                    <CardDescription className="text-gray-600 line-clamp-2">
                      {campaign.details.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Category Tag */}
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-black text-white text-xs rounded">
                        {campaign.details.donation_category}
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Raised</span>
                        <span className="font-semibold text-black">
                          ₹{campaign.total_raised?.toLocaleString() || 0} / ₹{campaign.total_goal?.toLocaleString() || 0}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <TrendingUp className="h-3 w-3" />
                        {progress.toFixed(1)}% funded
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleViewDetails(campaign)}
                      >
                        View Details
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        className="flex-1 bg-black text-white hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        onClick={() => handleDonateClick(campaign)}
                        disabled={processingPayment || isGoalReached}
                        title={isGoalReached ? "Campaign goal reached. Thank you for your interest!" : undefined}
                      >
                        {processingPayment ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isGoalReached ? (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Goal Reached
                          </>
                        ) : (
                          <>
                            <DollarSign className="mr-2 h-4 w-4" />
                            Donate
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Details Modal */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedCampaign && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl text-black">
                    {selectedCampaign.details.ngo_name}
                  </DialogTitle>
                  <DialogDescription className="text-gray-600">
                    {selectedCampaign.details.description}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Campaign Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">Category</Label>
                      <p className="font-semibold text-black">{selectedCampaign.details.donation_category}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Status</Label>
                      <p className="font-semibold text-black capitalize">{selectedCampaign.status}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Contact Email</Label>
                      <p className="text-black">{selectedCampaign.details.contact_email}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Contact Phone</Label>
                      <p className="text-black">{selectedCampaign.details.contact_phone}</p>
                    </div>
                  </div>

                  {/* Progress Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Funding Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Raised</span>
                        <span className="text-2xl font-bold text-black">
                          ₹{selectedCampaign.total_raised?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Goal</span>
                        <span className="text-xl font-semibold text-black">
                          ₹{selectedCampaign.total_goal?.toLocaleString() || 0}
                        </span>
                      </div>
                      <Progress
                        value={
                          selectedCampaign.total_goal
                            ? (selectedCampaign.total_raised || 0) / selectedCampaign.total_goal * 100
                            : 0
                        }
                        className="h-3"
                      />
                    </CardContent>
                  </Card>

                  {/* Conditions List */}
                  {selectedCampaign.conditions && selectedCampaign.conditions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-black mb-4">Funding Conditions</h3>
                      <div className="space-y-4">
                        {selectedCampaign.conditions.map((condition, index) => {
                          const conditionProgress = condition.fund_estimate
                            ? Math.min(100, (condition.raised || 0) / condition.fund_estimate * 100)
                            : 0;
                          
                          const isConditionGoalReached = condition.fund_estimate > 0 && (condition.raised || 0) >= condition.fund_estimate;

                          return (
                            <Card key={index}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-black">{condition.title}</h4>
                                    <p className="text-sm text-gray-600 mt-1">{condition.description}</p>
                                  </div>
                                  <span className={`px-2 py-1 text-xs rounded ${
                                    condition.priority === "High" ? "bg-red-100 text-red-800" :
                                    condition.priority === "Medium" ? "bg-yellow-100 text-yellow-800" :
                                    "bg-green-100 text-green-800"
                                  }`}>
                                    {condition.priority}
                                  </span>
                                </div>
                                <div className="mt-3 space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">
                                      ₹{(condition.raised || 0).toLocaleString()} raised
                                    </span>
                                    <span className="font-semibold text-black">
                                      Goal: ₹{(condition.fund_estimate || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  <Progress value={conditionProgress} className="h-2" />
                                </div>
                                <Button
                                  className="mt-3 w-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                  onClick={() => handleDonateClick(selectedCampaign, condition)}
                                  disabled={processingPayment || isConditionGoalReached}
                                  title={isConditionGoalReached ? "Condition goal reached. Thank you for your interest!" : undefined}
                                >
                                  {processingPayment ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : isConditionGoalReached ? (
                                    <>
                                      <CheckCircle2 className="mr-2 h-4 w-4" />
                                      Goal Reached
                                    </>
                                  ) : (
                                    <>
                                      <DollarSign className="mr-2 h-4 w-4" />
                                      Donate to this condition
                                    </>
                                  )}
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Charts */}
                  {selectedCampaign.conditions && selectedCampaign.conditions.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Pie Chart - Condition Distribution */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Condition-wise Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart key={`pie-${selectedCampaign.id}-${selectedCampaign.total_raised || 0}`}>
                              <Pie
                                data={chartDataForSelectedCampaign.map(d => ({
                                  name: d.name,
                                  value: d.raised
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                animationBegin={0}
                                animationDuration={400}
                                isAnimationActive={true}
                              >
                                {chartDataForSelectedCampaign.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${entry.name}-${entry.raised}-${index}`} 
                                    fill={COLORS[index % COLORS.length]} 
                                  />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Bar Chart - Goal vs Raised */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Goal vs Raised</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartDataForSelectedCampaign}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="goal" fill="#e0e0e0" name="Goal" />
                              <Bar dataKey="raised" fill="#000000" name="Raised" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Donation Amount Input Dialog */}
      <Dialog open={showDonationDialog} onOpenChange={setShowDonationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Donation Amount</DialogTitle>
            <DialogDescription>
              How much would you like to donate to {pendingDonation?.campaign.details.ngo_name}?
              {selectedCondition && ` (${selectedCondition.title})`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                value={donationAmount}
                onChange={(e) => setDonationAmount(e.target.value)}
                placeholder="Enter amount"
                className="mt-2"
                max={
                  pendingDonation?.condition && pendingDonation.condition.fund_estimate > 0
                    ? (pendingDonation.condition.fund_estimate - (pendingDonation.condition.raised || 0))
                    : pendingDonation?.campaign.total_goal > 0
                    ? (pendingDonation.campaign.total_goal - (pendingDonation.campaign.total_raised || 0))
                    : undefined
                }
              />
              {pendingDonation && (() => {
                const campaign = pendingDonation.campaign;
                const condition = pendingDonation.condition;
                let remainingAmount = null;
                let goalAmount = null;

                if (condition && condition.fund_estimate > 0) {
                  remainingAmount = condition.fund_estimate - (condition.raised || 0);
                  goalAmount = condition.fund_estimate;
                } else if (campaign.total_goal > 0) {
                  remainingAmount = campaign.total_goal - (campaign.total_raised || 0);
                  goalAmount = campaign.total_goal;
                }

                return (
                  <div className="mt-2 space-y-1">
                    {condition && condition.fund_estimate > 0 && (
                      <>
                        <p className="text-sm text-gray-600">
                          Condition Goal: ₹{condition.fund_estimate.toLocaleString()} | 
                          Raised: ₹{(condition.raised || 0).toLocaleString()}
                        </p>
                        {remainingAmount !== null && remainingAmount > 0 && (
                          <p className="text-sm font-semibold text-black">
                            Maximum donation: ₹{remainingAmount.toLocaleString()}
                          </p>
                        )}
                      </>
                    )}
                    {campaign.total_goal > 0 && !condition && (
                      <>
                        <p className="text-sm text-gray-600">
                          Campaign Goal: ₹{campaign.total_goal.toLocaleString()} | 
                          Raised: ₹{(campaign.total_raised || 0).toLocaleString()}
                        </p>
                        {remainingAmount !== null && remainingAmount > 0 && (
                          <p className="text-sm font-semibold text-black">
                            Maximum donation: ₹{remainingAmount.toLocaleString()}
                          </p>
                        )}
                      </>
                    )}
                    {condition && condition.fund_estimate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Suggested: ₹{condition.fund_estimate.toLocaleString()}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDonationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAmountConfirm} className="bg-black text-white">
              Continue to Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Payment Password</DialogTitle>
            <DialogDescription>
              Please enter your payment password to confirm the donation of{" "}
              <strong>₹{pendingDonation?.amount.toLocaleString()}</strong> to{" "}
              <strong>{pendingDonation?.campaign.details.ngo_name}</strong>.
              {pendingDonation?.condition && (
                <>
                  <br />
                  <br />
                  For: <strong>{pendingDonation.condition.title}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="payment-password-input">Payment Password</Label>
              <Input
                id="payment-password-input"
                type="password"
                value={paymentPassword}
                onChange={(e) => {
                  setPaymentPassword(e.target.value);
                  setPasswordError("");
                }}
                placeholder="Enter your payment password"
                className="mt-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePasswordVerify();
                  }
                }}
              />
            </div>
            {passwordError && (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordVerify} disabled={processingPayment} className="bg-black text-white">
              {processingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Verify & Pay"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              Donation Successful!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Thank you for your generous donation of{" "}
              <strong>₹{completedDonation?.amount.toLocaleString()}</strong> to{" "}
              <strong>{completedDonation?.campaign.details.ngo_name}</strong>.
              <br />
              <br />
              Your donation has been recorded and the organization dashboard has been updated.
              <br />
              <br />
              Check your profile to see your donation history and badges!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmation(false);
                setCompletedDonation(null);
              }}
              className="bg-black text-white hover:bg-gray-800"
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
};

export default BrowseCampaigns;

