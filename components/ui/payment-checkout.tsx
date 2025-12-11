"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Lock, ArrowRight, ArrowLeft, Wallet, Shield, Zap } from "lucide-react";

interface PaymentCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentRequirements: any;
  onConfirm: () => Promise<void>;
  loading?: boolean;
  tradeDetails?: {
    symbol: string;
    side: "buy" | "sell";
    size: number;
    leverage: number;
  };
  executedTrade?: any; // Track when trade is executed
}

type Step = "review" | "payment" | "processing" | "success";

export function PaymentCheckout({
  open,
  onOpenChange,
  paymentRequirements,
  onConfirm,
  loading = false,
  tradeDetails,
  executedTrade,
}: PaymentCheckoutProps) {
  const [currentStep, setCurrentStep] = useState<Step>("review");
  const [error, setError] = useState<string>("");

  // Move to success when trade is executed
  useEffect(() => {
    if (executedTrade && currentStep === "processing") {
      setCurrentStep("success");
      // Auto-close after showing success
      setTimeout(() => {
        onOpenChange(false);
        setCurrentStep("review");
      }, 3000);
    }
  }, [executedTrade, currentStep, onOpenChange]);

  const handleConfirm = async () => {
    try {
      setError("");
      setCurrentStep("payment");
      await onConfirm();
      // Move to processing state - success will be triggered by executedTrade prop
      setCurrentStep("processing");
    } catch (err: any) {
      setError(err.message || "Payment failed");
      setCurrentStep("review");
    }
  };

  const handleClose = () => {
    if (currentStep === "processing") return; // Prevent closing during processing
    setCurrentStep("review");
    setError("");
    onOpenChange(false);
  };

  const paymentAmount = paymentRequirements?.accepts?.[0]?.price || 
    `$${(Number(paymentRequirements?.accepts?.[0]?.maxAmountRequired || 0) / 1_000_000).toFixed(6)}`;
  const network = paymentRequirements?.accepts?.[0]?.network || "base-sepolia";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {currentStep === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-6 pb-4">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-center mb-2">
                    Review Your Order
                  </DialogTitle>
                  <DialogDescription className="text-center">
                    Please review your trade details before proceeding
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Trade Summary */}
              {tradeDetails && (
                <div className="px-6 pb-4">
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 space-y-4 border border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Asset</span>
                      <span className="font-semibold text-lg">{tradeDetails.symbol}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Direction</span>
                      <span className={`font-semibold ${tradeDetails.side === "buy" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {tradeDetails.side.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Size</span>
                      <span className="font-semibold">{tradeDetails.size} ETH</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Leverage</span>
                      <span className="font-semibold">{tradeDetails.leverage}x</span>
                    </div>
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Network</span>
                        <span className="font-medium">{network}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              <div className="px-6 pb-6">
                <div className="bg-gradient-to-br from-primary/10 to-emerald-500/10 rounded-xl p-5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Payment Amount</span>
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">{paymentAmount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="w-3 h-3" />
                    <span>Secured by x402 protocol</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="px-6 pb-4">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="px-6 pb-6 flex gap-3 border-t border-border pt-4">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 text-white shadow-lg"
                >
                  Continue to Payment
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === "payment" && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-6 pb-4">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-center mb-2">
                    Confirm Payment
                  </DialogTitle>
                  <DialogDescription className="text-center">
                    Approve the transaction in your wallet to complete the payment
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="px-6 pb-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Amount</p>
                    <p className="text-3xl font-bold">{paymentAmount}</p>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Check your wallet for the signature request
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3 border-t border-border pt-4">
                <Button
                  onClick={() => setCurrentStep("review")}
                  variant="outline"
                  className="flex-1"
                  disabled={loading}
                >
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  Back
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-6 pb-4">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-center mb-2">
                    Processing Transaction
                  </DialogTitle>
                  <DialogDescription className="text-center">
                    Please wait while we execute your trade
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="px-6 pb-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-12 text-center space-y-6">
                  <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold">Executing trade on Uniswap...</p>
                    <p className="text-sm text-muted-foreground">
                      This may take a few moments
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-6 pb-4">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-center mb-2">
                    Payment Successful!
                  </DialogTitle>
                  <DialogDescription className="text-center">
                    Your trade has been executed successfully
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="px-6 pb-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-12 text-center space-y-6 border border-green-200 dark:border-green-800">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-20 h-20 mx-auto rounded-full bg-green-500 flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </motion.div>
                  <div className="space-y-2">
                    <p className="font-semibold text-lg">Trade Executed</p>
                    <p className="text-sm text-muted-foreground">
                      Your transaction has been confirmed on-chain
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3 border-t border-border pt-4">
                <Button
                  onClick={handleClose}
                  className="flex-1"
                >
                  Done
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
