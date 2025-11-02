import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/firebase/config";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Heart } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, signInWithGoogle, currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [paymentPassword, setPaymentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError("");
      setLoading(true);
      await login(data.email, data.password);
      
      // Wait a moment for currentUser to be set, then check payment password
      setTimeout(async () => {
        await checkAndSetupPaymentPassword();
      }, 500);
      
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const checkAndSetupPaymentPassword = async () => {
    // Wait for currentUser to be available
    let attempts = 0;
    while (!currentUser && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!currentUser) return;
    
    try {
      const userProfileRef = doc(db, "users", currentUser.uid);
      const userProfileDoc = await getDoc(userProfileRef);
      
      if (!userProfileDoc.exists() || !userProfileDoc.data().paymentPassword) {
        // Show payment password setup dialog
        setShowPasswordSetup(true);
      }
    } catch (error) {
      console.error("Error checking payment password:", error);
    }
  };

  const handlePaymentPasswordSetup = async () => {
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
      const userProfileRef = doc(db, "users", currentUser.uid);
      const userProfileDoc = await getDoc(userProfileRef);

      if (userProfileDoc.exists()) {
        await setDoc(userProfileRef, {
          paymentPassword: paymentPassword, // In production, hash this password
          lastUpdated: serverTimestamp(),
        }, { merge: true });
      } else {
        await setDoc(userProfileRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          paymentPassword: paymentPassword, // In production, hash this password
          donationHistory: [],
          totalDonated: 0,
          donationCount: 0,
          badges: [],
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        });
      }

      toast({
        title: "✅ Payment Password Set",
        description: "Your payment password has been saved successfully.",
      });

      setShowPasswordSetup(false);
      setPaymentPassword("");
      setConfirmPassword("");
      setPasswordError("");
    } catch (error: any) {
      setPasswordError(error.message || "Failed to set payment password");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError("");
      setGoogleLoading(true);
      await signInWithGoogle();
      
      // Wait a moment for currentUser to be set
      setTimeout(async () => {
        await checkAndSetupPaymentPassword();
      }, 500);
      
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // Check payment password after user is set
  useEffect(() => {
    if (currentUser) {
      checkAndSetupPaymentPassword();
    }
  }, [currentUser]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center py-12 px-4 bg-secondary/30">
        <Card className="w-full max-w-md shadow-soft">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Heart className="w-8 h-8 text-accent fill-accent" />
              <CardTitle className="text-2xl font-heading">Welcome Back</CardTitle>
            </div>
            <CardDescription>
              Sign in to your DonateFlow account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {/* Google Sign-In Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full mb-4"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  {...register("email")}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register("password")}
                  className={errors.password ? "border-destructive" : ""}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full gradient-accent shadow-soft"
                disabled={loading || googleLoading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-accent hover:underline font-medium">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Payment Password Setup Dialog */}
      <Dialog open={showPasswordSetup} onOpenChange={(open) => {
        if (!open) {
          // Don't allow closing until password is set
          toast({
            title: "Payment Password Required",
            description: "Please set a payment password to continue.",
            variant: "destructive",
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Payment Password</DialogTitle>
            <DialogDescription>
              For security purposes, please set a payment password. This password will be required before every donation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="payment-password-setup">Payment Password</Label>
              <Input
                id="payment-password-setup"
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
              <Label htmlFor="confirm-password-setup">Confirm Password</Label>
              <Input
                id="confirm-password-setup"
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
          <div className="flex justify-end">
            <Button onClick={handlePaymentPasswordSetup} className="bg-black text-white">
              Set Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Login;

