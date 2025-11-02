import { Link } from "react-router-dom";
import { Heart, Mail, Shield } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-secondary/50 border-t border-border mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-6 h-6 text-accent fill-accent" />
              <span className="font-heading text-xl font-bold">DonateFlow</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Transparent, verified donations connecting compassionate donors with impactful NGOs.
            </p>
          </div>

          <div>
            <h3 className="font-heading font-semibold mb-4">Platform</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/campaigns" className="text-sm text-muted-foreground transition-smooth hover:text-accent">
                  Browse Campaigns
                </Link>
              </li>
              <li>
                <Link to="/register-ngo" className="text-sm text-muted-foreground transition-smooth hover:text-accent">
                  Register as NGO
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-semibold mb-4">Trust & Safety</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-accent" />
                AI-Verified Proofs
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-accent" />
                Secure Payments
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-accent" />
                100% Transparency
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-semibold mb-4">Contact</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Mail className="w-4 h-4 text-accent" />
              <a href="mailto:support@donateflow.org" className="transition-smooth hover:text-accent">
                support@donateflow.org
              </a>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              © 2025 DonateFlow. Built with transparency and trust.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
