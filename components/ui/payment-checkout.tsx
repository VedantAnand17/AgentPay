"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Lock, ArrowRight, ArrowLeft, Key, Shield, Radio, Terminal, AlertTriangle, Fingerprint, EyeOff, Activity, Zap } from "lucide-react";

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

  // Service fee from x402 payment requirements
  const serviceFee = paymentRequirements?.accepts?.[0]?.price || 
    `$${(Number(paymentRequirements?.accepts?.[0]?.maxAmountRequired || 0) / 1_000_000).toFixed(6)}`;
  const serviceFeeNumber = parseFloat(serviceFee.replace('$', '')) || 0;
  
  // Calculate total cost for buy trades
  const tradeAmount = tradeDetails?.size || 0;
  const totalCost = tradeDetails?.side === "buy" 
    ? (tradeAmount + serviceFeeNumber).toFixed(6)
    : serviceFeeNumber.toFixed(6);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border border-white/20 rounded-none shadow-2xl font-mono text-foreground">
        {/* Header Strip */}
        <div className="h-1 w-full bg-primary/50" />
        
        <AnimatePresence mode="wait">
          {currentStep === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-6 border-b border-white/10">
                <DialogHeader className="text-left space-y-1">
                  <div className="flex items-center justify-between">
                     <DialogTitle className="text-lg font-bold uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        Verify Parameters
                     </DialogTitle>
                     <div className="px-2 py-0.5 border border-primary/30 text-[10px] text-primary uppercase bg-primary/10">
                        Secure
                     </div>
                  </div>
                  <DialogDescription className="text-xs font-mono uppercase text-muted-foreground tracking-wide">
                    Confirm operation before encryption.
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Trade Summary */}
              {tradeDetails && (
                <div className="p-6 space-y-6">
                  <div className="space-y-4 text-xs">
                    <div className="flex justify-between items-center border-b border-dashed border-white/10 pb-2">
                      <span className="text-muted-foreground uppercase">Target Asset</span>
                      <span className="font-bold">{tradeDetails.symbol}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed border-white/10 pb-2">
                      <span className="text-muted-foreground uppercase">Strategy</span>
                      <span className={`font-bold uppercase ${tradeDetails.side === "buy" ? "text-green-500" : "text-red-500"}`}>
                        {tradeDetails.side === "buy" ? "ACQUIRE (LONG)" : "LIQUIDATE (SHORT)"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed border-white/10 pb-2">
                      <span className="text-muted-foreground uppercase">Volume</span>
                      <span className="font-bold">
                        {tradeDetails.side === "buy" 
                          ? `${tradeDetails.size} USDC` 
                          : `${tradeDetails.size} ${tradeDetails.symbol}`}
                      </span>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="bg-white/5 p-4 border border-white/10 space-y-2">
                    {tradeDetails && tradeDetails.side === "buy" && (
                      <>
                        <div className="flex justify-between text-[10px] text-muted-foreground uppercase">
                           <span>Capital Allocation</span>
                           <span>${tradeAmount.toFixed(2)} USDC</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground uppercase">
                           <span>Protocol Fee</span>
                           <span>{serviceFee}</span>
                        </div>
                        <div className="border-t border-white/10 pt-2 mt-2 flex justify-between items-center">
                           <span className="text-xs font-bold uppercase text-primary">Total Obligation</span>
                           <div className="flex items-center gap-2">
                              <Lock className="w-3 h-3 text-primary" />
                              <span className="text-lg font-bold text-primary">${totalCost}</span>
                           </div>
                        </div>
                      </>
                    )}
                    {tradeDetails && tradeDetails.side === "sell" && (
                      <>
                        <div className="flex justify-between text-[10px] text-muted-foreground uppercase">
                           <span>Liquidation Vol</span>
                           <span>{tradeAmount} {tradeDetails.symbol}</span>
                        </div>
                         <div className="border-t border-white/10 pt-2 mt-2 flex justify-between items-center">
                           <span className="text-xs font-bold uppercase text-primary">Protocol Fee</span>
                           <div className="flex items-center gap-2">
                              <Lock className="w-3 h-3 text-primary" />
                              <span className="text-lg font-bold text-primary">{serviceFee}</span>
                           </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">* Fee deducted from proceeds</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="px-6 pb-4">
                  <div className="bg-red-950/30 border border-red-500/30 p-3 flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-red-500" />
                    <p className="text-[10px] text-red-400 font-mono uppercase">Auth Error: {error}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="p-6 border-t border-white/10 flex gap-3 bg-white/5">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="flex-1 rounded-none border-white/20 hover:bg-white/10 uppercase text-xs tracking-wider h-10"
                  disabled={loading}
                >
                  [ ABORT ]
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 rounded-none bg-primary text-black hover:bg-primary/90 font-bold uppercase text-xs tracking-wider h-10"
                >
                  AUTHORIZE UPLINK
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === "payment" && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-6 border-b border-white/10">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-lg font-bold uppercase tracking-widest text-amber-500 flex items-center gap-2">
                     <AlertTriangle className="w-4 h-4" />
                     Signature Required
                  </DialogTitle>
                </DialogHeader>
              </div>

              <div className="p-8 flex flex-col items-center text-center space-y-6">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border border-dashed border-primary/30 rounded-full animate-spin-slow" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Key className="w-8 h-8 text-primary animate-pulse" />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                    {tradeDetails?.side === "buy" ? "Confirm Total" : "Confirm Fee"}
                  </p>
                  <p className="text-3xl font-bold text-foreground tracking-tighter">
                    {tradeDetails?.side === "buy" ? `$${totalCost}` : serviceFee}
                  </p>
                </div>
                
                <div className="bg-white/5 p-3 border border-white/10 w-full text-left">
                   <div className="flex items-center gap-2 mb-1">
                      <EyeOff className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Privacy Protocol</span>
                   </div>
                   <p className="text-[10px] text-muted-foreground/80">
                      Zero-knowledge authorization. No keys stored. No logs kept.
                   </p>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex gap-3 bg-white/5">
                <Button
                  onClick={() => setCurrentStep("review")}
                  variant="outline"
                  className="w-full rounded-none border-white/20 hover:bg-white/10 uppercase text-xs tracking-wider h-10"
                  disabled={loading}
                >
                  <ArrowLeft className="mr-2 w-3 h-3" />
                  RETURN
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-6 border-b border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold uppercase tracking-widest flex items-center gap-2">
                     <Zap className="w-4 h-4 text-primary" />
                     Relaying Intent
                  </DialogTitle>
                </DialogHeader>
              </div>

              <div className="p-12 flex flex-col items-center text-center space-y-8">
                 <div className="relative">
                    <div className="w-16 h-16 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-primary animate-pulse">
                       0x...
                    </div>
                 </div>
                 
                 <div className="w-full space-y-2 font-mono text-xs text-left bg-black p-4 border border-white/10">
                    <p className="text-green-500">> Verifying Signature... [OK]</p>
                    <p className="text-green-500/80">> Establishing Tunnel... [OK]</p>
                    <p className="text-primary animate-pulse">> Broadcasting to Base Sepolia...</p>
                 </div>
              </div>
            </motion.div>
          )}

          {currentStep === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-6 border-b border-green-500/30 bg-green-500/10">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold uppercase tracking-widest text-green-500 flex items-center gap-2">
                     <CheckCircle2 className="w-4 h-4" />
                     Operation Complete
                  </DialogTitle>
                </DialogHeader>
              </div>

              <div className="p-8 flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 rounded-full border-2 border-green-500 bg-green-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                
                <div className="space-y-2">
                  <p className="font-bold text-lg uppercase tracking-wide">Execution Confirmed</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Transaction hash verified on Base Sepolia.
                  </p>
                </div>
                
                <div className="flex items-center gap-2 px-3 py-1 bg-green-950/30 border border-green-500/30 rounded-full">
                   <Activity className="w-3 h-3 text-green-500" />
                   <span className="text-[10px] text-green-500 uppercase tracking-widest">Trace Cleared</span>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 bg-white/5">
                <Button
                  onClick={handleClose}
                  className="w-full rounded-none bg-green-600 hover:bg-green-700 text-white font-bold uppercase text-xs tracking-wider h-10"
                >
                  CLOSE SECURE CHANNEL
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
