import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CampaignCard from "@/components/CampaignCard";
import { ArrowRight, Shield, Eye, Zap, CheckCircle2 } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";
import disasterIcon from "@/assets/disaster-relief-icon.png";
import educationIcon from "@/assets/education-icon.png";
import environmentIcon from "@/assets/environment-icon.png";

const featuredCampaigns = [
  {
    id: "1",
    title: "Kerala Flood Relief 2025",
    organization: "Disaster Response India",
    description: "Emergency relief supplies and rebuilding support for flood-affected families in Kerala.",
    raised: 2450000,
    goal: 5000000,
    conditions: 4,
    verified: true,
    category: "Disaster Relief",
    image: disasterIcon,
  },
  {
    id: "2",
    title: "Rural School Digital Library Project",
    organization: "Education For All Foundation",
    description: "Setting up digital libraries with tablets and e-learning resources in 50 rural schools.",
    raised: 1890000,
    goal: 3000000,
    conditions: 3,
    verified: true,
    category: "Education",
    image: educationIcon,
  },
  {
    id: "3",
    title: "Western Ghats Reforestation Drive",
    organization: "Green Earth Collective",
    description: "Plant 100,000 native trees to restore biodiversity in degraded Western Ghats forest areas.",
    raised: 890000,
    goal: 2000000,
    conditions: 5,
    verified: true,
    category: "Environment",
    image: environmentIcon,
  },
];

const Home = () => {
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
                <Button size="lg" variant="outline" asChild className="text-lg px-8">
                  <Link to="/about">Learn How It Works</Link>
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
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {featuredCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
          <div className="text-center">
            <Button size="lg" variant="outline" asChild>
              <Link to="/campaigns">
                View All Campaigns <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-heading text-4xl font-bold mb-4">
              How DonateFlow Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Simple, transparent, and secure
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                title: "Choose a Condition",
                description: "Browse campaigns and select the specific condition you want to fund",
              },
              {
                step: "2",
                title: "Make Payment",
                description: "Donate securely via Razorpay. Funds go directly to the NGO",
              },
              {
                step: "3",
                title: "NGO Takes Action",
                description: "NGO uses funds for chosen condition and uploads photo/video proof",
              },
              {
                step: "4",
                title: "Receive Verified Report",
                description: "AI verifies proof and you get detailed report with breakdown",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-soft">
                  {item.step}
                </div>
                <h3 className="font-heading text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
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
                <Link to="/ngo-dashboard">Register as NGO</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
