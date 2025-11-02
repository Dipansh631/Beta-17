import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/firebase/config";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Image as ImageIcon, PieChart, CheckCircle2, XCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface WorkProof {
  id: string;
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

interface Donation {
  id: string;
  userId: string;
  campaignId: string;
  ngoId: string;
  condition: string;
  amount: number;
  timestamp: any;
  proofSubmitted?: boolean;
  proofId?: string;
}

interface NGOCampaign {
  id: string;
  details: {
    ngo_name: string;
    description: string;
  };
  conditions: {
    title: string;
    description: string;
    fund_estimate: number;
  }[];
}

const COLORS = ['#000000', '#4a4a4a', '#8a8a8a', '#c0c0c0', '#e0e0e0', '#f0f0f0'];

const DonationProof = () => {
  const { donationId } = useParams<{ donationId: string }>();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [donation, setDonation] = useState<Donation | null>(null);
  const [proof, setProof] = useState<WorkProof | null>(null);
  const [campaign, setCampaign] = useState<NGOCampaign | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (donationId) {
      loadDonationProof();
    }
  }, [donationId]);

  const loadDonationProof = async () => {
    if (!donationId || !currentUser) return;

    try {
      setLoading(true);

      // Load donation
      const donationDoc = await getDoc(doc(db, "donations", donationId));
      if (!donationDoc.exists()) {
        return;
      }

      const donationData = { id: donationDoc.id, ...donationDoc.data() } as Donation;
      
      // Verify this donation belongs to the current user
      if (donationData.userId !== currentUser.uid) {
        return;
      }

      setDonation(donationData);

      // Load campaign
      const campaignDoc = await getDoc(doc(db, "ngos", donationData.campaignId));
      if (campaignDoc.exists()) {
        setCampaign({
          id: campaignDoc.id,
          ...campaignDoc.data(),
        } as NGOCampaign);
      }

      // Load general proof for this NGO (not tied to specific donation)
      // Find the most recent proof for this campaign (general proofs have empty donationId)
      const proofQuery = query(
        collection(db, "workProofs"),
        where("campaignId", "==", donationData.campaignId)
      );
      const proofSnapshot = await getDocs(proofQuery);
      
      if (!proofSnapshot.empty) {
        // Get the most recent proof
        const proofs = proofSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as WorkProof))
          .sort((a, b) => {
            const aTime = a.timestamp?.toDate?.()?.getTime() || 0;
            const bTime = b.timestamp?.toDate?.()?.getTime() || 0;
            return bTime - aTime;
          });
        
        if (proofs.length > 0) {
          setProof(proofs[0]); // Use most recent proof
        }
      }
    } catch (error) {
      console.error("Error loading donation proof:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Memoize pie chart data to ensure it updates when proof changes
  const pieChartData = useMemo(() => {
    if (!proof || !proof.conditionAllocations) return [];

    return proof.conditionAllocations.map((allocation) => ({
      name: allocation.condition,
      value: allocation.percentage || 0,
      amount: allocation.amount || 0,
    }));
  }, [proof?.conditionAllocations, proof?.id]);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600">Please login to view donation proof.</p>
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

  if (!donation) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600 mb-4">Donation not found.</p>
              <Button asChild variant="outline">
                <Link to="/profile">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Profile
                </Link>
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
      <div className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <Button asChild variant="ghost" className="mb-4">
            <Link to="/profile">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Profile
            </Link>
          </Button>
          <h1 className="text-4xl font-bold text-black mb-2">Donation Proof</h1>
          <p className="text-gray-600">See how your donation was used by the organization</p>
        </div>

        {/* Proof Information at Top */}
        {proof ? (
          <>
            <Card className="mb-6 border-2 border-green-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Work Proof Available
                </CardTitle>
                <CardDescription>
                  See how {campaign?.details.ngo_name} used the donated funds with proof photos and detailed allocation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Money Used</p>
                    <p className="text-2xl font-bold text-green-600">
                      ₹{proof.conditionAllocations.reduce((sum, alloc) => sum + alloc.amount, 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Proof Status</p>
                    <Badge
                      className={
                        proof.status === "verified"
                          ? "bg-green-100 text-green-800"
                          : proof.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {proof.status === "verified" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {proof.status === "rejected" && <XCircle className="mr-1 h-3 w-3" />}
                      {proof.status.charAt(0).toUpperCase() + proof.status.slice(1)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Proof Date</p>
                    <p className="font-semibold text-black">{formatDate(proof.timestamp)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Donation Summary */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Your Donation Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Your Amount</p>
                    <p className="text-xl font-bold text-black">
                      ₹{donation.amount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Organization</p>
                    <p className="font-semibold text-black">{campaign?.details.ngo_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Donation Date</p>
                    <p className="text-black">{formatDate(donation.timestamp)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
          </>
        ) : (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Donation Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Amount</p>
                  <p className="text-xl font-bold text-black">
                    ₹{donation.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Organization</p>
                  <p className="font-semibold text-black">{campaign?.details.ngo_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Date</p>
                  <p className="text-black">{formatDate(donation.timestamp)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {proof ? (
          <>
            {/* Allocation Pie Chart */}
            {pieChartData.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Fund Allocation Breakdown
                  </CardTitle>
                  <CardDescription>
                    How your donation of ₹{donation.amount.toLocaleString()} was distributed across different conditions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart key={`pie-${proof?.id}-${pieChartData.map(d => `${d.name}-${d.value}`).join('-')}`}>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) =>
                              `${name}: ${(percent * 100).toFixed(1)}%`
                            }
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            animationBegin={0}
                            animationDuration={400}
                            isAnimationActive={true}
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell
                                key={`cell-${entry.name}-${entry.value}-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string, props: any) => [
                              `${value.toFixed(1)}% (₹${props.payload.amount.toLocaleString()})`,
                              name,
                            ]}
                          />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-semibold text-black mb-3">Breakdown by Condition:</h4>
                      {proof.conditionAllocations.map((allocation, index) => (
                        <div
                          key={index}
                          className="p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-black">{allocation.condition}</span>
                            <div className="text-right">
                              <p className="font-bold text-black">
                                ₹{allocation.amount.toLocaleString()}
                              </p>
                              <p className="text-sm text-gray-600">
                                {allocation.percentage.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Work Description */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Work Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{proof.description}</p>
              </CardContent>
            </Card>

            {/* Proof Photos */}
            {proof.photos && proof.photos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Work Proof Photos
                  </CardTitle>
                  <CardDescription>
                    Photos showing the work done with your donation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {proof.photos.map((photo, index) => {
                      // Convert relative URLs to absolute URLs
                      const photoUrl = photo.startsWith('/api/file/') || photo.startsWith('/api/') 
                        ? getApiUrl(photo) 
                        : photo;
                      
                      return (
                        <div
                          key={index}
                          className="relative cursor-pointer group"
                          onClick={() => setSelectedImage(photoUrl)}
                        >
                          <img
                            src={photoUrl}
                            alt={`Proof ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                            onError={(e) => {
                              console.error("Image load error:", photoUrl);
                              e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='14' fill='%236b7280'%3EImage not found%3C/text%3E%3C/svg%3E";
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-lg flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <ImageIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-black mb-2">
                Proof Not Yet Submitted
              </h3>
              <p className="text-gray-600">
                The organization has not yet submitted work proof for this donation.
                Please check back later.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setSelectedImage(null)}
            >
              <XCircle className="h-6 w-6" />
            </Button>
            <img
              src={selectedImage}
              alt="Work proof"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                console.error("Image load error:", selectedImage);
                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='16' fill='%236b7280'%3EImage not found%3C/text%3E%3C/svg%3E";
              }}
            />
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default DonationProof;

