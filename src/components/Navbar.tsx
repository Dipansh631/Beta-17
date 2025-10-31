import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, Menu, X } from "lucide-react";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 transition-smooth hover:opacity-80">
            <Heart className="w-8 h-8 text-accent fill-accent" />
            <span className="font-heading text-2xl font-bold">DonateFlow</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/campaigns" className="text-sm font-medium transition-smooth hover:text-accent">
              Browse Campaigns
            </Link>
            <Link to="/about" className="text-sm font-medium transition-smooth hover:text-accent">
              How It Works
            </Link>
            <Link to="/ngo-dashboard" className="text-sm font-medium transition-smooth hover:text-accent">
              For NGOs
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild className="gradient-accent shadow-soft">
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 transition-smooth hover:bg-secondary rounded-lg"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              <Link
                to="/campaigns"
                className="text-sm font-medium transition-smooth hover:text-accent"
                onClick={() => setIsMenuOpen(false)}
              >
                Browse Campaigns
              </Link>
              <Link
                to="/about"
                className="text-sm font-medium transition-smooth hover:text-accent"
                onClick={() => setIsMenuOpen(false)}
              >
                How It Works
              </Link>
              <Link
                to="/ngo-dashboard"
                className="text-sm font-medium transition-smooth hover:text-accent"
                onClick={() => setIsMenuOpen(false)}
              >
                For NGOs
              </Link>
              <div className="flex flex-col gap-2 pt-2">
                <Button variant="ghost" asChild className="w-full">
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild className="w-full gradient-accent shadow-soft">
                  <Link to="/signup">Get Started</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
