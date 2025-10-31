import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, TrendingUp } from "lucide-react";

interface Campaign {
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

interface CampaignCardProps {
  campaign: Campaign;
}

const CampaignCard = ({ campaign }: CampaignCardProps) => {
  const progress = (campaign.raised / campaign.goal) * 100;

  return (
    <Link to={`/campaigns/${campaign.id}`}>
      <Card className="overflow-hidden shadow-card transition-smooth hover:shadow-soft hover:scale-[1.02] cursor-pointer">
        <div className="aspect-video overflow-hidden bg-secondary">
          <img
            src={campaign.image}
            alt={campaign.title}
            className="w-full h-full object-cover transition-smooth hover:scale-105"
          />
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between mb-3">
            <Badge variant="secondary" className="text-xs">
              {campaign.category}
            </Badge>
            {campaign.verified && (
              <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
            )}
          </div>
          
          <h3 className="font-heading text-xl font-bold mb-2 line-clamp-2">
            {campaign.title}
          </h3>
          
          <p className="text-sm text-muted-foreground mb-2">by {campaign.organization}</p>
          
          <p className="text-sm mb-4 line-clamp-2">{campaign.description}</p>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold">₹{campaign.raised.toLocaleString()}</span>
                <span className="text-muted-foreground">of ₹{campaign.goal.toLocaleString()}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{campaign.conditions} conditions</span>
              </div>
              <span>{Math.round(progress)}% funded</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default CampaignCard;
