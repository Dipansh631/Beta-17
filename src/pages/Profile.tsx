import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/firebase/config";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  getDocs,
  where,
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  User,
  Lock,
  History,
  Award,
  Trophy,
  Shield,
  CheckCircle2,
  Calendar,
  DollarSign,
  Building2,
  Loader2,
  Eye,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface DonationRecord {
  donationId: string;
  campaignId: string;
  ngoName: string;
  condition: string;
  amount: number;
  timestamp: any;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  paymentPassword?: string;
  donationHistory: DonationRecord[];
  totalDonated: number;
  donationCount: number;
  badges: string[];
  rank?: string;
  createdAt: any;
  lastUpdated: any;
}

const Profile = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [paymentPassword, setPaymentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [ngoResults, setNgoResults] = useState<any[]>([]);

  useEffect(() => {
    if (currentUser) {
      loadProfile();
    }
  }, [currentUser]);

  useEffect(() => {
    if (profile && currentUser) {
      loadNgoResults();
    }
  }, [profile, currentUser]);

  const loadNgoResults = async () => {
    if (!currentUser || !profile) return;

    try {
      // Get all unique campaign IDs from donation history
      const campaignIds = [...new Set(profile.donationHistory.map(d => d.campaignId))];
      
      const results = await Promise.all(
        campaignIds.map(async (campaignId) => {
          // Get NGO details
          const ngoDoc = await getDoc(doc(db, "ngos", campaignId));
          if (!ngoDoc.exists()) return null;

          const ngoData = ngoDoc.data();
          
          // Get donations for this NGO
          const donationsQuery = query(
            collection(db, "donations"),
            where("campaignId", "==", campaignId)
          );
          const donationsSnapshot = await getDocs(donationsQuery);
          const totalRaised = donationsSnapshot.docs.reduce((sum, doc) => {
            const amount = doc.data().amount;
            return sum + (typeof amount === 'number' ? amount : Number(amount) || 0);
          }, 0);

          // Get work proofs
          const proofQuery = query(
            collection(db, "workProofs"),
            where("campaignId", "==", campaignId)
          );
          const proofSnapshot = await getDocs(proofQuery);
          let totalUsed = 0;
          let latestProof: any = null;
          proofSnapshot.forEach((doc) => {
            const proof = doc.data();
            if (proof.conditionAllocations) {
              const proofTotal = proof.conditionAllocations.reduce(
                (sum: number, alloc: { amount: number }) => sum + alloc.amount,
                0
              );
              totalUsed += proofTotal;
            }
            // Get most recent proof
            if (!latestProof || (proof.timestamp?.toDate?.()?.getTime() || 0) > (latestProof.timestamp?.toDate?.()?.getTime() || 0)) {
              latestProof = { id: doc.id, ...proof };
            }
          });

          // Get gallery images
          const galleryImages = ngoData.galleryImages || [];

          return {
            campaignId,
            ngoName: ngoData.details?.ngo_name || "Unknown",
            description: ngoData.details?.description || "",
            totalRaised: totalRaised ?? 0,
            totalUsed: totalUsed ?? 0,
            remaining: Math.max(0, (totalRaised ?? 0) - (totalUsed ?? 0)), // Never show negative
            latestProof,
            galleryImages: galleryImages || [],
          };
        })
      );

      setNgoResults(results.filter(r => r !== null));
    } catch (error) {
      console.error("Error loading NGO results:", error);
    }
  };

  const loadProfile = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const userProfileRef = doc(db, "users", currentUser.uid);
      const userProfileDoc = await getDoc(userProfileRef);

      if (userProfileDoc.exists()) {
        const data = userProfileDoc.data() as UserProfile;
        
        // Calculate rank based on total donated
        const rank = calculateRank(data.totalDonated || 0);
        
        // Calculate badges based on donation count
        const badges = calculateBadges(data.donationCount || 0);
        
        setProfile({
          ...data,
          rank,
          badges,
        });
      } else {
        // Create default profile
        const defaultProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || "",
          displayName: currentUser.displayName || "User",
          donationHistory: [],
          totalDonated: 0,
          donationCount: 0,
          badges: [],
          rank: "Bronze",
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        };
        setProfile(defaultProfile);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateRank = (totalDonated: number): string => {
    if (totalDonated >= 100000) return "Diamond";
    if (totalDonated >= 50000) return "Gold";
    if (totalDonated >= 25000) return "Silver";
    return "Bronze";
  };

  const calculateBadges = (donationCount: number): string[] => {
    const badges: string[] = [];
    const milestones = [1, 5, 10, 25, 50, 100, 150, 200];
    
    milestones.forEach((milestone) => {
      if (donationCount >= milestone) {
        badges.push(`${milestone}_donations`);
      }
    });
    
    return badges;
  };

  const getBadgeDisplay = (badge: string) => {
    const badgeMap: Record<string, { label: string; icon: string; color: string }> = {
      first_donation: { label: "First Donation", icon: "🎉", color: "bg-blue-100 text-blue-800" },
      "1_donations": { label: "1st Donation", icon: "🌟", color: "bg-blue-100 text-blue-800" },
      "5_donations": { label: "5 Donations Complete", icon: "🏅", color: "bg-green-100 text-green-800" },
      "10_donations": { label: "10 Donations Complete", icon: "🥇", color: "bg-yellow-100 text-yellow-800" },
      "25_donations": { label: "25 Donations Complete", icon: "💎", color: "bg-purple-100 text-purple-800" },
      "50_donations": { label: "50 Donations Complete", icon: "👑", color: "bg-indigo-100 text-indigo-800" },
      "100_donations": { label: "100 Donations Complete", icon: "⭐", color: "bg-amber-100 text-amber-800" },
      "150_donations": { label: "150 Donations Complete", icon: "✨", color: "bg-pink-100 text-pink-800" },
      "200_donations": { label: "200 Donations Complete", icon: "🎖️", color: "bg-red-100 text-red-800" },
    };

    return badgeMap[badge] || { label: badge, icon: "🏆", color: "bg-gray-100 text-gray-800" };
  };

  const getRankDisplay = (rank: string) => {
    const rankMap: Record<string, { label: string; color: string; icon: string }> = {
      Bronze: { label: "Bronze", color: "bg-amber-600", icon: "🥉" },
      Silver: { label: "Silver", color: "bg-gray-400", icon: "🥈" },
      Gold: { label: "Gold", color: "bg-yellow-500", icon: "🥇" },
      Diamond: { label: "Diamond", color: "bg-cyan-400", icon: "💎" },
    };

    return rankMap[rank] || { label: rank, color: "bg-gray-400", icon: "🏆" };
  };

  const handleSetPassword = async () => {
    if (!paymentPassword || paymentPassword.length < 4) {
      setPasswordError("Password must be at least 4 characters");
      return;
    }

    if (paymentPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    if (!currentUser) return;

    try {
      setSavingPassword(true);
      setPasswordError("");

      const userProfileRef = doc(db, "users", currentUser.uid);
      
      // Use setDoc with merge: true to create or update the document
      // This avoids 400 errors if the document doesn't exist
      // merge: true will only update the fields we provide, preserving existing data
      const updateData: any = {
        paymentPassword: paymentPassword, // In production, hash this password
        lastUpdated: serverTimestamp(),
      };
      
      // If profile doesn't exist, set initial fields too
      if (!profile) {
        updateData.uid = currentUser.uid;
        updateData.email = currentUser.email || "";
        updateData.displayName = currentUser.displayName || "User";
        updateData.donationHistory = [];
        updateData.totalDonated = 0;
        updateData.donationCount = 0;
        updateData.badges = [];
        updateData.createdAt = serverTimestamp();
      }
      
      await setDoc(userProfileRef, updateData, { merge: true });

      toast({
        title: "✅ Payment Password Set",
        description: "Your payment password has been updated successfully.",
      });

      setShowPasswordDialog(false);
      setPaymentPassword("");
      setConfirmPassword("");
      setPasswordError("");
      
      // Reload profile
      await loadProfile();
    } catch (error: any) {
      console.error("Error setting payment password:", error);
      const errorMessage = error.code === 'permission-denied' 
        ? "Permission denied. Please check your Firestore security rules."
        : error.code === 'unavailable'
        ? "Firestore service is temporarily unavailable. Please try again."
        : error.message || "Failed to set payment password";
      
      setPasswordError(errorMessage);
      
      toast({
        title: "❌ Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

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

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600">Please login to view your profile.</p>
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

  const rankDisplay = profile ? getRankDisplay(profile.rank || "Bronze") : null;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <div className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">My Profile</h1>
          <p className="text-gray-600">Manage your account settings and view your donation history</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center mb-4">
                  <Avatar className="h-24 w-24">
                    <AvatarFallback className="bg-accent text-accent-foreground text-2xl">
                      {profile?.displayName
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <Label className="text-gray-600">Name</Label>
                  <p className="font-semibold text-black">{profile?.displayName || "User"}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Email</Label>
                  <p className="text-black">{profile?.email || currentUser.email}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Total Donated</Label>
                  <p className="text-2xl font-bold text-black">
                    ₹{(profile?.totalDonated ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-600">Total Donations</Label>
                  <p className="text-xl font-semibold text-black">{profile?.donationCount || 0}</p>
                </div>
              </CardContent>
            </Card>

            {/* Rank Card */}
            {rankDisplay && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Donor Rank
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className={`${rankDisplay.color} text-white rounded-full w-20 h-20 flex items-center justify-center text-4xl mx-auto mb-4`}>
                      {rankDisplay.icon}
                    </div>
                    <p className="text-2xl font-bold text-black">{rankDisplay.label}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      {profile?.totalDonated >= 100000
                        ? "Top tier donor!"
                        : profile?.totalDonated >= 50000
                        ? "Keep going, you're amazing!"
                        : profile?.totalDonated >= 25000
                        ? "Great progress!"
                        : "Start your journey today"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Password Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Payment Password
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  {profile?.paymentPassword
                    ? "Your payment password is set. You can change it below."
                    : "Set a payment password to secure your donations."}
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setPaymentPassword("");
                    setConfirmPassword("");
                    setPasswordError("");
                    setShowPasswordDialog(true);
                  }}
                >
                  {profile?.paymentPassword ? "Change Password" : "Set Password"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Badges and History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Badges Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Badges & Achievements
                </CardTitle>
                <CardDescription>
                  Earn badges as you complete more donations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profile?.badges && profile.badges.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {profile.badges.map((badge, index) => {
                      const badgeInfo = getBadgeDisplay(badge);
                      return (
                        <div
                          key={index}
                          className={`${badgeInfo.color} rounded-lg p-4 text-center border-2 border-transparent hover:border-gray-300 transition-colors`}
                        >
                          <div className="text-3xl mb-2">{badgeInfo.icon}</div>
                          <p className="text-sm font-semibold">{badgeInfo.label}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Award className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No badges yet. Make your first donation to earn badges!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live NGO Results */}
            {ngoResults.length > 0 && (
              <Card className="border-2 border-green-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-green-600" />
                    Live NGO Results
                  </CardTitle>
                  <CardDescription>
                    Real-time updates from organizations you've supported
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {ngoResults.map((result, index) => (
                      <Card key={index} className="bg-gray-50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-bold text-lg text-black mb-1">{result.ngoName}</h4>
                              <p className="text-sm text-gray-600 line-clamp-2">{result.description}</p>
                            </div>
                          </div>
                          
                          {/* Stats Grid */}
                          <div className="grid grid-cols-3 gap-3 mt-4">
                            <div className="bg-white p-3 rounded-lg border">
                              <p className="text-xs text-gray-600 mb-1">Total Received</p>
                              <p className="font-bold text-black">₹{(result.totalRaised ?? 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                              <p className="text-xs text-gray-600 mb-1">Amount Used</p>
                              <p className="font-bold text-green-600">₹{(result.totalUsed ?? 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                              <p className="text-xs text-gray-600 mb-1">Amount Remaining</p>
                              <p className="font-bold text-orange-600">₹{(result.remaining ?? 0).toLocaleString()}</p>
                            </div>
                          </div>

                          {/* Gallery Preview */}
                          {result.galleryImages && result.galleryImages.length > 0 && (
                            <div className="mt-4">
                              <p className="text-sm font-semibold text-black mb-2">Latest Images</p>
                              <div className="grid grid-cols-4 gap-2">
                                {result.galleryImages.slice(0, 4).map((img: string, imgIndex: number) => {
                                  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
                                  const getApiUrl = (endpoint: string) => {
                                    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
                                    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
                                      return endpoint;
                                    }
                                    if (endpoint.startsWith("/")) {
                                      return `${baseUrl}${endpoint}`;
                                    }
                                    return `${baseUrl}/${endpoint}`;
                                  };
                                  const imgUrl = img.startsWith('/api/file/') || img.startsWith('/api/')
                                    ? getApiUrl(img)
                                    : img;
                                  
                                  return (
                                    <img
                                      key={imgIndex}
                                      src={imgUrl}
                                      alt={`${result.ngoName} gallery ${imgIndex + 1}`}
                                      className="w-full h-16 object-cover rounded border cursor-pointer hover:opacity-90"
                                      onClick={() => window.open(imgUrl, '_blank')}
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Latest Proof Info */}
                          {result.latestProof && (
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-sm font-semibold text-black mb-1">Latest Work Proof</p>
                              <p className="text-xs text-gray-600 line-clamp-2">{result.latestProof.description || "Work proof submitted"}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {result.latestProof.timestamp?.toDate?.()?.toLocaleDateString() || "Recently"}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Donation History Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Donation History
                </CardTitle>
                <CardDescription>
                  Your complete donation history with organization details
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profile?.donationHistory && profile.donationHistory.length > 0 ? (
                  <div className="space-y-4">
                        {profile.donationHistory
                      .slice()
                      .reverse()
                      .map((donation, index) => (
                        <Card key={index} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Building2 className="h-4 w-4 text-gray-500" />
                                  <h4 className="font-semibold text-black">{donation.ngoName}</h4>
                                </div>
                                <div className="space-y-1 text-sm text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="h-3 w-3" />
                                    <span>
                                      Amount: <strong className="text-black">₹{(donation.amount ?? 0).toLocaleString()}</strong>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Condition: {donation.condition}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatDate(donation.timestamp)}</span>
                                  </div>
                                </div>
                                <div className="mt-3">
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                  >
                                    <Link to={`/donation-proof/${donation.donationId}`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Proof & Allocation
                                      <ExternalLink className="ml-2 h-3 w-3" />
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                              <Badge variant="outline" className="ml-4">
                                Donated
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <History className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No donation history yet.</p>
                    <Button asChild variant="outline" className="mt-4">
                      <a href="/campaigns">Browse Campaigns</a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{profile?.paymentPassword ? "Change Payment Password" : "Set Payment Password"}</DialogTitle>
            <DialogDescription>
              {profile?.paymentPassword
                ? "Enter your new payment password. This will be required before every donation."
                : "Set a payment password for security. This password will be required before every donation."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="payment-password">Payment Password</Label>
              <Input
                id="payment-password"
                type="password"
                value={paymentPassword}
                onChange={(e) => {
                  setPaymentPassword(e.target.value);
                  setPasswordError("");
                }}
                placeholder="Enter payment password (min 4 characters)"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError("");
                }}
                placeholder="Confirm payment password"
                className="mt-2"
              />
            </div>
            {passwordError && (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-gray-500">
              This password will be required before every payment for security.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetPassword} disabled={savingPassword} className="bg-black text-white">
              {savingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Password"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Profile;

