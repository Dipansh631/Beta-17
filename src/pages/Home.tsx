import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CampaignCard from "@/components/CampaignCard";
import { ArrowRight, Shield, Eye, Zap, CheckCircle2, Trophy, Users, Loader2 } from "lucide-react";
import { db } from "@/integrations/firebase/config";
import { collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import heroImage from "@/assets/hero-image.jpg";

interface TopDonor {
  uid: string;
  displayName: string;
  email: string;
  totalDonated: number;
  donationCount: number;
  rank: string;
}

interface FeaturedCampaign {
  id: string;
  title: string;
  organization: string;
  description: string;
  raised: number;
  goal: number;
  conditions: number;
  verified: boolean;
  category: string;
  image: string;
}

const Home = () => {
  const [topDonors, setTopDonors] = useState<TopDonor[]>([]);
  const [loadingDonors, setLoadingDonors] = useState(true);
  const [featuredCampaigns, setFeaturedCampaigns] = useState<FeaturedCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  useEffect(() => {
    const fetchTopDonors = async () => {
      try {
        setLoadingDonors(true);
        const usersQuery = query(
          collection(db, "users"),
          orderBy("totalDonated", "desc"),
          limit(10)
        );
        const snapshot = await getDocs(usersQuery);
        const donors: TopDonor[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.totalDonated > 0) {
            donors.push({
              uid: doc.id,
              displayName: data.displayName || data.email?.split("@")[0] || "Anonymous",
              email: data.email || "",
              totalDonated: data.totalDonated || 0,
              donationCount: data.donationCount || 0,
              rank: data.rank || "Bronze",
            });
          }
        });
        
        setTopDonors(donors);
      } catch (error) {
        console.error("Error fetching top donors:", error);
      } finally {
        setLoadingDonors(false);
      }
    };

    fetchTopDonors();
  }, []);

  useEffect(() => {
    const fetchFeaturedCampaigns = async () => {
      try {
        setLoadingCampaigns(true);
        // Fetch all active NGOs (not just verified ones) so newly registered NGOs appear
        const ngosQuery = query(collection(db, "ngos"));
        const ngosSnapshot = await getDocs(ngosQuery);
        
        const campaigns: FeaturedCampaign[] = [];
        
        for (const docSnap of ngosSnapshot.docs) {
          const data = docSnap.data();
          
          // Skip if NGO doesn't have required data (details and conditions)
          if (!data.details?.ngo_name || !data.conditions || data.conditions.length === 0) {
            continue;
          }
          
          // Calculate total goal
          const totalGoal = data.conditions?.reduce((sum: number, cond: any) => sum + (cond.fund_estimate || 0), 0) || 0;
          
          // Fetch donations for this campaign
          const donationsQuery = query(
            collection(db, "donations"),
            where("campaignId", "==", docSnap.id)
          );
          const donationsSnapshot = await getDocs(donationsQuery);
          const campaignDonations = donationsSnapshot.docs.map(doc => doc.data());
          
          // Calculate total raised
          const totalRaised = campaignDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
          
          // Only include active campaigns (where total_raised < total_goal)
          // Also handle case where total_goal is 0 (no goal set)
          if (totalGoal === 0 || totalRaised < totalGoal) {
            // Get default icon based on category
            // Use local placeholder or campaign image
            let defaultIcon = "/placeholder.svg";
            if (campaign.image && campaign.image.startsWith('http')) {
              defaultIcon = campaign.image;
            }
            
            campaigns.push({
              id: docSnap.id,
              title: data.details?.ngo_name || "Untitled Campaign",
              organization: data.details?.ngo_name || "Unknown Organization",
              description: data.details?.description || "No description available",
              raised: totalRaised,
              goal: totalGoal || 0,
              conditions: data.conditions?.length || 0,
              verified: data.profile?.verified || false,
              category: data.details?.donation_category || "General",
              image: defaultIcon,
            });
          }
        }
        
        // Sort by raised amount (descending) and limit to 3
        campaigns.sort((a, b) => b.raised - a.raised);
        setFeaturedCampaigns(campaigns.slice(0, 3));
      } catch (error) {
        console.error("Error fetching featured campaigns:", error);
      } finally {
        setLoadingCampaigns(false);
      }
    };

    fetchFeaturedCampaigns();
  }, []);

  const getRankDisplay = (rank: string) => {
    const rankMap: Record<string, { label: string; color: string; icon: string }> = {
      Bronze: { label: "Bronze", color: "bg-amber-600", icon: "🥉" },
      Silver: { label: "Silver", color: "bg-gray-400", icon: "🥈" },
      Gold: { label: "Gold", color: "bg-yellow-500", icon: "🥇" },
      Diamond: { label: "Diamond", color: "bg-cyan-400", icon: "💎" },
    };

    return rankMap[rank] || { label: rank, color: "bg-gray-400", icon: "🏆" };
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="font-heading text-5xl md:text-6xl font-bold mb-6 leading-tight">
                Every Rupee.<br />
                Every Proof.<br />
                <span className="text-accent">Fully Transparent.</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Connect with verified NGOs, choose exactly what your donation funds, 
                and receive AI-verified proof of impact. Transparent giving, guaranteed.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="gradient-accent shadow-soft text-lg px-8">
                  <Link to="/campaigns">
                    Browse Campaigns <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="default" asChild className="gradient-accent shadow-soft text-lg px-8">
                  <Link to="/register-ngo">Register as NGO</Link>
                </Button>
              </div>
            </div>
            <div className="relative">
              <img
                src={heroImage}
                alt="People coming together to donate"
                className="rounded-3xl shadow-soft w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 text-center shadow-card">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-heading text-xl font-bold mb-2">AI-Verified Proofs</h3>
              <p className="text-sm text-muted-foreground">
                Every spending proof validated by advanced AI before reaching donors
              </p>
            </Card>
            <Card className="p-6 text-center shadow-card">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-heading text-xl font-bold mb-2">100% Transparency</h3>
              <p className="text-sm text-muted-foreground">
                Track your donation from transfer to verified impact with photo proof
              </p>
            </Card>
            <Card className="p-6 text-center shadow-card">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-heading text-xl font-bold mb-2">Instant Impact</h3>
              <p className="text-sm text-muted-foreground">
                Funds released to NGOs immediately; you receive reports within days
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="p-12 gradient-accent text-accent-foreground text-center shadow-soft">
            <h2 className="font-heading text-4xl font-bold mb-4">
              Ready to Make a Difference?
            </h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
              Join thousands of donors who trust DonateFlow for transparent, verified giving
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild className="text-lg px-8">
                <Link to="/campaigns">Start Donating</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-lg px-8 bg-accent-foreground/10 border-accent-foreground/20 hover:bg-accent-foreground/20">
                <Link to="/register-ngo">Register as NGO</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Featured Campaigns */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-heading text-4xl font-bold mb-4">
              Featured Campaigns
            </h2>
            <p className="text-lg text-muted-foreground">
              Verified NGOs with specific funding conditions
            </p>
          </div>
          {loadingCampaigns ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : featuredCampaigns.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              {featuredCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No active campaigns available at the moment.</p>
            </div>
          )}
          <div className="text-center">
            <Button size="lg" variant="outline" asChild>
              <Link to="/campaigns">
                View All Campaigns <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Top Donors Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-heading text-4xl font-bold mb-4">
              Top Donors
            </h2>
            <p className="text-lg text-muted-foreground">
              Recognizing our generous supporters who make a real difference
            </p>
          </div>
          {loadingDonors ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : topDonors.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topDonors.map((donor, index) => {
                const rankDisplay = getRankDisplay(donor.rank);
                return (
                  <Card key={donor.uid} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`${rankDisplay.color} text-white rounded-full w-12 h-12 flex items-center justify-center text-xl`}>
                          {rankDisplay.icon}
                        </div>
                        <Badge variant="outline" className="text-sm">
                          #{index + 1}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl mb-2">
                        {donor.displayName}
                      </CardTitle>
                      <CardDescription>
                        {donor.email}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Donated</span>
                          <span className="text-lg font-bold text-black">
                            ₹{donor.totalDonated.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Donations</span>
                          <span className="text-sm font-semibold text-black">
                            {donor.donationCount} {donor.donationCount === 1 ? "donation" : "donations"}
                          </span>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Rank</span>
                            <Badge className={`${rankDisplay.color} text-white`}>
                              {rankDisplay.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-black mb-2">No top donors yet</h3>
                <p className="text-gray-600">
                  Be the first to make a donation and appear on our leaderboard!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-heading text-4xl font-bold mb-4">
              How DonateFlow Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              DonateFlow revolutionizes charitable giving by ensuring complete transparency, accountability, and verification at every step. Here's how our platform works to create trust and maximize impact.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-12">
            {/* Step 1 */}
            <Card className="p-8 shadow-card">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0 shadow-soft">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-2xl font-bold mb-4">Browse and Choose Specific Conditions</h3>
                  <p className="text-base text-muted-foreground leading-relaxed mb-4">
                    Start by browsing our verified NGO campaigns. Each NGO campaign lists specific conditions or purposes for which they need funding. For example, a disaster relief campaign might have separate conditions like "Food Supplies" (₹50,000), "Medical Aid" (₹30,000), and "Shelter Materials" (₹20,000). You can see exactly how much is needed for each condition and how much has already been raised.
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    When you select a campaign, you'll see detailed information about the NGO, their goals, and each funding condition. You choose exactly which condition(s) you want to support, ensuring your donation goes precisely where you intend. Your donation amount is automatically divided equally across the conditions you select, or you can specify exact amounts for each condition.
                  </p>
                </div>
              </div>
            </Card>

            {/* Step 2 */}
            <Card className="p-8 shadow-card">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0 shadow-soft">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-2xl font-bold mb-4">Secure Payment with Payment Password</h3>
                  <p className="text-base text-muted-foreground leading-relaxed mb-4">
                    When you're ready to donate, you'll be asked to set up a payment password in your profile (if you haven't already). This adds an extra layer of security to prevent unauthorized transactions. Enter your payment password to confirm the donation amount.
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed mb-4">
                    Your donation is processed securely, and the funds are immediately recorded in the NGO's account. You'll receive instant confirmation, and your donation is added to your profile's donation history. As you donate, you'll earn badges for milestones (1st donation, 5 donations, 10, 25, 50, 100, 150, 200 donations) and ranks based on your total contribution (Bronze, Silver, Gold, Diamond).
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    The platform ensures that donations stop automatically once a condition's funding goal is reached, preventing overfunding. If a campaign or condition reaches its target, it's removed from active listings but remains visible in donor profiles for historical tracking.
                  </p>
                </div>
              </div>
            </Card>

            {/* Step 3 */}
            <Card className="p-8 shadow-card">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0 shadow-soft">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-2xl font-bold mb-4">NGO Uses Funds and Submits Proof</h3>
                  <p className="text-base text-muted-foreground leading-relaxed mb-4">
                    After receiving donations, NGOs use the funds for the specific conditions you funded. When they've completed work related to those conditions, NGO members upload proof photos showing the actual work done. Before submission, our AI verification system checks every image to ensure:
                  </p>
                  <ul className="list-disc list-inside text-base text-muted-foreground space-y-2 mb-4 ml-4">
                    <li>The images are real photographs (not AI-generated or synthetic)</li>
                    <li>The images actually show work related to the conditions you funded</li>
                    <li>The photos provide genuine evidence of impact</li>
                  </ul>
                  <p className="text-base text-muted-foreground leading-relaxed mb-4">
                    NGOs also allocate how the money was used across different conditions. For example, if you donated ₹5,000 to a campaign with "Food Supplies" and "Medical Aid" conditions, the NGO might allocate ₹3,000 to food supplies and ₹2,000 to medical aid, showing you exactly how your donation was utilized.
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    The proof submission includes photos, a description of the work, and a breakdown showing the percentage and amount spent on each condition. All of this is viewable in your donation history and on the "Live NGO Results" section of your profile.
                  </p>
                </div>
              </div>
            </Card>

            {/* Step 4 */}
            <Card className="p-8 shadow-card">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0 shadow-soft">
                  4
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-2xl font-bold mb-4">View Verified Proof and Track Impact</h3>
                  <p className="text-base text-muted-foreground leading-relaxed mb-4">
                    Once the NGO submits proof, you can view it in multiple places:
                  </p>
                  <ul className="list-disc list-inside text-base text-muted-foreground space-y-2 mb-4 ml-4">
                    <li><strong>Your Profile's Donation History:</strong> Each donation has a "View Proof & Allocation" link showing detailed breakdowns with pie charts</li>
                    <li><strong>Live NGO Results:</strong> See real-time updates from all NGOs you've supported, including total received, amount used, amount remaining, and latest work proof</li>
                    <li><strong>Donation Proof Page:</strong> Detailed view with photo galleries, allocation breakdowns, and work descriptions</li>
                  </ul>
                  <p className="text-base text-muted-foreground leading-relaxed mb-4">
                    The platform provides complete transparency with visual pie charts showing exactly how your donation was divided across conditions, photo galleries of the actual work, and real-time tracking of NGO wallet balances (total received, amount used, amount remaining).
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Our AI verification ensures that all proof images are authentic and relevant to the work described. Only verified, real photographs of actual NGO activities are accepted, giving you confidence that your donation created genuine impact.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Additional Features */}
          <div className="mt-16 max-w-4xl mx-auto">
            <Card className="p-8 gradient-accent text-accent-foreground shadow-soft">
              <h3 className="font-heading text-2xl font-bold mb-4">Key Features That Make DonateFlow Special</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Complete Transparency
                  </h4>
                  <p className="text-sm opacity-90">
                    Every rupee is tracked from donation to utilization. See exactly how your money was used with photo proof and detailed allocations.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    AI-Powered Verification
                  </h4>
                  <p className="text-sm opacity-90">
                    Advanced AI checks every proof image to ensure authenticity and relevance, rejecting AI-generated or irrelevant photos automatically.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Condition-Specific Funding
                  </h4>
                  <p className="text-sm opacity-90">
                    Choose exactly what your donation funds. Your money is allocated to specific conditions, not general expenses.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Real-Time Tracking
                  </h4>
                  <p className="text-sm opacity-90">
                    Watch your impact in real-time with live updates on NGO progress, wallet balances, and proof submissions.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Gamification & Recognition
                  </h4>
                  <p className="text-sm opacity-90">
                    Earn badges for donation milestones and ranks based on your total contribution. Top donors are featured on the homepage.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Secure Payment System
                  </h4>
                  <p className="text-sm opacity-90">
                    Payment password protection adds an extra layer of security to prevent unauthorized transactions.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
