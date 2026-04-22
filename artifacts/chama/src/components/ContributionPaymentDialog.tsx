import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ContributionPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  cycleId: number | null | undefined;
  amountLabel: string;
  groupName: string;
  currency: string;
  onSuccess: () => void;
}

interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amountCharged: number;
  contributionAmountCharged: number;
  currency: string;
  platformFee: number;
  feeRate: number;
}

function formatChargedAmount(amount: number, currency: string) {
  const zeroDecimal = ["KES", "NGN", "TZS", "UGX"].includes(currency.toUpperCase());
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  }).format(zeroDecimal ? amount : amount / 100);
}

function PaymentForm({
  groupId,
  cycleId,
  paymentIntentId,
  amountLabel,
  feeLabel,
  chargedLabel,
  onSuccess,
  onOpenChange,
}: {
  groupId: number;
  cycleId: number;
  paymentIntentId: string;
  amountLabel: string;
  feeLabel: string;
  chargedLabel: string;
  onSuccess: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Payment could not be completed");
      }

      if (!result.paymentIntent || result.paymentIntent.status !== "succeeded") {
        throw new Error(
          `Payment was not completed — status: ${result.paymentIntent?.status ?? "unknown"}. Please try again.`
        );
      }

      const confirmedIntentId = result.paymentIntent.id;
      await apiRequest("/api/stripe/confirm-contribution", {
        method: "POST",
        body: JSON.stringify({ groupId, cycleId, paymentIntentId: confirmedIntentId }),
      });

      toast({ title: "Contribution paid", description: `${amountLabel} has been recorded for this cycle.` });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Payment failed",
        description: err?.data?.error ?? err?.message ?? "Could not complete payment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Secure card payment</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Stripe securely processes your payment. Aventum records the contribution only after Stripe confirms it.
            </p>
          </div>
        </div>
      </div>

      <PaymentElement />

      <div className="rounded-lg bg-[#f7f6f2] px-4 py-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Contribution due</span>
          <span className="font-medium">{amountLabel}</span>
        </div>
        <div className="mt-1 flex justify-between gap-4">
          <span className="text-muted-foreground">Aventum transaction fee (3%)</span>
          <span className="font-medium">{feeLabel}</span>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-border/70 pt-2">
          <span className="text-muted-foreground">Charged today</span>
          <span className="font-medium">{chargedLabel}</span>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={!stripe || !elements || submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Pay securely
      </Button>
    </form>
  );
}

export function ContributionPaymentDialog({
  open,
  onOpenChange,
  groupId,
  cycleId,
  amountLabel,
  groupName,
  currency,
  onSuccess,
}: ContributionPaymentDialogProps) {
  const { toast } = useToast();
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [intent, setIntent] = useState<PaymentIntentResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !cycleId) return;
    let cancelled = false;
    setLoading(true);
    setIntent(null);

    Promise.all([
      apiRequest<{ publishableKey: string }>("/api/stripe/config"),
      apiRequest<PaymentIntentResponse>("/api/stripe/create-payment-intent", {
        method: "POST",
        body: JSON.stringify({ groupId, cycleId, currency }),
      }),
    ])
      .then(([config, paymentIntent]) => {
        if (cancelled) return;
        setPublishableKey(config.publishableKey);
        setIntent(paymentIntent);
      })
      .catch((err: any) => {
        if (cancelled) return;
        toast({
          title: "Payment setup failed",
          description: err?.data?.error ?? "Stripe is not ready for this payment.",
          variant: "destructive",
        });
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, groupId, cycleId, currency]);

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey]
  );

  const chargedLabel = intent ? formatChargedAmount(intent.amountCharged, intent.currency) : amountLabel;
  const feeLabel = intent ? formatChargedAmount(intent.platformFee, intent.currency) : "3%";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pay contribution</DialogTitle>
          <DialogDescription>
            Complete your payment for {groupName}. Your contribution will update after Stripe confirms the charge.
          </DialogDescription>
        </DialogHeader>

        {loading || !intent || !stripePromise || !cycleId ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Preparing secure payment
          </div>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: intent.clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#3A5A40",
                  borderRadius: "8px",
                },
              },
            }}
          >
            <PaymentForm
              groupId={groupId}
              cycleId={cycleId}
              paymentIntentId={intent.paymentIntentId}
              amountLabel={amountLabel}
              feeLabel={feeLabel}
              chargedLabel={chargedLabel}
              onSuccess={onSuccess}
              onOpenChange={onOpenChange}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}