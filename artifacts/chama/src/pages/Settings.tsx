import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, CheckSquare, Square } from "lucide-react";
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
