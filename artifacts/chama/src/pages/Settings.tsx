import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, ShieldCheck, ShieldOff, Mail } from "lucide-react";
import { apiRequest } from "@/lib/api";

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const city = data.address?.city ?? data.address?.town ?? data.address?.village ?? "";
    const country = data.address?.country ?? "";
    return [city, country].filter(Boolean).join(", ");
  } catch {
    return "";
  }
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState((user as any)?.username ?? "");
  const [phone, setPhone] = useState(user?.phoneNumber ?? "");
  const [location, setLocation] = useState((user as any)?.location ?? "");
  const [emailMarketing, setEmailMarketing] = useState((user as any)?.emailMarketing ?? false);
  const [emailNotif, setEmailNotif] = useState((user as any)?.notificationEmail ?? true);
  const [locationLoading, setLocationLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const twoFactorEnabled = !!(user as any)?.twoFactorEnabled;
  const [tfaStep, setTfaStep] = useState<"idle" | "verify" | "disable">("idle");
  const [tfaEmailHint, setTfaEmailHint] = useState("");
  const [tfaCode, setTfaCode] = useState("");
  const [tfaDisablePassword, setTfaDisablePassword] = useState("");
  const [tfaLoading, setTfaLoading] = useState(false);
  const [tfaResending, setTfaResending] = useState(false);

  const handleRequest2fa = async () => {
    setTfaLoading(true);
    try {
      const data: any = await apiRequest("/api/auth/2fa/request", { method: "POST" });
      setTfaEmailHint(data.emailHint ?? "");
      setTfaStep("verify");
    } catch {
      toast({ title: "Error", description: "Could not send verification code.", variant: "destructive" });
    } finally {
      setTfaLoading(false);
    }
  };

  const handleResend2fa = async () => {
    setTfaResending(true);
    try {
      await apiRequest("/api/auth/2fa/request", { method: "POST" });
      toast({ title: "Code resent", description: "Check your inbox for a new code." });
    } catch {
      toast({ title: "Error", description: "Could not resend code.", variant: "destructive" });
    } finally {
      setTfaResending(false);
    }
  };

  const handleEnable2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setTfaLoading(true);
    try {
      await apiRequest("/api/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code: tfaCode.replace(/\s/g, "") }),
        headers: { "Content-Type": "application/json" },
      });
      setTfaStep("idle");
      setTfaCode("");
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({ title: "Email verification enabled", description: "Your account is now protected." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Invalid code.", variant: "destructive" });
      setTfaCode("");
    } finally {
      setTfaLoading(false);
    }
  };

  const handleDisable2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setTfaLoading(true);
    try {
      await apiRequest("/api/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password: tfaDisablePassword }),
        headers: { "Content-Type": "application/json" },
      });
      setTfaStep("idle");
      setTfaDisablePassword("");
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({ title: "2FA disabled", description: "Two-factor authentication has been turned off." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not disable 2FA.", variant: "destructive" });
    } finally {
      setTfaLoading(false);
    }
  };

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "Profile updated", description: "Your settings have been saved." });
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Could not update profile", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    updateMutation.mutate({
      userId: user.id,
      data: {
        name,
        username: username || undefined,
        phoneNumber: phone || undefined,
        location: location || undefined,
        emailMarketing,
        notificationEmail: emailNotif,
      },
    });
  };

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location not available", description: "Your browser doesn't support location services." });
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const label = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setLocation(label || `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`);
        setLocationLoading(false);
      },
      () => {
        setLocationLoading(false);
        toast({ title: "Location denied", description: "Location access was not granted." });
      }
    );
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please re-enter your new password.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "New password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setPwLoading(true);
    try {
      await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
        headers: { "Content-Type": "application/json" },
      });
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const msg = err?.data?.error ?? "Could not change password.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your profile and preferences</p>
        </div>

        {/* Profile */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Profile</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  placeholder="grace_w"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">Email cannot be changed here — contact support</p>
            </div>
            <div className="space-y-2">
              <Label>Phone number</Label>
              <Input placeholder="+1 555 000 0000" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              {location ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-[#3A5A40]/40 bg-[#3A5A40]/5">
                  <MapPin className="w-4 h-4 text-[#3A5A40] shrink-0" />
                  <span className="text-sm text-[#3A5A40] flex-1">{location}</span>
                  <button type="button" onClick={() => setLocation("")} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestLocation}
                  disabled={locationLoading}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-[#3A5A40]/40 text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                  {locationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  {locationLoading ? "Detecting location…" : "Use my current location"}
                </button>
              )}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={user?.role?.replace("_", " ") ?? ""} disabled className="opacity-60 capitalize" />
            </div>
            <Button type="submit" className="bg-[#3A5A40] hover:bg-[#344E41]" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save changes
            </Button>
          </form>
        </div>

        {/* Notifications & Marketing */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Notifications & communications</h3>
          <div className="space-y-3">
            {[
              { label: "Email notifications", desc: "Contribution reminders and payout alerts", val: emailNotif, set: setEmailNotif },
              { label: "Marketing emails", desc: "Savings tips, feature updates and promotions from Aventum Capital", val: emailMarketing, set: setEmailMarketing },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => item.set(!item.val)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${item.val ? "bg-[#3A5A40]" : "bg-muted"}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${item.val ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            ))}
          </div>
          <Button
            className="mt-4 bg-[#3A5A40] hover:bg-[#344E41]"
            disabled={updateMutation.isPending}
            onClick={() => {
              if (!user) return;
              updateMutation.mutate({ userId: user.id, data: { notificationEmail: emailNotif, emailMarketing } });
            }}
          >
            {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save preferences
          </Button>
        </div>

        {/* Change Password */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-1">Change password</h3>
          <p className="text-sm text-muted-foreground mb-4">Update your password to keep your account secure</p>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-pw">Current password</Label>
              <Input
                id="current-pw"
                type="password"
                placeholder="Your current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirm new password</Label>
              <Input
                id="confirm-pw"
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="bg-[#3A5A40] hover:bg-[#344E41]" disabled={pwLoading}>
              {pwLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Change password
            </Button>
          </form>
        </div>

        {/* Two-Factor Authentication */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold">Email verification (2FA)</h3>
            {twoFactorEnabled && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3A5A40] bg-[#3A5A40]/10 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> Enabled
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {twoFactorEnabled
              ? "Each sign-in sends a one-time code to your email for extra security."
              : "Add an extra layer of security — we'll email you a code each time you sign in."}
          </p>

          {/* Idle — not enabled */}
          {!twoFactorEnabled && tfaStep === "idle" && (
            <Button onClick={handleRequest2fa} disabled={tfaLoading} className="bg-[#3A5A40] hover:bg-[#344E41]">
              {tfaLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Enable email verification
            </Button>
          )}

          {/* Verify step — enter emailed code */}
          {tfaStep === "verify" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to <span className="font-medium">{tfaEmailHint || "your email"}</span>. Enter it below to enable email verification.
              </p>
              <form onSubmit={handleEnable2fa} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="tfa-code">Verification code</Label>
                  <Input
                    id="tfa-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={tfaCode}
                    onChange={e => setTfaCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    className="max-w-[180px] text-center font-mono text-xl tracking-[0.4em]"
                    maxLength={6}
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <Button type="submit" className="bg-[#3A5A40] hover:bg-[#344E41]" disabled={tfaLoading || tfaCode.length < 6}>
                    {tfaLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Verify and enable
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setTfaStep("idle"); setTfaCode(""); }}>Cancel</Button>
                </div>
              </form>
              <button
                type="button"
                disabled={tfaResending}
                className="text-sm text-[#3A5A40] hover:underline disabled:opacity-50"
                onClick={handleResend2fa}
              >
                {tfaResending ? "Resending…" : "Resend code"}
              </button>
            </div>
          )}

          {/* Enabled — show disable option */}
          {twoFactorEnabled && tfaStep === "idle" && (
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => setTfaStep("disable")}
            >
              <ShieldOff className="w-4 h-4 mr-2" />
              Disable two-factor authentication
            </Button>
          )}

          {/* Disable confirmation */}
          {tfaStep === "disable" && (
            <form onSubmit={handleDisable2fa} className="space-y-3 max-w-sm">
              <p className="text-sm text-muted-foreground">Enter your password to confirm disabling 2FA</p>
              <Input
                type="password"
                placeholder="Your current password"
                value={tfaDisablePassword}
                onChange={e => setTfaDisablePassword(e.target.value)}
                autoFocus
                required
              />
              <div className="flex gap-2">
                <Button type="submit" variant="destructive" disabled={tfaLoading || !tfaDisablePassword}>
                  {tfaLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Disable 2FA
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setTfaStep("idle"); setTfaDisablePassword(""); }}>Cancel</Button>
              </div>
            </form>
          )}
        </div>

        {/* Payment methods */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-1">Payment methods</h3>
          <p className="text-sm text-muted-foreground mb-4">Connect a payment method for contributions</p>
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground text-sm mb-3">M-Pesa and bank transfer integrations coming soon</p>
            <Button variant="outline" disabled>Add payment method</Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
