import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

/**
 * Per-user profile & address storage.
 * Each user's data is stored under a key scoped by their user id, so:
 *  - edits persist across sessions and reload for THAT user,
 *  - one user's data can never overwrite or appear in another user's account,
 *  - logging out resets the active (in-memory) session without wiping the
 *    per-user keys, so the same user's details restore on their next login.
 */
const UserProfileContext = createContext(null);

const emptyProfile = { name: "", email: "", phone: "" };

const profileKey = (uid) => `gh_profile_${uid}`;
const addressesKey = (uid) => `gh_addresses_${uid}`;
const selectedKey = (uid) => `gh_selected_addr_${uid}`;

export function UserProfileProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || null;

  const [profile, setProfile] = useState(emptyProfile);
  const [profileLoading, setProfileLoading] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // (Re)load this user's persisted data when the active user changes.
  // On logout (no user), reset to empty so no previous account's data shows.
  useEffect(() => {
    if (!userId) {
      setProfileLoading(false);
      setProfile(emptyProfile);
      setAddresses([]);
      setSelectedAddressId(null);
      return;
    }
    // Start with auth data, then replace it with the authoritative User record.
    // Auth claims can be stale after a profile edit.
    setProfileLoading(true);
    setProfile({ name: user?.display_name || user?.full_name || "", email: user?.email || "", phone: user?.phone || "" });
    let active = true;
    base44.functions.invoke("getMyProfile", {}).then((response) => {
      if (active && response.data?.profile) setProfile(response.data.profile);
    }).catch(() => {
      // Keep the authenticated identity visible if the profile read is temporarily unavailable.
    }).finally(() => {
      if (active) setProfileLoading(false);
    });
    try {
      setAddresses(JSON.parse(localStorage.getItem(addressesKey(userId))) || []);
    } catch { setAddresses([]); }
    setSelectedAddressId(localStorage.getItem(selectedKey(userId)) || null);
    return () => { active = false; };
  }, [userId, user]);

  // Auto-select default address if none selected
  useEffect(() => {
    if (!selectedAddressId && addresses.length > 0) {
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      setSelectedAddressId(def.id);
    }
  }, [addresses, selectedAddressId]);

  // Sync Google account info (name, email) into the profile only when empty
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    setProfile((prev) => ({
      ...prev,
      name: prev.name || user.display_name || user.full_name || "",
      email: prev.email || user.email || "",
    }));
  }, [isAuthenticated, user]);

  // Persist per-user only (never write when logged out)
  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(profileKey(userId), JSON.stringify(profile));
  }, [profile, userId]);
  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(addressesKey(userId), JSON.stringify(addresses));
  }, [addresses, userId]);
  useEffect(() => {
    if (!userId) return;
    if (selectedAddressId) localStorage.setItem(selectedKey(userId), selectedAddressId);
    else localStorage.removeItem(selectedKey(userId));
  }, [selectedAddressId, userId]);

  const updateProfile = async (data) => {
    const response = await base44.functions.invoke("updateMyProfile", { name: data.name, phone: data.phone, email: profile.email });
    const savedProfile = response.data?.profile;
    if (!savedProfile) throw new Error("Profile was not saved");
    setProfile(savedProfile);
    return savedProfile;
  };

  const addAddress = (address) => {
    const newAddr = { ...address, id: Date.now().toString() };
    setAddresses((prev) => {
      const updated = address.isDefault
        ? prev.map((a) => ({ ...a, isDefault: false }))
        : prev;
      return [...updated, newAddr];
    });
    if (address.isDefault || addresses.length === 0) setSelectedAddressId(newAddr.id);
    return newAddr;
  };

  const updateAddress = (id, data) => {
    setAddresses((prev) =>
      data.isDefault
        ? prev.map((a) => a.id === id ? { ...a, ...data } : { ...a, isDefault: false })
        : prev.map((a) => a.id === id ? { ...a, ...data } : a)
    );
  };

  const deleteAddress = (id) => {
    setAddresses((prev) => {
      const filtered = prev.filter((a) => a.id !== id);
      if (selectedAddressId === id) {
        const next = filtered.find((a) => a.isDefault) || filtered[0];
        setSelectedAddressId(next?.id || null);
      }
      return filtered;
    });
  };

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;

  return (
    <UserProfileContext.Provider value={{
      profile, profileLoading, updateProfile,
      addresses, addAddress, updateAddress, deleteAddress,
      selectedAddressId, setSelectedAddressId, selectedAddress,
    }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export const useUserProfile = () => useContext(UserProfileContext);
