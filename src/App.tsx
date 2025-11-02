import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import RegisterNGO from "./pages/RegisterNGO";
import BrowseCampaigns from "./pages/BrowseCampaigns";
import Profile from "./pages/Profile";
import NGODashboard from "./pages/NGODashboard";
import DonationProof from "./pages/DonationProof";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/register-ngo" element={<RegisterNGO />} />
            <Route path="/campaigns" element={<BrowseCampaigns />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/ngo-dashboard" element={<NGODashboard />} />
            <Route path="/donation-proof/:donationId" element={<DonationProof />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
